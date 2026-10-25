import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import { createClient, chains, createAccount } from 'genlayer-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env
const envPath = path.join(__dirname, '../../.env');
const env = {};
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      env[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim();
    }
  }
}

// Read deployments
const deploymentsPath = path.join(__dirname, 'deployments_v3.json');
const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
const escrowAddress = deployments.escrow.contractAddress;
console.log("==================================================================");
console.log("STAGE 3 STEP 3: V3 GATE BATCH EXECUTION");
console.log(`ShipEscrowV3 Address: ${escrowAddress}`);
console.log("==================================================================");

// Read fixtures
const fixturesPath = path.join(__dirname, '../../docs/evidence_v3/fixtures_v3.json');
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));

// Target output dirs
const gateDir = path.join(__dirname, '../../docs/evidence_v3/gate');
const failuresDir = path.join(gateDir, 'failures');
fs.mkdirSync(gateDir, { recursive: true });
fs.mkdirSync(failuresDir, { recursive: true });

const client = createClient({ chain: chains.studionet });
const creatorAccount = createAccount(env.CREATOR_PRIVATE_KEY);
const devAccount = createAccount(env.DEV_PRIVATE_KEY);

console.log(`Creator: ${creatorAccount.address}`);
console.log(`Dev:     ${devAccount.address}`);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForTx(txHash, label) {
  console.log(`  Waiting for ${label} tx ${txHash}...`);
  for (let attempt = 1; attempt <= 70; attempt++) {
    await sleep(3000);
    try {
      const tx = await client.getTransaction({ hash: txHash });
      const statusName = tx.statusName || String(tx.status);
      const execRes = tx.consensus_data?.leader_receipt?.[0]?.execution_result;
      const resultName = tx.result_name || String(tx.result);
      if (statusName === 'ACCEPTED' || statusName === 'FINALIZED') {
        console.log(`  [${label}] status=${statusName}, result=${resultName}, exec=${execRes}`);
        return tx;
      }
    } catch (err) {
      if (attempt % 5 === 0) {
        console.warn(`  [${label}] poll attempt ${attempt} warning:`, err.message || err);
      }
    }
  }
  throw new Error(`Timeout waiting for tx ${txHash}`);
}

async function ensureCredits() {
  console.log("\nChecking demo credits for Creator and Dev...");
  const creatorClaimed = await client.readContract({
    address: escrowAddress,
    functionName: 'has_claimed_demo',
    args: [creatorAccount.address],
  });
  if (!creatorClaimed) {
    console.log("Claiming demo credits for Creator...");
    const tx = await client.writeContract({
      account: creatorAccount,
      address: escrowAddress,
      functionName: 'claim_demo_credits',
      args: [],
    });
    await waitForTx(tx, "Creator Claim Demo");
    await sleep(8000);
  } else {
    console.log("Creator already claimed demo credits.");
  }

  const devClaimed = await client.readContract({
    address: escrowAddress,
    functionName: 'has_claimed_demo',
    args: [devAccount.address],
  });
  if (!devClaimed) {
    console.log("Claiming demo credits for Dev...");
    const tx = await client.writeContract({
      account: devAccount,
      address: escrowAddress,
      functionName: 'claim_demo_credits',
      args: [],
    });
    await waitForTx(tx, "Dev Claim Demo");
    await sleep(8000);
  } else {
    console.log("Dev already claimed demo credits.");
  }

  const creatorBal = await client.readContract({
    address: escrowAddress,
    functionName: 'get_balance',
    args: [creatorAccount.address],
  });
  const devBal = await client.readContract({
    address: escrowAddress,
    functionName: 'get_balance',
    args: [devAccount.address],
  });
  console.log(`Creator balance: ${creatorBal}, Dev balance: ${devBal}\n`);
}

const crit3 = JSON.stringify([
  { description: "Implement slugify in src/slug.py", importance: "MUST" },
  { description: "Add unit tests in tests/test_slug.py", importance: "MUST" },
  { description: "Update README with usage example", importance: "SHOULD" }
]);

const crit1 = JSON.stringify([
  { description: "Implement slugify in src/slug.py", importance: "MUST" }
]);

const fixtureConfigs = {
  F1: {
    meta: fixtures.F1,
    criteriaJson: crit3,
    pathsJson: "[]",
    expectedVerdict: "RELEASE_100",
    expectedLabels: ["YES", "YES", "YES"],
  },
  F4: {
    meta: fixtures.F4,
    criteriaJson: crit3,
    pathsJson: "[]",
    expectedVerdict: "RELEASE_75",
    expectedLabels: ["YES", "YES", "NO"],
  },
  F5: {
    meta: fixtures.F5,
    criteriaJson: crit1,
    pathsJson: "[]",
    expectedVerdict: "REFUND",
    expectedLabels: ["NO"],
  },
};

async function runSingle(fixtureId, runIndex) {
  const cfg = fixtureConfigs[fixtureId];
  const runNum = String(runIndex).padStart(2, '0');
  console.log(`\n----------------------------------------------------`);
  console.log(`GATE RUN: ${fixtureId} [${runIndex}/10] (PR #${cfg.meta.pr_number})`);
  console.log(`----------------------------------------------------`);

  // Spacing >= 7s
  await sleep(8000);

  // 1. Creator creates a fresh bounty
  console.log(`1. Creator creating fresh bounty for ${fixtureId}...`);
  const createTx = await client.writeContract({
    account: creatorAccount,
    address: escrowAddress,
    functionName: 'create_bounty',
    args: [
      "hypercybers99/ship-escrow-fixtures",
      10, // reward_amount
      cfg.criteriaJson,
      cfg.pathsJson
    ]
  });
  const createReceipt = await waitForTx(createTx, `${fixtureId} Create #${runNum}`);

  // Fetch created bounty ID
  const recentsRaw = await client.readContract({
    address: escrowAddress,
    functionName: 'list_bounties',
    args: [1]
  });
  const recentBounties = typeof recentsRaw === 'string' ? JSON.parse(recentsRaw) : recentsRaw;
  const bountyId = recentBounties[recentBounties.length - 1];
  console.log(`   Assigned Bounty ID: ${bountyId}`);

  // Spacing >= 7s
  await sleep(8000);

  // 2. Dev submits work
  console.log(`2. Dev submitting work for ${fixtureId} (Bounty ${bountyId}, PR #${cfg.meta.pr_number}, Head ${cfg.meta.head_sha.substring(0, 8)}...)...`);
  const submitTx = await client.writeContract({
    account: devAccount,
    address: escrowAddress,
    functionName: 'submit_work',
    args: [
      bountyId,
      cfg.meta.pr_url,
      cfg.meta.head_sha
    ]
  });
  const submitReceipt = await waitForTx(submitTx, `${fixtureId} Submit #${runNum}`);
  const statusName = submitReceipt.statusName || String(submitReceipt.status);
  const resultName = submitReceipt.result_name || String(submitReceipt.result);
  const execResult = submitReceipt.consensus_data?.leader_receipt?.[0]?.execution_result;
  const isReceiptValid = (statusName === 'ACCEPTED' || statusName === 'FINALIZED') &&
                        resultName === 'MAJORITY_AGREE' &&
                        execResult === 'SUCCESS';

  if (!isReceiptValid) {
    console.error(`  [FAIL] ${fixtureId} #${runNum} failed receipt rule: status=${statusName}, result=${resultName}, exec=${execResult}`);
    const failRecord = {
      fixture_id: fixtureId,
      run_index: runIndex,
      bounty_id: bountyId,
      pr_url: cfg.meta.pr_url,
      head_sha: cfg.meta.head_sha,
      create_tx_hash: createTx,
      submit_tx_hash: submitTx,
      submit_receipt: submitReceipt,
      error_message: submitReceipt.consensus_data?.leader_receipt?.[0]?.error_message || null,
    };
    const failPath = path.join(failuresDir, `${fixtureId.toLowerCase()}_run_${runNum}_fail.json`);
    fs.writeFileSync(failPath, JSON.stringify(failRecord, null, 2), 'utf8');
    return {
      success: false,
      fixtureId,
      runIndex,
      execResult,
      labelVector: null,
      verdict: null,
      payoutPct: null,
      receipt: submitReceipt,
    };
  }

  await sleep(3000);

  // 3. Read back on-chain submission
  const subsListRaw = await client.readContract({
    address: escrowAddress,
    functionName: 'list_submissions',
    args: [bountyId, 1]
  });
  const subsList = typeof subsListRaw === 'string' ? JSON.parse(subsListRaw) : subsListRaw;
  const subId = subsList[subsList.length - 1];
  let subRecord = {};
  if (subId) {
    const rawSub = await client.readContract({
      address: escrowAddress,
      functionName: 'get_submission',
      args: [subId]
    });
    subRecord = typeof rawSub === 'string' ? JSON.parse(rawSub) : rawSub;
  }

  const record = {
    fixture_id: fixtureId,
    run_index: runIndex,
    bounty_id: bountyId,
    submission_id: subId || null,
    pr_url: cfg.meta.pr_url,
    head_sha: cfg.meta.head_sha,
    create_tx_hash: createTx,
    create_receipt_status: createReceipt.statusName || String(createReceipt.status),
    submit_tx_hash: submitTx,
    created_at: submitReceipt.created_at || null,
    submit_receipt: {
      status_name: statusName,
      result_name: resultName,
      execution_result: execResult,
      votes: submitReceipt.consensus_data?.votes,
      leader_receipt: submitReceipt.consensus_data?.leader_receipt,
    },
    on_chain_submission: subRecord,
    packet_sha256: subRecord.packet_sha256,
  };

  const outPath = path.join(gateDir, `${fixtureId.toLowerCase()}_run_${runNum}.json`);
  fs.writeFileSync(outPath, JSON.stringify(record, null, 2), 'utf8');
  console.log(`  [SUCCESS] Saved run record to ${outPath}`);
  console.log(`    Verdict: ${subRecord.verdict}, Payout: ${subRecord.payout_pct}%, Labels: ${JSON.stringify(subRecord.criterion_results)}`);

  return {
    success: true,
    fixtureId,
    runIndex,
    execResult,
    labelVector: JSON.stringify(subRecord.criterion_results || []),
    verdict: subRecord.verdict,
    payoutPct: subRecord.payout_pct,
    packetSha256: subRecord.packet_sha256,
  };
}

async function main() {
  await ensureCredits();

  const results = {
    F1: [],
    F4: [],
    F5: [],
  };

  const fixtureOrder = ["F1", "F4", "F5"];

  for (const fId of fixtureOrder) {
    console.log(`\n==================================================================`);
    console.log(`STARTING 10-RUN GATE BATCH FOR FIXTURE ${fId}`);
    console.log(`==================================================================`);
    for (let i = 1; i <= 10; i++) {
      const runRes = await runSingle(fId, i);
      results[fId].push(runRes);
    }
  }

  console.log("\n==================================================================");
  console.log("EVALUATING GATE ACTIVATION CRITERIA");
  console.log("==================================================================");

  const evaluation = {};
  let overallPass = true;

  for (const fId of fixtureOrder) {
    const runs = results[fId];
    const totalAttempts = runs.length;
    const successes = runs.filter(r => r.success).length;
    const failures = totalAttempts - successes;

    // Vector frequency
    const vectorFreq = {};
    for (const r of runs) {
      if (r.success && r.labelVector) {
        vectorFreq[r.labelVector] = (vectorFreq[r.labelVector] || 0) + 1;
      }
    }

    let modalVector = null;
    let modalCount = 0;
    for (const [vec, count] of Object.entries(vectorFreq)) {
      if (count > modalCount) {
        modalVector = vec;
        modalCount = count;
      }
    }

    const successGate = successes >= 9 ? "PASS" : "FAIL";
    const labelGate = modalCount >= 9 ? "PASS" : "FAIL";
    const fixturePass = (successGate === "PASS" && labelGate === "PASS");

    if (!fixturePass) {
      overallPass = false;
    }

    evaluation[fId] = {
      attempts: totalAttempts,
      successes,
      failures,
      reliabilityPct: (successes / totalAttempts) * 100,
      modalVector,
      modalVectorCount: modalCount,
      successGate,
      labelGate,
      overall: fixturePass ? "PASS" : "FAIL",
    };

    console.log(`Fixture ${fId}: ${successes}/${totalAttempts} successes (${(successes / totalAttempts) * 100}%), Modal Labels: ${modalVector} (${modalCount}/${totalAttempts}) -> ${fixturePass ? "PASS" : "FAIL"}`);
  }

  const gateDecision = overallPass ? "ADOPT_V3_ACTIVE" : "REJECT_V3_KEEP_V2_1";
  console.log(`\nFINAL GATE DECISION: ${gateDecision}`);

  const summary = {
    executedAt: new Date().toISOString(),
    escrowAddress,
    evaluation,
    gateDecision,
    adopted: overallPass,
  };

  const summaryPath = path.join(gateDir, 'gate_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`Saved summary to ${summaryPath}`);

  // Generate markdown decision document
  let md = `# Milestone 1 V3 Gate Batch Decision Record\n\n`;
  md += `**Evaluation Date**: ${summary.executedAt}\n`;
  md += `**Candidate ShipEscrowV3 Address**: \`${escrowAddress}\`\n`;
  md += `**Pre-Registered Criteria**: >= 9/10 successes on EACH fixture AND >= 9/10 identical label vectors on each fixture.\n\n`;
  md += `## Gate Results Summary\n\n`;
  md += `| Fixture | Total Attempts | Successes | Failures | Reliability | Modal Label Vector | Modal Count | Success Gate | Label Gate | Status |\n`;
  md += `|---|---|---|---|---|---|---|---|---|---|\n`;

  for (const fId of fixtureOrder) {
    const e = evaluation[fId];
    md += `| **${fId}** | ${e.attempts} | ${e.successes} | ${e.failures} | ${e.reliabilityPct.toFixed(1)}% | \`${e.modalVector}\` | ${e.modalVectorCount}/10 | ${e.successGate} | ${e.labelGate} | **${e.overall}** |\n`;
  }

  md += `\n## Activation Decision\n\n`;
  if (overallPass) {
    md += `**Decision**: **\`ADOPT_V3_ACTIVE\`**\n\n`;
    md += `All pre-registered gate requirements have been satisfied:\n`;
    md += `- Every fixture achieved >= 90% execution reliability without rate-limiting reverts.\n`;
    md += `- Label vectors are consensus-bound and matched across >= 90% of runs.\n`;
    md += `- **\`ShipEscrowV3\` at \`${escrowAddress}\` is formally adopted as the active contract.**\n`;
  } else {
    md += `**Decision**: **\`REJECT_V3_KEEP_V2_1\`**\n\n`;
    md += `One or more pre-registered gate requirements failed. As pre-registered, rollout is stopped and V2.1 remains active.\n`;
  }

  const decisionPath = path.join(__dirname, '../../docs/GATE_V3_DECISION.md');
  fs.writeFileSync(decisionPath, md, 'utf8');
  console.log(`Saved decision document to ${decisionPath}`);
}

main().catch(err => {
  console.error("FATAL in gate batch runner:", err);
  process.exit(1);
});

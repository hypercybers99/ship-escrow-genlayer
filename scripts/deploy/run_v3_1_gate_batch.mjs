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
const deploymentsPath = path.join(__dirname, 'deployments_v3_1.json');
if (!fs.existsSync(deploymentsPath)) {
  throw new Error("deployments_v3_1.json missing; deploy V3.1 pair first");
}
const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
const escrowAddress = deployments.escrow_address;
console.log("==================================================================");
console.log("STAGE 3: V3.1 GATE BATCH EXECUTION (F1, F4, F5 - 30 RUNS)");
console.log(`ShipEscrowV3_1 Address: ${escrowAddress}`);
console.log("==================================================================");

// Read fixtures
const fixturesPath = path.join(__dirname, '../../docs/evidence_v3/fixtures_v3.json');
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));

// Target output dirs
const gateDir = path.join(__dirname, '../../docs/evidence_v3_1/gate');
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
    expectedPayoutPct: 100,
  },
  F4: {
    meta: fixtures.F4,
    criteriaJson: crit3,
    pathsJson: "[]",
    expectedVerdict: "RELEASE_50",
    expectedPayoutPct: 50,
  },
  F5: {
    meta: fixtures.F5,
    criteriaJson: crit1,
    pathsJson: "[]",
    expectedVerdict: "REFUND",
    expectedPayoutPct: 0,
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
    submission_id: subId,
    pr_url: cfg.meta.pr_url,
    head_sha: cfg.meta.head_sha,
    create_tx_hash: createTx,
    create_receipt_status: createReceipt.statusName || String(createReceipt.status),
    submit_tx_hash: submitTx,
    created_at: new Date().toISOString(),
    submit_receipt: {
      status_name: statusName,
      result_name: resultName,
      execution_result: execResult,
      votes: submitReceipt.consensus_data?.votes || {},
      leader_receipt: submitReceipt.consensus_data?.leader_receipt || [],
    },
    on_chain_submission: subRecord,
    packet_sha256: subRecord.packet_sha256 || null,
  };

  const recordPath = path.join(gateDir, `${fixtureId.toLowerCase()}_run_${runNum}.json`);
  fs.writeFileSync(recordPath, JSON.stringify(record, null, 2), 'utf8');
  console.log(`  Saved record to ${recordPath}`);

  const labels = subRecord.criterion_results || [];
  const verdict = subRecord.verdict;
  const payoutPct = subRecord.payout_pct !== undefined ? Number(subRecord.payout_pct) : null;
  console.log(`  Result: Verdict=${verdict}, Payout=${payoutPct}%, Labels=${JSON.stringify(labels)}`);

  return {
    success: true,
    fixtureId,
    runIndex,
    execResult,
    labelVector: labels,
    verdict,
    payoutPct,
    receipt: submitReceipt,
  };
}

async function main() {
  await ensureCredits();

  const allResults = { F1: [], F4: [], F5: [] };

  for (const fId of ['F1', 'F4', 'F5']) {
    console.log(`\n====================================================`);
    console.log(`STARTING 10 RUNS FOR ${fId}`);
    console.log(`====================================================`);
    for (let i = 1; i <= 10; i++) {
      const res = await runSingle(fId, i);
      allResults[fId].push(res);
    }
  }

  console.log("\n====================================================");
  console.log("V3.1 GATE BATCH COMPLETE - COMPUTING METRICS");
  console.log("====================================================");

  const evaluation = {};
  let overallPass = true;

  for (const fId of ['F1', 'F4', 'F5']) {
    const list = allResults[fId];
    const successes = list.filter(r => r.success);
    const failures = list.filter(r => !r.success);
    const reliabilityPct = (successes.length / list.length) * 100;

    // Tally verdicts & payouts
    const cfg = fixtureConfigs[fId];
    const outcomeMatches = successes.filter(
      r => r.verdict === cfg.expectedVerdict && r.payoutPct === cfg.expectedPayoutPct
    ).length;

    // Tally label vectors
    const vectorCounts = {};
    for (const s of successes) {
      const vKey = JSON.stringify(s.labelVector);
      vectorCounts[vKey] = (vectorCounts[vKey] || 0) + 1;
    }
    let modalVector = null;
    let modalCount = 0;
    for (const [vKey, cnt] of Object.entries(vectorCounts)) {
      if (cnt > modalCount) {
        modalVector = vKey;
        modalCount = cnt;
      }
    }

    const successGate = (successes.length >= 9) ? "PASS" : "FAIL";
    const outcomeGate = (outcomeMatches >= 9) ? "PASS" : "FAIL";
    const fixturePass = (successGate === "PASS" && outcomeGate === "PASS");

    if (!fixturePass) {
      overallPass = false;
    }

    evaluation[fId] = {
      attempts: list.length,
      successes: successes.length,
      failures: failures.length,
      reliabilityPct,
      expectedVerdict: cfg.expectedVerdict,
      expectedPayoutPct: cfg.expectedPayoutPct,
      outcomeMatches,
      modalVector,
      modalVectorCount: modalCount,
      successGate,
      outcomeGate,
      overall: fixturePass ? "PASS" : "FAIL",
    };

    console.log(`\nFixture ${fId}:`);
    console.log(`  Attempts:         ${list.length}`);
    console.log(`  Successes:        ${successes.length}/10 (${reliabilityPct}%) -> ${successGate}`);
    console.log(`  Outcome Matches:  ${outcomeMatches}/10 (expected ${cfg.expectedVerdict}, ${cfg.expectedPayoutPct}%) -> ${outcomeGate}`);
    console.log(`  Modal Labels:     ${modalVector} (${modalCount}/10) [REPORTED, NOT GATE]`);
    console.log(`  Fixture Result:   ${fixturePass ? "PASS" : "FAIL"}`);
  }

  const finalDecision = overallPass ? "ADOPT_V3_1" : "REJECT_V3_1_KEEP_V2_1";

  const summary = {
    executedAt: new Date().toISOString(),
    escrowAddress,
    evaluation,
    gateDecision: finalDecision,
    adopted: overallPass,
  };

  const summaryPath = path.join(gateDir, 'gate_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`\nGate summary written to ${summaryPath}`);

  console.log("\n====================================================");
  console.log(`OVERALL V3.1 GATE DECISION: ${finalDecision}`);
  console.log("====================================================");
}

main().catch((err) => {
  console.error("FATAL in run_v3_1_gate_batch:", err);
  process.exit(1);
});

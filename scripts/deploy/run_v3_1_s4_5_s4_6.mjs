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
const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
const escrowAddress = deployments.escrow_address;
const repAddress = deployments.reputation_address;

console.log("==================================================================");
console.log("STAGE 3 (PART 2): SECTION 4 CASES S4-5 & S4-6 VERIFICATION SUITE");
console.log(`ShipEscrowV3_1 Address: ${escrowAddress}`);
console.log(`ShipReputation Address: ${repAddress}`);
console.log("==================================================================");

const evidenceDir = path.join(__dirname, '../../docs/evidence_v3_1');
const snapshotsDir = path.join(evidenceDir, 'snapshots');
fs.mkdirSync(snapshotsDir, { recursive: true });

const client = createClient({ chain: chains.studionet });
const creatorAccount = createAccount(env.CREATOR_PRIVATE_KEY);
const devAccount = createAccount(env.DEV_PRIVATE_KEY);
const attackerAccount = createAccount(env.ATTACKER_PRIVATE_KEY);
const dev3Account = createAccount(env.DEV3_PRIVATE_KEY);

const creatorClient = createClient({ chain: chains.studionet, account: creatorAccount });
const devClient = createClient({ chain: chains.studionet, account: devAccount });
const attackerClient = createClient({ chain: chains.studionet, account: attackerAccount });
const dev3Client = createClient({ chain: chains.studionet, account: dev3Account });

const accounts = {
  creator: creatorAccount.address,
  dev: devAccount.address,
  attacker: attackerAccount.address,
  dev3: dev3Account.address,
};

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

async function sendTx(actClient, address, functionName, args, label) {
  await sleep(7500); // >= 7s spacing
  console.log(`\n>>> [${label}] Calling ${functionName}(${args.map(a => typeof a === 'string' && a.length > 30 ? a.substring(0, 30) + '...' : a).join(', ')})`);
  const txHash = await actClient.writeContract({
    address,
    functionName,
    args,
  });
  console.log(`    Tx Hash: ${txHash}`);
  const receipt = await waitForTx(txHash, label);
  return { txHash, receipt };
}

async function snapshot(label, bountyId = null) {
  const balances = {};
  for (const [name, addr] of Object.entries(accounts)) {
    const bal = await client.readContract({
      address: escrowAddress,
      functionName: 'get_balance',
      args: [addr],
    });
    balances[name] = Number(bal);
  }
  let bounty = null;
  if (bountyId) {
    try {
      const bRaw = await client.readContract({
        address: escrowAddress,
        functionName: 'get_bounty',
        args: [String(bountyId)],
      });
      bounty = typeof bRaw === 'string' ? JSON.parse(bRaw) : bRaw;
    } catch (err) {
      bounty = null;
    }
  }
  let invariant = null;
  try {
    const invRaw = await client.readContract({
      address: escrowAddress,
      functionName: 'get_ledger_invariant',
      args: [],
    });
    invariant = typeof invRaw === 'string' ? JSON.parse(invRaw) : invRaw;
  } catch (err) {
    invariant = null;
  }
  const snap = {
    timestamp: new Date().toISOString(),
    label,
    bounty_id: bountyId,
    bounty,
    balances,
    ledger_invariant: invariant,
  };
  const snapPath = path.join(snapshotsDir, `${label}.json`);
  fs.writeFileSync(snapPath, JSON.stringify(snap, null, 2), 'utf8');
  console.log(`  [Snapshot] Saved ${label}.json: creator=${balances.creator}, dev=${balances.dev}, attacker=${balances.attacker}, dev3=${balances.dev3}`);
  return snap;
}

function saveReceipt(name, receipt) {
  const filePath = path.join(evidenceDir, `${name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(receipt, null, 2));
  console.log(`  [Receipt] Saved ${name}.json`);
}

async function main() {
  const fixturesPath = path.join(__dirname, '../../docs/evidence_v3/fixtures_v3.json');
  const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));

  const crit1 = JSON.stringify([
    { description: "Implement slugify in src/slug.py", importance: "MUST" }
  ]);

  // =========================================================================
  // CASE S4-5: Sybil Attribution & Unbound Submission Defense
  // =========================================================================
  console.log("\n====================================================");
  console.log("CASE S4-5: Sybil Attribution & Unbound Submission Defense");
  console.log("====================================================");

  // 1. Creator creates fresh bounty for S4-5
  const s4_5Create = await sendTx(creatorClient, escrowAddress, 'create_bounty', ["hypercybers99/ship-escrow-fixtures", 100, crit1, "[]"], "s4_5_create");
  saveReceipt('s4_5_create_receipt', s4_5Create.receipt);

  const recentsRawS4_5 = await client.readContract({ address: escrowAddress, functionName: 'list_bounties', args: [1] });
  const bListS4_5 = typeof recentsRawS4_5 === 'string' ? JSON.parse(recentsRawS4_5) : recentsRawS4_5;
  const bS4_5 = bListS4_5[bListS4_5.length - 1];

  await snapshot("s4_5_before_submits", bS4_5);

  // 2. Attacker submits PR #17 (which carries Dev's trailer) -> REVERTS
  console.log("\n--- S4-5 Step 1: Attacker submits Dev's PR #17 ---");
  const s4_5Att1 = await sendTx(attackerClient, escrowAddress, 'submit_work', [bS4_5, fixtures.F1.pr_url, fixtures.F1.head_sha], "s4_5_attacker_attempt1");
  saveReceipt('s4_5_attacker_attempt1_receipt', s4_5Att1.receipt);
  await snapshot("s4_5_after_attacker_attempt1_no_debit", bS4_5);

  // 3. Dev3 submits PR #24 (which carries Attacker's trailer) -> REVERTS
  console.log("\n--- S4-5 Step 2: Dev3 submits Attacker's PR #24 ---");
  const s4_5Att2 = await sendTx(dev3Client, escrowAddress, 'submit_work', [bS4_5, fixtures.F8.pr_url, fixtures.F8.head_sha], "s4_5_dev3_attempt2");
  saveReceipt('s4_5_dev3_attempt2_receipt', s4_5Att2.receipt);
  await snapshot("s4_5_after_dev3_attempt2_no_debit", bS4_5);

  // 4. Attacker copies PR #17 head again -> REVERTS
  console.log("\n--- S4-5 Step 3: Attacker copies PR #17 head again ---");
  const s4_5Att3 = await sendTx(attackerClient, escrowAddress, 'submit_work', [bS4_5, fixtures.F1.pr_url, fixtures.F1.head_sha], "s4_5_attacker_attempt3_copy");
  saveReceipt('s4_5_attacker_attempt3_copy_receipt', s4_5Att3.receipt);
  await snapshot("s4_5_after_attacker_attempt3_no_debit", bS4_5);

  // 5. Genuine Developer (Dev) submits genuine PR #17 -> SETTLED (RELEASE_100)
  console.log("\n--- S4-5 Step 4: Genuine Developer submits PR #17 -> SETTLED ---");
  const s4_5DevSettle = await sendTx(devClient, escrowAddress, 'submit_work', [bS4_5, fixtures.F1.pr_url, fixtures.F1.head_sha], "s4_5_dev_settle");
  saveReceipt('s4_5_dev_settle_receipt', s4_5DevSettle.receipt);
  await snapshot("s4_5_after_dev_settle", bS4_5);

  // =========================================================================
  // CASE S4-6: Submission Bond Accounting Invariants (Release & Refund Traces)
  // =========================================================================
  console.log("\n====================================================");
  console.log("CASE S4-6: Submission Bond Accounting Invariants");
  console.log("====================================================");

  // --- TRACE 1: RELEASE Flow (Bond Returned to Developer) ---
  console.log("\n--- S4-6 Trace 1: RELEASE Flow (Bond Returned) ---");
  const s4_6RelCreate = await sendTx(creatorClient, escrowAddress, 'create_bounty', ["hypercybers99/ship-escrow-fixtures", 100, crit1, "[]"], "s4_6_release_create");
  saveReceipt('s4_6a_release_create_receipt', s4_6RelCreate.receipt);

  const recentsRawS4_6a = await client.readContract({ address: escrowAddress, functionName: 'list_bounties', args: [1] });
  const bListS4_6a = typeof recentsRawS4_6a === 'string' ? JSON.parse(recentsRawS4_6a) : recentsRawS4_6a;
  const bS4_6a = bListS4_6a[bListS4_6a.length - 1];

  await snapshot("s4_6a_release_before", bS4_6a);

  const s4_6RelSubmit = await sendTx(devClient, escrowAddress, 'submit_work', [bS4_6a, fixtures.F1.pr_url, fixtures.F1.head_sha], "s4_6a_release_submit");
  saveReceipt('s4_6a_release_receipt', s4_6RelSubmit.receipt);
  await snapshot("s4_6a_release_after", bS4_6a);

  // --- TRACE 2: REFUND Flow (Bond Forfeited to Creator) ---
  console.log("\n--- S4-6 Trace 2: REFUND Flow (Bond Forfeited to Creator) ---");
  const s4_6RefCreate = await sendTx(creatorClient, escrowAddress, 'create_bounty', ["hypercybers99/ship-escrow-fixtures", 100, crit1, JSON.stringify(["src/slug.py"])], "s4_6_refund_create");
  saveReceipt('s4_6b_refund_create_receipt', s4_6RefCreate.receipt);

  const recentsRawS4_6b = await client.readContract({ address: escrowAddress, functionName: 'list_bounties', args: [1] });
  const bListS4_6b = typeof recentsRawS4_6b === 'string' ? JSON.parse(recentsRawS4_6b) : recentsRawS4_6b;
  const bS4_6b = bListS4_6b[bListS4_6b.length - 1];

  await snapshot("s4_6b_refund_before", bS4_6b);

  const s4_6RefSubmit = await sendTx(devClient, escrowAddress, 'submit_work', [bS4_6b, fixtures.F2.pr_url, fixtures.F2.head_sha], "s4_6b_refund_submit");
  saveReceipt('s4_6b_refund_receipt', s4_6RefSubmit.receipt);
  await snapshot("s4_6b_refund_after", bS4_6b);

  // Final Invariant Check
  const invariantRaw = await client.readContract({
    address: escrowAddress,
    functionName: 'get_ledger_invariant',
    args: [],
  });
  const invariant = typeof invariantRaw === 'string' ? JSON.parse(invariantRaw) : invariantRaw;
  console.log("\n====================================================");
  console.log("S4-6 FINAL LEDGER INVARIANT:", invariant);
  console.log("====================================================");
  fs.writeFileSync(path.join(evidenceDir, 's4_6_ledger_invariant.json'), JSON.stringify(invariant, null, 2), 'utf8');

  // Generate Section 4 Table Summary File
  const s4Summary = {
    executed_at: new Date().toISOString(),
    escrow_address: escrowAddress,
    cases: {
      S4_5: {
        bounty_id: bS4_5,
        attacker_attempt1_tx: s4_5Att1.txHash,
        dev3_attempt2_tx: s4_5Att2.txHash,
        attacker_attempt3_tx: s4_5Att3.txHash,
        dev_settle_tx: s4_5DevSettle.txHash,
      },
      S4_6: {
        trace1_release: {
          bounty_id: bS4_6a,
          tx: s4_6RelSubmit.txHash,
        },
        trace2_refund: {
          bounty_id: bS4_6b,
          tx: s4_6RefSubmit.txHash,
        },
        ledger_invariant: invariant,
      }
    }
  };
  fs.writeFileSync(path.join(evidenceDir, 'section4_proofs_summary.json'), JSON.stringify(s4Summary, null, 2), 'utf8');
  console.log(`Saved section4_proofs_summary.json`);
}

main().catch(err => {
  console.error("FATAL in run_v3_1_s4_5_s4_6:", err);
  process.exit(1);
});

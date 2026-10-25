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

console.log("==================================================================");
console.log("STAGE 3: S4-3 EXHAUSTION & ESCROW REFUND FLOW");
console.log(`ShipEscrowV3_1 Address: ${escrowAddress}`);
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

async function ensureCredits() {
  console.log("\nEnsuring demo credits for dev3...");
  const claimed = await client.readContract({
    address: escrowAddress,
    functionName: 'has_claimed_demo',
    args: [accounts.dev3],
  });
  if (!claimed) {
    console.log("Claiming demo credits for dev3...");
    const { receipt } = await sendTx(dev3Client, escrowAddress, 'claim_demo_credits', [], 'claim_dev3');
    saveReceipt('claim_dev3_receipt', receipt);
  }
}

async function main() {
  await ensureCredits();

  const fixturesPath = path.join(__dirname, '../../docs/evidence_v3/fixtures_v3.json');
  const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));

  const crit1 = JSON.stringify([
    { description: "Implement slugify in src/slug.py", importance: "MUST" }
  ]);

  // Create bounty for exhaustion
  console.log("\n--- Creating Bounty for Exhaustion ---");
  const bExhaustCreate = await sendTx(creatorClient, escrowAddress, 'create_bounty', ["hypercybers99/ship-escrow-fixtures", 100, crit1, JSON.stringify(["src/slug.py"])], "exhaust_create");
  saveReceipt('s4_3_create_receipt', bExhaustCreate.receipt);

  const recentsRaw = await client.readContract({ address: escrowAddress, functionName: 'list_bounties', args: [1] });
  const bList = typeof recentsRaw === 'string' ? JSON.parse(recentsRaw) : recentsRaw;
  const bExhaust = bList[bList.length - 1];

  await snapshot("s4_3_before_exhaustion", bExhaust);

  // Dev 1: Attempt 1 -> PR #18 (F2 missing path -> REFUND, attempts=1, dev1_attempts=1)
  console.log("\n--- Dev 1 Attempt 1 (PR #18 -> REFUND) ---");
  const att1 = await sendTx(devClient, escrowAddress, 'submit_work', [bExhaust, fixtures.F2.pr_url, fixtures.F2.head_sha], "s4_3_dev1_att1");
  saveReceipt('s4_3_dev1_att1_receipt', att1.receipt);
  await snapshot("s4_3_after_dev1_att1", bExhaust);

  // Dev 1: Attempt 2 -> PR #19 (F3 deleted test -> REVIEW, attempts=2, dev1_attempts=2)
  console.log("\n--- Dev 1 Attempt 2 (PR #19 -> REVIEW) ---");
  const att2 = await sendTx(devClient, escrowAddress, 'submit_work', [bExhaust, fixtures.F3.pr_url, fixtures.F3.head_sha], "s4_3_dev1_att2");
  saveReceipt('s4_3_dev1_att2_receipt', att2.receipt);
  await snapshot("s4_3_after_dev1_att2", bExhaust);

  // Dev 1: Attempt 3 -> REFUSED (Developer attempt limit reached!)
  console.log("\n--- Dev 1 Attempt 3 Refusal ---");
  const att3Refused = await sendTx(devClient, escrowAddress, 'submit_work', [bExhaust, fixtures.F1.pr_url, fixtures.F1.head_sha], "s4_3_dev1_att3_refused");
  saveReceipt('s4_3_dev1_refused_receipt', att3Refused.receipt);
  await snapshot("s4_3_after_dev1_refused_no_debit", bExhaust);

  // Dev 2 (Attacker): Attempt 1 -> PR #29 (S4_EXHAUST_D2_1 -> attempts=3, dev2_attempts=1)
  console.log("\n--- Dev 2 (Attacker) Attempt 1 (PR #29) ---");
  const d2Att1 = await sendTx(attackerClient, escrowAddress, 'submit_work', [bExhaust, fixtures.S4_EXHAUST_D2_1.pr_url, fixtures.S4_EXHAUST_D2_1.head_sha], "s4_3_dev2_att1");
  saveReceipt('s4_3_dev2_att1_receipt', d2Att1.receipt);
  await snapshot("s4_3_after_dev2_att1", bExhaust);

  // Dev 2 (Attacker): Attempt 2 -> PR #30 (S4_EXHAUST_D2_2 -> attempts=4, dev2_attempts=2)
  console.log("\n--- Dev 2 (Attacker) Attempt 2 (PR #30) ---");
  const d2Att2 = await sendTx(attackerClient, escrowAddress, 'submit_work', [bExhaust, fixtures.S4_EXHAUST_D2_2.pr_url, fixtures.S4_EXHAUST_D2_2.head_sha], "s4_3_dev2_att2");
  saveReceipt('s4_3_dev2_att2_receipt', d2Att2.receipt);
  await snapshot("s4_3_after_dev2_att2", bExhaust);

  // Dev 3: Attempt 1 -> PR #31 (S4_EXHAUST_D3_1 -> attempts=5, dev3_attempts=1)
  console.log("\n--- Dev 3 Attempt 1 (PR #31) ---");
  const d3Att1 = await sendTx(dev3Client, escrowAddress, 'submit_work', [bExhaust, fixtures.S4_EXHAUST_D3_1.pr_url, fixtures.S4_EXHAUST_D3_1.head_sha], "s4_3_dev3_att1");
  saveReceipt('s4_3_dev3_att1_receipt', d3Att1.receipt);
  await snapshot("s4_3_after_dev3_att1", bExhaust);

  // Dev 3: Attempt 2 -> PR #32 (S4_EXHAUST_D3_2 -> attempts=6 -> EXHAUSTED!)
  console.log("\n--- Dev 3 Attempt 2 (PR #32 -> EXHAUSTED) ---");
  const d3Att2 = await sendTx(dev3Client, escrowAddress, 'submit_work', [bExhaust, fixtures.S4_EXHAUST_D3_2.pr_url, fixtures.S4_EXHAUST_D3_2.head_sha], "s4_3_dev3_att2_exhaust");
  saveReceipt('s4_3_dev3_att2_receipt', d3Att2.receipt);
  await snapshot("s4_3_after_bounty_exhausted", bExhaust);

  // Creator calls refund_exhausted
  console.log("\n--- Creator Calls refund_exhausted ---");
  const refundTx = await sendTx(creatorClient, escrowAddress, 'refund_exhausted', [bExhaust], "s4_3_refund_exhausted");
  saveReceipt('s4_3_refund_receipt', refundTx.receipt);
  await snapshot("s4_3_after_refund_exhausted", bExhaust);

  console.log("\n==================================================================");
  console.log("EXHAUSTION & REFUND FLOW COMPLETED SUCCESSFULLY");
  console.log("==================================================================");
}

main().catch(err => {
  console.error("FATAL in run_v3_1_exhaustion:", err);
  process.exit(1);
});

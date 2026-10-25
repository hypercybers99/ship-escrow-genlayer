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
console.log("STAGE 3: V3.1 REPUTATION SYNC & REFUSAL SUITE");
console.log(`ShipEscrowV3_1 Address: ${escrowAddress}`);
console.log(`ShipReputation Address: ${repAddress}`);
console.log("==================================================================");

const evidenceDir = path.join(__dirname, '../../docs/evidence_v3_1');
const client = createClient({ chain: chains.studionet });
const devAccount = createAccount(env.DEV_PRIVATE_KEY);
const devClient = createClient({ chain: chains.studionet, account: devAccount });

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
  console.log(`\n>>> [${label}] Calling ${functionName}(${args.join(', ')})`);
  const txHash = await actClient.writeContract({
    address,
    functionName,
    args,
  });
  console.log(`    Tx Hash: ${txHash}`);
  const receipt = await waitForTx(txHash, label);
  return { txHash, receipt };
}

function saveReceipt(name, receipt) {
  const filePath = path.join(evidenceDir, `${name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(receipt, null, 2));
  console.log(`  [Receipt] Saved ${name}.json`);
}

async function main() {
  // Bounty IDs from earlier scenarios:
  // Bounty 31 was F1 (100% payout, settled)
  // Bounty 34 was F4 (75% payout, settled)
  const bF1 = "31";
  const bF4 = "34";

  console.log(`\n1. Verifying settlement status on Escrow for Bounty ${bF1} and ${bF4}...`);
  const sF1Raw = await client.readContract({ address: escrowAddress, functionName: 'get_settlement', args: [bF1] });
  const sF1 = typeof sF1Raw === 'string' ? JSON.parse(sF1Raw) : sF1Raw;
  console.log(`   Bounty ${bF1} settlement: verdict=${sF1.verdict}, payout_pct=${sF1.payout_pct}, dev=${sF1.dev}`);

  const sF4Raw = await client.readContract({ address: escrowAddress, functionName: 'get_settlement', args: [bF4] });
  const sF4 = typeof sF4Raw === 'string' ? JSON.parse(sF4Raw) : sF4Raw;
  console.log(`   Bounty ${bF4} settlement: verdict=${sF4.verdict}, payout_pct=${sF4.payout_pct}, dev=${sF4.dev}`);

  // 1. Sync Bounty 31 (F1: 100% payout) with min_payout_pct = 100 -> SUCCESS
  console.log(`\n2. Syncing Bounty ${bF1} with min_payout_pct = 100...`);
  const sync1 = await sendTx(devClient, repAddress, 'sync', [bF1, 100], "reputation_sync_b1");
  saveReceipt('reputation_sync_b1_receipt', sync1.receipt);

  // 2. Refusal: Sync Bounty 34 (F4: 75% payout) with min_payout_pct = 100 -> REVERTS
  console.log(`\n3. Testing refusal: Syncing Bounty ${bF4} (75% payout) with min_payout_pct = 100...`);
  const sync4Refused = await sendTx(devClient, repAddress, 'sync', [bF4, 100], "reputation_sync_b4_refused");
  saveReceipt('reputation_sync_b4_refused_receipt', sync4Refused.receipt);

  // 3. Accepted: Sync Bounty 34 with min_payout_pct = 50 -> SUCCESS
  console.log(`\n4. Syncing Bounty ${bF4} with min_payout_pct = 50...`);
  const sync4Accepted = await sendTx(devClient, repAddress, 'sync', [bF4, 50], "reputation_sync_b4_accept");
  saveReceipt('reputation_sync_b4_accept_receipt', sync4Accepted.receipt);

  // 4. Duplicate sync refusal on Bounty 31 -> REVERTS
  console.log(`\n5. Testing duplicate sync refusal on Bounty ${bF1}...`);
  const sync1Dup = await sendTx(devClient, repAddress, 'sync', [bF1, 100], "reputation_sync_b1_dup");
  saveReceipt('reputation_sync_b1_dup_receipt', sync1Dup.receipt);

  // 5. Test is_settled_for view on escrow contract
  console.log("\n6. Verifying is_settled_for view on Escrow contract...");
  const isSettledValid = await client.readContract({
    address: escrowAddress,
    functionName: 'is_settled_for',
    args: [bF1, sF1.criteria_hash, sF1.head_sha, sF1.dev, 100]
  });
  console.log(`   escrow.is_settled_for(bounty=${bF1}, genuine params) = ${isSettledValid}`);

  const isSettledWrongSha = await client.readContract({
    address: escrowAddress,
    functionName: 'is_settled_for',
    args: [bF1, sF1.criteria_hash, "0000000000000000000000000000000000000000", sF1.dev, 100]
  });
  console.log(`   escrow.is_settled_for(bounty=${bF1}, wrong sha) = ${isSettledWrongSha}`);

  // 6. Test dev score on reputation contract
  console.log("\n7. Querying developer score on Reputation contract...");
  const devScore = await client.readContract({
    address: repAddress,
    functionName: 'get_dev_score',
    args: [devAccount.address],
  });
  console.log(`   reputation.get_dev_score(${devAccount.address}) = ${devScore}`);

  // 7. Check final ledger invariant
  const inv = await client.readContract({
    address: escrowAddress,
    functionName: 'get_ledger_invariant',
    args: [],
  });
  console.log("\n==================================================================");
  console.log("FINAL LEDGER INVARIANT:", inv);
  console.log("==================================================================");
  fs.writeFileSync(path.join(evidenceDir, 'final_ledger_invariant.json'), JSON.stringify(typeof inv === 'string' ? JSON.parse(inv) : inv, null, 2), 'utf8');

  console.log("\nREPUTATION SYNC SUITE COMPLETE");
}

main().catch(err => {
  console.error("FATAL in run_v3_1_reputation_sync:", err);
  process.exit(1);
});

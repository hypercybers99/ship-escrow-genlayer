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
console.log("STAGE 3: V3.1 SCENARIO & SECTION 4 VERIFICATION SUITE");
console.log(`ShipEscrowV3_1 Address: ${escrowAddress}`);
console.log(`ShipReputation Address: ${repAddress}`);
console.log("==================================================================");

// Target output dirs
const evidenceDir = path.join(__dirname, '../../docs/evidence_v3_1');
const scenariosDir = path.join(evidenceDir, 'scenarios');
const snapshotsDir = path.join(evidenceDir, 'snapshots');
fs.mkdirSync(scenariosDir, { recursive: true });
fs.mkdirSync(snapshotsDir, { recursive: true });

const client = createClient({ chain: chains.studionet });
const creatorAccount = createAccount(env.CREATOR_PRIVATE_KEY);
const devAccount = createAccount(env.DEV_PRIVATE_KEY);
const attackerAccount = createAccount(env.ATTACKER_PRIVATE_KEY);

const creatorClient = createClient({ chain: chains.studionet, account: creatorAccount });
const devClient = createClient({ chain: chains.studionet, account: devAccount });
const attackerClient = createClient({ chain: chains.studionet, account: attackerAccount });

const accounts = {
  creator: creatorAccount.address,
  dev: devAccount.address,
  attacker: attackerAccount.address,
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
  console.log(`  [Snapshot] Saved ${label}.json: creator=${balances.creator}, dev=${balances.dev}, attacker=${balances.attacker}`);
  return snap;
}

function saveReceipt(name, receipt) {
  const filePath = path.join(evidenceDir, `${name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(receipt, null, 2), 'utf8');
  console.log(`  [Receipt] Saved ${name}.json`);
}

async function ensureCredits() {
  console.log("\nEnsuring demo credits for all participants...");
  for (const [name, actClient] of [['creator', creatorClient], ['dev', devClient], ['attacker', attackerClient]]) {
    const claimed = await client.readContract({
      address: escrowAddress,
      functionName: 'has_claimed_demo',
      args: [accounts[name]],
    });
    if (!claimed) {
      console.log(`Claiming credits for ${name}...`);
      const { receipt } = await sendTx(actClient, escrowAddress, 'claim_demo_credits', [], `claim_${name}`);
      saveReceipt(`claim_${name}_receipt`, receipt);
    }
  }
}

const crit3 = JSON.stringify([
  { description: "Implement slugify in src/slug.py", importance: "MUST" },
  { description: "Add unit tests in tests/test_slug.py", importance: "MUST" },
  { description: "Update README with usage example", importance: "SHOULD" }
]);

const crit1 = JSON.stringify([
  { description: "Implement slugify in src/slug.py", importance: "MUST" }
]);

async function main() {
  await ensureCredits();
  await snapshot("initial_state");

  // Read fixtures
  const fixturesPath = path.join(__dirname, '../../docs/evidence_v3/fixtures_v3.json');
  const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));

  // =========================================================================
  // SCENARIO F1: Clean Full Release (PR #17) -> RELEASE_100 (100%)
  // =========================================================================
  console.log("\n====================================================");
  console.log("SCENARIO F1: Clean Full Release (PR #17)");
  console.log("====================================================");
  const f1Create = await sendTx(creatorClient, escrowAddress, 'create_bounty', ["hypercybers99/ship-escrow-fixtures", 100, crit3, "[]"], "f1_create");
  saveReceipt('f1_create_receipt', f1Create.receipt);

  const recentsRaw1 = await client.readContract({ address: escrowAddress, functionName: 'list_bounties', args: [1] });
  const bList1 = typeof recentsRaw1 === 'string' ? JSON.parse(recentsRaw1) : recentsRaw1;
  const bF1 = bList1[bList1.length - 1];

  await snapshot("f1_before_submit", bF1);
  const f1Submit = await sendTx(devClient, escrowAddress, 'submit_work', [bF1, fixtures.F1.pr_url, fixtures.F1.head_sha], "f1_submit");
  saveReceipt('f1_submit_receipt', f1Submit.receipt);
  await snapshot("f1_after_submit", bF1);

  // =========================================================================
  // SCENARIO F2: Trap Missing Required Path (PR #18) -> REFUND
  // =========================================================================
  console.log("\n====================================================");
  console.log("SCENARIO F2: Trap Missing Required Path (PR #18)");
  console.log("====================================================");
  const f2Create = await sendTx(creatorClient, escrowAddress, 'create_bounty', ["hypercybers99/ship-escrow-fixtures", 100, crit1, JSON.stringify(["src/slug.py"])], "f2_create");
  saveReceipt('f2_create_receipt', f2Create.receipt);
  const recentsRaw2 = await client.readContract({ address: escrowAddress, functionName: 'list_bounties', args: [1] });
  const bList2 = typeof recentsRaw2 === 'string' ? JSON.parse(recentsRaw2) : recentsRaw2;
  const bF2 = bList2[bList2.length - 1];

  await snapshot("f2_before_submit", bF2);
  const f2Submit = await sendTx(devClient, escrowAddress, 'submit_work', [bF2, fixtures.F2.pr_url, fixtures.F2.head_sha], "f2_submit");
  saveReceipt('f2_submit_receipt', f2Submit.receipt);
  await snapshot("f2_after_submit", bF2);

  // =========================================================================
  // SCENARIO F3: Trap Test File Deleted (PR #19) -> REVIEW
  // =========================================================================
  console.log("\n====================================================");
  console.log("SCENARIO F3: Trap Test File Deleted (PR #19)");
  console.log("====================================================");
  const f3Create = await sendTx(creatorClient, escrowAddress, 'create_bounty', ["hypercybers99/ship-escrow-fixtures", 100, crit1, "[]"], "f3_create");
  saveReceipt('f3_create_receipt', f3Create.receipt);
  const recentsRaw3 = await client.readContract({ address: escrowAddress, functionName: 'list_bounties', args: [1] });
  const bList3 = typeof recentsRaw3 === 'string' ? JSON.parse(recentsRaw3) : recentsRaw3;
  const bF3 = bList3[bList3.length - 1];

  await snapshot("f3_before_submit", bF3);
  const f3Submit = await sendTx(devClient, escrowAddress, 'submit_work', [bF3, fixtures.F3.pr_url, fixtures.F3.head_sha], "f3_submit");
  saveReceipt('f3_submit_receipt', f3Submit.receipt);
  await snapshot("f3_after_submit", bF3);

  // =========================================================================
  // SCENARIO F4: Partial Release (PR #20) -> RELEASE_75
  // =========================================================================
  console.log("\n====================================================");
  console.log("SCENARIO F4: Partial Release (PR #20)");
  console.log("====================================================");
  const f4Create = await sendTx(creatorClient, escrowAddress, 'create_bounty', ["hypercybers99/ship-escrow-fixtures", 100, crit3, "[]"], "f4_create");
  saveReceipt('f4_create_receipt', f4Create.receipt);
  const recentsRaw4 = await client.readContract({ address: escrowAddress, functionName: 'list_bounties', args: [1] });
  const bList4 = typeof recentsRaw4 === 'string' ? JSON.parse(recentsRaw4) : recentsRaw4;
  const bF4 = bList4[bList4.length - 1];

  await snapshot("f4_before_submit", bF4);
  const f4Submit = await sendTx(devClient, escrowAddress, 'submit_work', [bF4, fixtures.F4.pr_url, fixtures.F4.head_sha], "f4_submit");
  saveReceipt('f4_submit_receipt', f4Submit.receipt);
  await snapshot("f4_after_submit", bF4);

  // =========================================================================
  // SCENARIO F5: Prompt Injection / Malicious (PR #21) -> REFUND
  // =========================================================================
  console.log("\n====================================================");
  console.log("SCENARIO F5: Prompt Injection Defense (PR #21)");
  console.log("====================================================");
  const f5Create = await sendTx(creatorClient, escrowAddress, 'create_bounty', ["hypercybers99/ship-escrow-fixtures", 100, crit1, "[]"], "f5_create");
  saveReceipt('f5_create_receipt', f5Create.receipt);
  const recentsRaw5 = await client.readContract({ address: escrowAddress, functionName: 'list_bounties', args: [1] });
  const bList5 = typeof recentsRaw5 === 'string' ? JSON.parse(recentsRaw5) : recentsRaw5;
  const bF5 = bList5[bList5.length - 1];

  await snapshot("f5_before_submit", bF5);
  const f5Submit = await sendTx(devClient, escrowAddress, 'submit_work', [bF5, fixtures.F5.pr_url, fixtures.F5.head_sha], "f5_submit");
  saveReceipt('f5_submit_receipt', f5Submit.receipt);
  await snapshot("f5_after_submit", bF5);

  // =========================================================================
  // SCENARIO F6: Multi-Commit PR with Trailer (PR #22) -> RELEASE_100
  // =========================================================================
  console.log("\n====================================================");
  console.log("SCENARIO F6: Multi-Commit PR with Trailer (PR #22)");
  console.log("====================================================");
  const f6Create = await sendTx(creatorClient, escrowAddress, 'create_bounty', ["hypercybers99/ship-escrow-fixtures", 100, crit1, "[]"], "f6_create");
  saveReceipt('f6_create_receipt', f6Create.receipt);
  const recentsRaw6 = await client.readContract({ address: escrowAddress, functionName: 'list_bounties', args: [1] });
  const bList6 = typeof recentsRaw6 === 'string' ? JSON.parse(recentsRaw6) : recentsRaw6;
  const bF6 = bList6[bList6.length - 1];

  await snapshot("f6_before_submit", bF6);
  const f6Submit = await sendTx(devClient, escrowAddress, 'submit_work', [bF6, fixtures.F6.pr_url, fixtures.F6.head_sha], "f6_submit");
  saveReceipt('f6_submit_receipt', f6Submit.receipt);
  await snapshot("f6_after_submit", bF6);

  // =========================================================================
  // SCENARIO F7: Advancing Head Proof (PR #23: Stale Rejected -> Real Accepted)
  // =========================================================================
  console.log("\n====================================================");
  console.log("SCENARIO F7: Advancing Head Proof (PR #23: Stale -> Real)");
  console.log("====================================================");
  const f7Create = await sendTx(creatorClient, escrowAddress, 'create_bounty', ["hypercybers99/ship-escrow-fixtures", 100, crit1, "[]"], "f7_create");
  saveReceipt('f7_create_receipt', f7Create.receipt);
  const recentsRaw7 = await client.readContract({ address: escrowAddress, functionName: 'list_bounties', args: [1] });
  const bList7 = typeof recentsRaw7 === 'string' ? JSON.parse(recentsRaw7) : recentsRaw7;
  const bF7 = bList7[bList7.length - 1];

  await snapshot("f7_before_stale_submit", bF7);
  // Stale submit: commit c2361819688b5e9e0486c8f94672624ee4e300fc (stale head of PR #23)
  const staleSha = "c2361819688b5e9e0486c8f94672624ee4e300fc";
  const f7StaleSubmit = await sendTx(devClient, escrowAddress, 'submit_work', [bF7, fixtures.F7.pr_url, staleSha], "f7_stale_submit");
  saveReceipt('f7_stale_submit_receipt', f7StaleSubmit.receipt);
  // PROOF OF NO DEBIT: state unchanged, 0 credits debited, 0 attempts consumed
  await snapshot("f7_after_stale_submit_no_debit", bF7);

  // Real head submit: commit 9971bc3f28d8b1393699c717cf0742f36f3db5dc
  const f7RealSubmit = await sendTx(devClient, escrowAddress, 'submit_work', [bF7, fixtures.F7.pr_url, fixtures.F7.head_sha], "f7_real_submit");
  saveReceipt('f7_real_submit_receipt', f7RealSubmit.receipt);
  await snapshot("f7_after_real_submit_settled", bF7);

  // =========================================================================
  // SCENARIO F8: Wrong Wallet Marker Rejection (PR #24)
  // =========================================================================
  console.log("\n====================================================");
  console.log("SCENARIO F8: Wrong Wallet Marker Rejection (PR #24)");
  console.log("====================================================");
  const f8Create = await sendTx(creatorClient, escrowAddress, 'create_bounty', ["hypercybers99/ship-escrow-fixtures", 100, crit1, "[]"], "f8_create");
  saveReceipt('f8_create_receipt', f8Create.receipt);
  const recentsRaw8 = await client.readContract({ address: escrowAddress, functionName: 'list_bounties', args: [1] });
  const bList8 = typeof recentsRaw8 === 'string' ? JSON.parse(recentsRaw8) : recentsRaw8;
  const bF8 = bList8[bList8.length - 1];

  await snapshot("f8_before_submit", bF8);
  const f8Submit = await sendTx(devClient, escrowAddress, 'submit_work', [bF8, fixtures.F8.pr_url, fixtures.F8.head_sha], "f8_submit_wrong_wallet");
  saveReceipt('f8_submit_receipt', f8Submit.receipt);
  await snapshot("f8_after_submit_no_debit", bF8);

  // =========================================================================
  // SCENARIO F9: No Wallet Marker Rejection (PR #25)
  // =========================================================================
  console.log("\n====================================================");
  console.log("SCENARIO F9: No Wallet Marker Rejection (PR #25)");
  console.log("====================================================");
  const f9Create = await sendTx(creatorClient, escrowAddress, 'create_bounty', ["hypercybers99/ship-escrow-fixtures", 100, crit1, "[]"], "f9_create");
  saveReceipt('f9_create_receipt', f9Create.receipt);
  const recentsRaw9 = await client.readContract({ address: escrowAddress, functionName: 'list_bounties', args: [1] });
  const bList9 = typeof recentsRaw9 === 'string' ? JSON.parse(recentsRaw9) : recentsRaw9;
  const bF9 = bList9[bList9.length - 1];

  await snapshot("f9_before_submit", bF9);
  const f9Submit = await sendTx(devClient, escrowAddress, 'submit_work', [bF9, fixtures.F9.pr_url, fixtures.F9.head_sha], "f9_submit_no_marker");
  saveReceipt('f9_submit_receipt', f9Submit.receipt);
  await snapshot("f9_after_submit_no_debit", bF9);

  // =========================================================================
  // SCENARIO F10: Closed PR Rejection (PR #35) -> "Pull request is not open"
  // =========================================================================
  console.log("\n====================================================");
  console.log("SCENARIO F10: Closed PR Rejection (PR #35)");
  console.log("====================================================");
  const f10Create = await sendTx(creatorClient, escrowAddress, 'create_bounty', ["hypercybers99/ship-escrow-fixtures", 100, crit1, "[]"], "f10_create");
  saveReceipt('f10_create_receipt', f10Create.receipt);
  const recentsRaw10 = await client.readContract({ address: escrowAddress, functionName: 'list_bounties', args: [1] });
  const bList10 = typeof recentsRaw10 === 'string' ? JSON.parse(recentsRaw10) : recentsRaw10;
  const bF10 = bList10[bList10.length - 1];

  await snapshot("f10_before_submit", bF10);
  const f10Submit = await sendTx(devClient, escrowAddress, 'submit_work', [bF10, "https://github.com/hypercybers99/ship-escrow-fixtures/pull/35", "4e5b30a25b1bd75c9aa97ea39842ba3cb751fbf7"], "f10_submit_closed_pr");
  saveReceipt('f10_submit_receipt', f10Submit.receipt);
  await snapshot("f10_after_submit_no_debit", bF10);

  // =========================================================================
  // SCENARIO F11: Merged PR Rejection (PR #36) -> "Pull request is not open"
  // =========================================================================
  console.log("\n====================================================");
  console.log("SCENARIO F11: Merged PR Rejection (PR #36)");
  console.log("====================================================");
  const f11Create = await sendTx(creatorClient, escrowAddress, 'create_bounty', ["hypercybers99/ship-escrow-fixtures", 100, crit1, "[]"], "f11_create");
  saveReceipt('f11_create_receipt', f11Create.receipt);
  const recentsRaw11 = await client.readContract({ address: escrowAddress, functionName: 'list_bounties', args: [1] });
  const bList11 = typeof recentsRaw11 === 'string' ? JSON.parse(recentsRaw11) : recentsRaw11;
  const bF11 = bList11[bList11.length - 1];

  await snapshot("f11_before_submit", bF11);
  const f11Submit = await sendTx(devClient, escrowAddress, 'submit_work', [bF11, "https://github.com/hypercybers99/ship-escrow-fixtures/pull/36", "8d957d3fe336c64ed6bf9fc1aa69ed21fe0de994"], "f11_submit_merged_pr");
  saveReceipt('f11_submit_receipt', f11Submit.receipt);
  await snapshot("f11_after_submit_no_debit", bF11);

  // =========================================================================
  // SCENARIO F12: Oversize Diff Truncation (PR #28)
  // =========================================================================
  console.log("\n====================================================");
  console.log("SCENARIO F12: Oversize Diff Truncation (PR #28)");
  console.log("====================================================");
  const f12Create = await sendTx(creatorClient, escrowAddress, 'create_bounty', ["hypercybers99/ship-escrow-fixtures", 100, crit1, "[]"], "f12_create");
  saveReceipt('f12_create_receipt', f12Create.receipt);
  const recentsRaw12 = await client.readContract({ address: escrowAddress, functionName: 'list_bounties', args: [1] });
  const bList12 = typeof recentsRaw12 === 'string' ? JSON.parse(recentsRaw12) : recentsRaw12;
  const bF12 = bList12[bList12.length - 1];

  await snapshot("f12_before_submit", bF12);
  const f12Submit = await sendTx(devClient, escrowAddress, 'submit_work', [bF12, fixtures.F12.pr_url, fixtures.F12.head_sha], "f12_submit");
  saveReceipt('f12_submit_receipt', f12Submit.receipt);
  await snapshot("f12_after_submit", bF12);

  // =========================================================================
  // DUPLICATE GUARD ON OPEN BOUNTY
  // =========================================================================
  console.log("\n====================================================");
  console.log("DUPLICATE GUARD ON OPEN BOUNTY");
  console.log("====================================================");
  // Bounty F2 is open (attempt 1 had missing path). Dev submits F2 head again!
  await snapshot("dup_before_submit", bF2);
  const dupSubmit = await sendTx(devClient, escrowAddress, 'submit_work', [bF2, fixtures.F2.pr_url, fixtures.F2.head_sha], "dup_guard_submit");
  saveReceipt('case_dup_guard_receipt', dupSubmit.receipt);
  await snapshot("dup_after_submit_no_debit", bF2);

  // =========================================================================
  // SECTION 4 CASES (S4-1 to S4-6)
  // =========================================================================
  console.log("\n====================================================");
  console.log("SECTION 4: SECURITY & FLOW VERIFICATIONS");
  console.log("====================================================");

  // S4-1: SHA Poisoning Defense (attacker tries to submit random invalid sha on F1 PR)
  console.log("\n--- S4-1: SHA Poisoning Defense ---");
  await snapshot("s4_1_before_attack", bF1);
  const s4_1 = await sendTx(attackerClient, escrowAddress, 'submit_work', [bF1, fixtures.F1.pr_url, "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef"], "s4_1_sha_poisoning");
  saveReceipt('s4_1_sha_poisoning_receipt', s4_1.receipt);
  await snapshot("s4_1_after_attack_no_debit", bF1);

  // S4-2: Legitimate Recovery Flow (Dev submits F2 trap -> REFUND; then submits F1 clean -> SETTLED)
  console.log("\n--- S4-2: Legitimate Recovery Flow ---");
  const s4_2Create = await sendTx(creatorClient, escrowAddress, 'create_bounty', ["hypercybers99/ship-escrow-fixtures", 100, crit1, "[]"], "s4_2_create");
  saveReceipt('s4_2_create_receipt', s4_2Create.receipt);
  const recentsRawS4_2 = await client.readContract({ address: escrowAddress, functionName: 'list_bounties', args: [1] });
  const bListS4_2 = typeof recentsRawS4_2 === 'string' ? JSON.parse(recentsRawS4_2) : recentsRawS4_2;
  const bS4_2 = bListS4_2[bListS4_2.length - 1];

  await snapshot("s4_2_before_flawed_submit", bS4_2);
  // Attempt 1: flawed (F5 injection -> REFUND, open)
  const s4_2Att1 = await sendTx(devClient, escrowAddress, 'submit_work', [bS4_2, fixtures.F5.pr_url, fixtures.F5.head_sha], "s4_2_att1_flawed");
  saveReceipt('s4_2_att1_receipt', s4_2Att1.receipt);
  await snapshot("s4_2_after_flawed_submit", bS4_2);

  // Attempt 2: recovery (F1 clean -> SETTLED)
  const s4_2Att2 = await sendTx(devClient, escrowAddress, 'submit_work', [bS4_2, fixtures.F1.pr_url, fixtures.F1.head_sha], "s4_2_att2_recovery");
  saveReceipt('s4_2_att2_receipt', s4_2Att2.receipt);
  await snapshot("s4_2_after_recovery_settled", bS4_2);

  // S4-4: Copied Submission Defense (Attacker copies Dev's PR URL and submits with own wallet)
  console.log("\n--- S4-4: Copied Submission Defense ---");
  const s4_4Create = await sendTx(creatorClient, escrowAddress, 'create_bounty', ["hypercybers99/ship-escrow-fixtures", 100, crit1, "[]"], "s4_4_create");
  saveReceipt('s4_4_create_receipt', s4_4Create.receipt);
  const recentsRawS4_4 = await client.readContract({ address: escrowAddress, functionName: 'list_bounties', args: [1] });
  const bListS4_4 = typeof recentsRawS4_4 === 'string' ? JSON.parse(recentsRawS4_4) : recentsRawS4_4;
  const bS4_4 = bListS4_4[bListS4_4.length - 1];

  await snapshot("s4_4_before_attack", bS4_4);
  const s4_4Attack = await sendTx(attackerClient, escrowAddress, 'submit_work', [bS4_4, fixtures.F1.pr_url, fixtures.F1.head_sha], "s4_4_copied_attack");
  saveReceipt('s4_4_copied_attack_receipt', s4_4Attack.receipt);
  await snapshot("s4_4_after_attack_no_debit", bS4_4);

  // =========================================================================
  // REPUTATION SYNC & REFUSALS
  // =========================================================================
  console.log("\n====================================================");
  console.log("REPUTATION SYNC & REFUSAL SUITE");
  console.log("====================================================");
  // Sync Bounty F1 (100% payout) with min_payout_pct = 100
  const repSyncF1 = await sendTx(devClient, repAddress, 'sync_settlement', [bF1, 100], "reputation_sync_f1");
  saveReceipt('reputation_sync_f1_receipt', repSyncF1.receipt);

  // Refusal: Sync Bounty F4 (75% payout) with min_payout_pct = 100 -> Reverts
  const repSyncRefused = await sendTx(devClient, repAddress, 'sync_settlement', [bF4, 100], "reputation_sync_refused_below_min");
  saveReceipt('reputation_sync_refused_receipt', repSyncRefused.receipt);

  // Accepted: Sync Bounty F4 with min_payout_pct = 50 -> Success
  const repSyncF4 = await sendTx(devClient, repAddress, 'sync_settlement', [bF4, 50], "reputation_sync_f4");
  saveReceipt('reputation_sync_f4_receipt', repSyncF4.receipt);

  // Duplicate sync refusal on Bounty F1 -> Reverts
  const repSyncDup = await sendTx(devClient, repAddress, 'sync_settlement', [bF1, 100], "reputation_sync_duplicate");
  saveReceipt('reputation_sync_dup_receipt', repSyncDup.receipt);

  // Check is_settled_for
  const isSettledF1 = await client.readContract({ address: repAddress, functionName: 'is_settled_for', args: [bF1] });
  const isSettledFake = await client.readContract({ address: repAddress, functionName: 'is_settled_for', args: ["99999"] });
  console.log(`  reputation.is_settled_for(bF1 = ${bF1}): ${isSettledF1}`);
  console.log(`  reputation.is_settled_for("99999"): ${isSettledFake}`);

  // Developer score
  const devScore = await client.readContract({ address: repAddress, functionName: 'get_developer_score', args: [accounts.dev] });
  console.log(`  reputation.get_developer_score(dev):`, devScore);

  // Final invariant
  const finalInvariant = await client.readContract({ address: escrowAddress, functionName: 'get_ledger_invariant', args: [] });
  console.log("\n====================================================");
  console.log("FINAL LEDGER INVARIANT:", finalInvariant);
  console.log("====================================================");

  fs.writeFileSync(path.join(evidenceDir, 'final_ledger_invariant.json'), JSON.stringify(finalInvariant, null, 2), 'utf8');
}

main().catch(err => {
  console.error("FATAL in run_v3_1_scenarios:", err);
  process.exit(1);
});

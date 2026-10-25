import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createClient, chains, createAccount } from 'genlayer-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env
const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const k = trimmed.substring(0, idx).trim();
      const v = trimmed.substring(idx + 1).trim();
      process.env[k] = v;
    }
  }
}

const client = createClient({ chain: chains.studionet });
const devKey = process.env.DEV_PRIVATE_KEY;
if (!devKey) throw new Error("DEV_PRIVATE_KEY missing from .env");
const account = createAccount(devKey);

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function waitForTx(txHash, label) {
  console.log(`Waiting for ${label} tx ${txHash}...`);
  for (let attempt = 1; attempt <= 80; attempt++) {
    await sleep(3000);
    try {
      const tx = await client.getTransaction({ hash: txHash });
      const statusName = tx.statusName || String(tx.status);
      const execRes = tx.consensus_data?.leader_receipt?.[0]?.execution_result;
      const resultName = tx.result_name || String(tx.result);
      if (statusName === 'ACCEPTED' || statusName === 'FINALIZED') {
        console.log(`[${label}] Done: status=${statusName}, result=${resultName}, exec=${execRes}`);
        return tx;
      }
    } catch (err) {
      // transient network poll warning
    }
  }
  throw new Error(`Timeout waiting for tx ${txHash}`);
}

async function main() {
  console.log("==================================================================");
  console.log("STAGE 3: DEPLOYING SHIP ESCROW V3 & BOUND REPUTATION TO STUDIONET");
  console.log("==================================================================");

  const evidenceDir = path.join(__dirname, '../../docs/evidence_v3');
  const sourceDir = path.join(evidenceDir, 'source');
  fs.mkdirSync(sourceDir, { recursive: true });

  // 1. Check line endings and load ShipEscrowV3.py
  const escrowPath = path.join(__dirname, '../../contracts/ShipEscrowV3.py');
  const escrowRawBytes = fs.readFileSync(escrowPath);
  const escrowCrlf = (escrowRawBytes.toString('binary').match(/\r\n/g) || []).length;
  if (escrowCrlf > 0) {
    throw new Error(`ShipEscrowV3.py has ${escrowCrlf} CRLF line endings; must be LF-normalized`);
  }
  const escrowCode = fs.readFileSync(escrowPath, 'utf8');
  const escrowLocalSha256 = crypto.createHash('sha256').update(escrowCode, 'utf8').digest('hex');
  console.log("Local ShipEscrowV3 sha256:", escrowLocalSha256);

  // Deploy ShipEscrowV3
  console.log("\nDeploying ShipEscrowV3...");
  const t0 = Date.now();
  const escrowDeployTx = await client.deployContract({
    account,
    code: escrowCode,
    args: []
  });
  console.log("ShipEscrowV3 Deploy Tx Hash:", escrowDeployTx);

  const escrowReceipt = await waitForTx(escrowDeployTx, "Deploy ShipEscrowV3");
  const escrowElapsed = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`Deploy completed in ${escrowElapsed}s`);

  const escrowAddress = escrowReceipt.data?.contract_address || escrowReceipt.recipient;
  const escrowLeaderReceipt = escrowReceipt.consensus_data?.leader_receipt?.[0];
  console.log("Deployed ShipEscrowV3 Address:", escrowAddress);

  if (!escrowAddress || escrowLeaderReceipt?.execution_result !== 'SUCCESS') {
    throw new Error("ShipEscrowV3 deployment failed: " + JSON.stringify(escrowReceipt));
  }

  fs.writeFileSync(
    path.join(evidenceDir, 'deploy_ship_escrow_v3_receipt.json'),
    JSON.stringify(escrowReceipt, null, 2)
  );

  // 2. Deploy ShipReputation bound to new escrow
  console.log("\n--- Deploying ShipReputation (bound to V3 Escrow) ---");
  const repPath = path.join(__dirname, '../../contracts/ShipReputationV2.py');
  const repRawBytes = fs.readFileSync(repPath);
  const repCrlf = (repRawBytes.toString('binary').match(/\r\n/g) || []).length;
  if (repCrlf > 0) {
    throw new Error(`ShipReputationV2.py has ${repCrlf} CRLF line endings; must be LF-normalized`);
  }
  const repCode = fs.readFileSync(repPath, 'utf8');
  const repLocalSha256 = crypto.createHash('sha256').update(repCode, 'utf8').digest('hex');
  console.log("Local ShipReputation sha256:", repLocalSha256);

  await sleep(7500); // 7.5s pacing
  const t1 = Date.now();
  const repDeployTx = await client.deployContract({
    account,
    code: repCode,
    args: [escrowAddress]
  });
  console.log("ShipReputation Deploy Tx Hash:", repDeployTx);

  const repReceipt = await waitForTx(repDeployTx, "Deploy ShipReputation");
  const repElapsed = ((Date.now() - t1) / 1000).toFixed(2);
  console.log(`Deploy completed in ${repElapsed}s`);

  const repAddress = repReceipt.data?.contract_address || repReceipt.recipient;
  const repLeaderReceipt = repReceipt.consensus_data?.leader_receipt?.[0];
  console.log("Deployed ShipReputation Address:", repAddress);

  if (!repAddress || repLeaderReceipt?.execution_result !== 'SUCCESS') {
    throw new Error("ShipReputation deployment failed: " + JSON.stringify(repReceipt));
  }

  fs.writeFileSync(
    path.join(evidenceDir, 'deploy_ship_reputation_v3_receipt.json'),
    JSON.stringify(repReceipt, null, 2)
  );

  // Deployments record
  const deploymentsV3 = {
    network: "GenLayer Studionet",
    chainId: 61999,
    rpc: "https://studio.genlayer.com/api",
    explorerBase: "https://explorer-studio.genlayer.com",
    deployedAt: new Date().toISOString(),
    escrow: {
      contractAddress: escrowAddress,
      deployTxHash: escrowDeployTx,
      statusName: escrowReceipt.statusName || String(escrowReceipt.status),
      resultName: escrowReceipt.result_name || String(escrowReceipt.result),
      executionResult: escrowLeaderReceipt.execution_result,
      sourceFile: "contracts/ShipEscrowV3.py",
      sourceSha256: escrowLocalSha256,
      explorerUrl: `https://explorer-studio.genlayer.com/address/${escrowAddress}`,
    },
    reputation: {
      contractAddress: repAddress,
      deployTxHash: repDeployTx,
      statusName: repReceipt.statusName || String(repReceipt.status),
      resultName: repReceipt.result_name || String(repReceipt.result),
      executionResult: repLeaderReceipt.execution_result,
      sourceFile: "contracts/ShipReputationV2.py",
      sourceSha256: repLocalSha256,
      explorerUrl: `https://explorer-studio.genlayer.com/address/${repAddress}`,
      escrowAddress: escrowAddress,
    },
  };

  fs.writeFileSync(path.join(__dirname, 'deployments_v3.json'), JSON.stringify(deploymentsV3, null, 2));

  // 3. Source Verification (decode deploy tx payload from studionet)
  console.log("\n==================================================================");
  console.log("DECODING DEPLOY TX PAYLOAD & VERIFYING BYTE-FOR-BYTE SOURCE");
  console.log("==================================================================");

  async function verifyTx(name, txHash, localCode, expectedSha) {
    console.log(`\nVerifying on-chain source for ${name}...`);
    const rpcRes = await fetch("https://studio.genlayer.com/api", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionByHash',
        params: [txHash],
      }),
    });
    const rpcJson = await rpcRes.json();
    const b64 = rpcJson.result?.data?.contract_code;
    if (!b64) {
      throw new Error(`No data.contract_code in tx ${txHash}`);
    }
    const decoded = Buffer.from(b64, 'base64').toString('utf8');
    const onchainSha = crypto.createHash('sha256').update(decoded, 'utf8').digest('hex');
    const isMatch = (onchainSha === expectedSha && decoded === localCode);
    console.log(`  Deploy tx hash: ${txHash}`);
    console.log(`  Local sha256:   ${expectedSha}`);
    console.log(`  On-chain sha256:${onchainSha}`);
    console.log(`  Byte-for-byte exact match: ${isMatch}`);

    return {
      txData: rpcJson.result,
      decodedSource: decoded,
      verification: {
        contract: name,
        deployTxHash: txHash,
        localSha256: expectedSha,
        onchainSha256: onchainSha,
        byteIdentical: isMatch,
        diffEmpty: (decoded === localCode),
      }
    };
  }

  const verEscrow = await verifyTx('ShipEscrowV3', escrowDeployTx, escrowCode, escrowLocalSha256);
  const verRep = await verifyTx('ShipReputationV3', repDeployTx, repCode, repLocalSha256);

  fs.writeFileSync(path.join(sourceDir, 'shipescrowv3_deploy_tx.json'), JSON.stringify(verEscrow.txData, null, 2));
  fs.writeFileSync(path.join(sourceDir, 'shipescrowv3_onchain.py'), verEscrow.decodedSource);
  fs.writeFileSync(path.join(sourceDir, 'shipreputationv3_deploy_tx.json'), JSON.stringify(verRep.txData, null, 2));
  fs.writeFileSync(path.join(sourceDir, 'shipreputationv3_onchain.py'), verRep.decodedSource);
  fs.writeFileSync(path.join(sourceDir, 'source_verification_summary.json'), JSON.stringify({
    escrow: verEscrow.verification,
    reputation: verRep.verification,
  }, null, 2));

  console.log("\nSaved decoded source artifacts under docs/evidence_v3/source/");
  console.log(`Deployed Pair: Escrow=${escrowAddress}, Reputation=${repAddress}`);
}

main().catch(err => {
  console.error("Deploy/Verify failed:", err);
  process.exit(1);
});

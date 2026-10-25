import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const evidenceDir = path.join(__dirname, '../../docs/evidence_v3_1');
const sourceDir = path.join(evidenceDir, 'source');
fs.mkdirSync(sourceDir, { recursive: true });

const escrowAddress = '0x00B2EAD4d361DF5A80Bb111d9D98b8f44EB6E59e';
const escrowDeployTx = '0xe2415522e46708d3f20f9eaec2dbb33a2f6132e4d3e0fc12afd17dd819d35c55';
const repAddress = '0x6F95d9DD35D1e19A85D9aB7c467F8660f89954AC';
const repDeployTx = '0x65a5bc3899a179ccd26a4cee83314102d05659913290bf5ba2978fc2316f8141';

async function verifyTx(name, txHash, localFile) {
  const localCode = fs.readFileSync(localFile, 'utf8');
  const localSha = crypto.createHash('sha256').update(localCode, 'utf8').digest('hex');

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
  if (!b64) throw new Error(`No data.contract_code in tx ${txHash}`);
  const decoded = Buffer.from(b64, 'base64').toString('utf8');
  const onchainSha = crypto.createHash('sha256').update(decoded, 'utf8').digest('hex');
  const isMatch = (onchainSha === localSha && decoded === localCode);

  console.log(`\nVerifying ${name}:`);
  console.log(`  Deploy tx hash: ${txHash}`);
  console.log(`  Local sha256:   ${localSha}`);
  console.log(`  On-chain sha256:${onchainSha}`);
  console.log(`  Byte-for-byte exact match: ${isMatch}`);

  return {
    txData: rpcJson.result,
    decodedSource: decoded,
    verification: {
      contract: name,
      deployTxHash: txHash,
      localFile: localFile.replace(/\\/g, '/'),
      localSha256: localSha,
      onchainSha256: onchainSha,
      byteIdentical: isMatch,
      diffEmpty: (decoded === localCode),
    }
  };
}

async function main() {
  const escrowPath = path.join(__dirname, '../../contracts/ShipEscrowV3_1.py');
  const repPath = path.join(__dirname, '../../contracts/ShipReputationV2.py');

  const verEscrow = await verifyTx('ShipEscrowV3_1', escrowDeployTx, escrowPath);
  const verRep = await verifyTx('ShipReputationV2', repDeployTx, repPath);

  fs.writeFileSync(path.join(sourceDir, 'shipescrowv3_1_deploy_tx.json'), JSON.stringify(verEscrow.txData, null, 2));
  fs.writeFileSync(path.join(sourceDir, 'shipescrowv3_1_onchain.py'), verEscrow.decodedSource);
  fs.writeFileSync(path.join(sourceDir, 'shipreputationv3_1_deploy_tx.json'), JSON.stringify(verRep.txData, null, 2));
  fs.writeFileSync(path.join(sourceDir, 'shipreputationv3_1_onchain.py'), verRep.decodedSource);
  fs.writeFileSync(path.join(sourceDir, 'source_verification_summary.json'), JSON.stringify({
    escrow: verEscrow.verification,
    reputation: verRep.verification,
  }, null, 2));

  const deploymentsData = {
    network: "GenLayer Studionet",
    chainId: 61999,
    rpc: "https://studio.genlayer.com/api",
    explorerBase: "https://explorer-studio.genlayer.com",
    deployedAt: new Date().toISOString(),
    escrow_address: escrowAddress,
    escrow_deploy_tx: escrowDeployTx,
    escrow_source_sha256: verEscrow.verification.onchainSha256,
    reputation_address: repAddress,
    reputation_deploy_tx: repDeployTx,
    reputation_source_sha256: verRep.verification.onchainSha256,
  };

  fs.writeFileSync(path.join(__dirname, 'deployments_v3_1.json'), JSON.stringify(deploymentsData, null, 2));

  console.log("\n==================================================================");
  console.log("DEPLOYMENT & ON-CHAIN SOURCE VERIFICATION COMPLETE");
  console.log(`ShipEscrowV3_1 Address: ${escrowAddress}`);
  console.log(`ShipReputation Address: ${repAddress}`);
  console.log("==================================================================");
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});

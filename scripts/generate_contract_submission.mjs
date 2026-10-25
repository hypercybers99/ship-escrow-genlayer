import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const deploymentsPath = path.join(__dirname, 'deploy/deployments_v3_1.json');
const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));

const contractPath = 'contracts/ShipEscrowV3_1.py';
const contractFile = path.join(__dirname, '../', contractPath);
const contractBytes = fs.readFileSync(contractFile);
const contractSha256 = crypto.createHash('sha256').update(contractBytes).digest('hex');

const onchainFile = path.join(__dirname, '../docs/evidence_v3_1/source/shipescrowv3_1_onchain.py');
const onchainBytes = fs.readFileSync(onchainFile);
const onchainSha256 = crypto.createHash('sha256').update(onchainBytes).digest('hex');

const repPath = 'contracts/ShipReputationV2.py';
const repFile = path.join(__dirname, '../', repPath);
const repBytes = fs.readFileSync(repFile);
const repSha256 = crypto.createHash('sha256').update(repBytes).digest('hex');

const repOnchainFile = path.join(__dirname, '../docs/evidence_v3_1/source/shipreputationv3_1_onchain.py');
const repOnchainBytes = fs.readFileSync(repOnchainFile);
const repOnchainSha256 = crypto.createHash('sha256').update(repOnchainBytes).digest('hex');

let diffOutput = '';
try {
  diffOutput = execSync(`git diff --no-index contracts/ShipEscrowV3_1.py docs/evidence_v3_1/source/shipescrowv3_1_onchain.py`, {
    encoding: 'utf8',
    cwd: path.join(__dirname, '..')
  });
} catch (e) {
  diffOutput = e.stdout || e.message;
}

let repDiffOutput = '';
try {
  repDiffOutput = execSync(`git diff --no-index contracts/ShipReputationV2.py docs/evidence_v3_1/source/shipreputationv3_1_onchain.py`, {
    encoding: 'utf8',
    cwd: path.join(__dirname, '..')
  });
} catch (e) {
  repDiffOutput = e.stdout || e.message;
}

const escrowAddr = deployments.escrow_address;
const deployTx = deployments.escrow_deploy_tx;
const repAddr = deployments.reputation_address;
const repDeployTx = deployments.reputation_deploy_tx;

const tag = 'se-v3-1-reliable-head';
const owner = 'hypercybers99';

const content = `# Ship Escrow V3.1 - Contract Submission Reference

> Status: **Preview**  
> Target Network: **GenLayer Studionet** (Chain ID: 61999)  
> Tag Reference: \`${tag}\`

---

## 1. Active Contract Coordinates

- **Contract Name**: \`ShipEscrowV3_1\`
- **Contract Address**: [\`${escrowAddr}\`](https://explorer-studio.genlayer.com/address/${escrowAddr})
- **Deployment Transaction**: [\`${deployTx}\`](https://explorer-studio.genlayer.com/tx/${deployTx})
- **Repository URL (at final tag)**: [https://github.com/${owner}/ship-escrow-genlayer/tree/${tag}](https://github.com/${owner}/ship-escrow-genlayer/tree/${tag})
- **Contract Source Path in Repo**: [\`${contractPath}\`](https://github.com/${owner}/ship-escrow-genlayer/blob/${tag}/${contractPath})
- **Explorer URL**: [https://explorer-studio.genlayer.com/address/${escrowAddr}](https://explorer-studio.genlayer.com/address/${escrowAddr})

---

## 2. Source Verification

- **Local Source SHA256**: \`${contractSha256}\`
- **On-Chain Deployed Source SHA256**: \`${onchainSha256}\`
- **Byte-for-Byte Exact Match**: \`${contractSha256 === onchainSha256}\`
- **Source Artifact Extracted From Deploy Tx**: \`docs/evidence_v3_1/source/shipescrowv3_1_onchain.py\`
- **Diff Output Against Local Source**:
  \`\`\`
  git diff --no-index contracts/ShipEscrowV3_1.py docs/evidence_v3_1/source/shipescrowv3_1_onchain.py
  ${diffOutput.trim() || '(empty diff - 100% byte-for-byte identical)'}
  \`\`\`

---

## 3. Companion Reputation Registry

- **Contract Name**: \`ShipReputation\`
- **Contract Address**: [\`${repAddr}\`](https://explorer-studio.genlayer.com/address/${repAddr})
- **Deployment Transaction**: [\`${repDeployTx}\`](https://explorer-studio.genlayer.com/tx/${repDeployTx})
- **Local Source SHA256**: \`${repSha256}\`
- **On-Chain Deployed Source SHA256**: \`${repOnchainSha256}\`
- **Byte-for-Byte Exact Match**: \`${repSha256 === repOnchainSha256}\`
- **Source Artifact Extracted From Deploy Tx**: \`docs/evidence_v3_1/source/shipreputationv3_1_onchain.py\`
- **Diff Output Against Local Source**:
  \`\`\`
  git diff --no-index contracts/ShipReputationV2.py docs/evidence_v3_1/source/shipreputationv3_1_onchain.py
  ${repDiffOutput.trim() || '(empty diff - 100% byte-for-byte identical)'}
  \`\`\`

---

## 4. Milestone 1 Candidate Reference (Tried, Not Adopted)

- **Candidate Escrow V3**: [\`0xDf8Adb520FeE510d8793bC5d01C7aF751A4fE772\`](https://explorer-studio.genlayer.com/address/0xDf8Adb520FeE510d8793bC5d01C7aF751A4fE772)
- **Candidate Reputation V3**: [\`0x31F0955Ad7bA06C1902d83B876308e5F125865dF\`](https://explorer-studio.genlayer.com/address/0x31F0955Ad7bA06C1902d83B876308e5F125865dF)
- **Status**: Tried, Not Adopted (F4 modal label agreement was 8/10, below >= 9/10 threshold; 100% reliability with 30/30 successful runs).
- **Candidate Source File**: \`contracts/candidates/ShipEscrowV3_labels_bound_not_adopted.py\`

---

## 5. Superseded Baseline Reference (V2.1)

- **Baseline Escrow V2.1**: [\`0x8a9c079a7E1F756e07e8FbE392a5E93106DE28bF\`](https://explorer-studio.genlayer.com/address/0x8a9c079a7E1F756e07e8FbE392a5E93106DE28bF)
- **Baseline Reputation V2.1**: [\`0x8e6D0356F4Bf987E95eB3cC6e7DF84ce2f708C81\`](https://explorer-studio.genlayer.com/address/0x8e6D0356F4Bf987E95eB3cC6e7DF84ce2f708C81)
- **Status**: Superseded by V3.1 upon gate adoption.
`;

const outPath = path.join(__dirname, '../docs/CONTRACT_SUBMISSION.md');
fs.writeFileSync(outPath, content, 'utf8');
console.log(`Generated CONTRACT_SUBMISSION.md at ${outPath}`);

# Ship Escrow V3.1 - Contract Submission Reference

> Status: **Preview**  
> Target Network: **GenLayer Studionet** (Chain ID: 61999)  
> Tag Reference: `se-v3-1-final`

---

## 1. Active Contract Coordinates

- **Contract Name**: `ShipEscrowV3_1`
- **Contract Address**: [`0x00B2EAD4d361DF5A80Bb111d9D98b8f44EB6E59e`](https://explorer-studio.genlayer.com/address/0x00B2EAD4d361DF5A80Bb111d9D98b8f44EB6E59e)
- **Deployment Transaction**: [`0xe2415522e46708d3f20f9eaec2dbb33a2f6132e4d3e0fc12afd17dd819d35c55`](https://explorer-studio.genlayer.com/tx/0xe2415522e46708d3f20f9eaec2dbb33a2f6132e4d3e0fc12afd17dd819d35c55)
- **Repository URL (at final tag)**: [https://github.com/hypercybers99/ship-escrow-genlayer/tree/se-v3-1-final](https://github.com/hypercybers99/ship-escrow-genlayer/tree/se-v3-1-final)
- **Contract Source Path in Repo**: [`contracts/ShipEscrowV3_1.py`](https://github.com/hypercybers99/ship-escrow-genlayer/blob/se-v3-1-final/contracts/ShipEscrowV3_1.py)
- **Explorer URL**: [https://explorer-studio.genlayer.com/address/0x00B2EAD4d361DF5A80Bb111d9D98b8f44EB6E59e](https://explorer-studio.genlayer.com/address/0x00B2EAD4d361DF5A80Bb111d9D98b8f44EB6E59e)

---

## 2. Source Verification

- **Local Source SHA256**: `9910f97c02cfbbb45b54295b7668ce44f52af7051a127d874843ecaa217158cf`
- **On-Chain Deployed Source SHA256**: `9910f97c02cfbbb45b54295b7668ce44f52af7051a127d874843ecaa217158cf`
- **Byte-for-Byte Exact Match**: `true`
- **Source Artifact Extracted From Deploy Tx**: `docs/evidence_v3_1/source/shipescrowv3_1_onchain.py`
- **Diff Output Against Local Source**:
  ```
  git diff --no-index contracts/ShipEscrowV3_1.py docs/evidence_v3_1/source/shipescrowv3_1_onchain.py
  (empty diff - 100% byte-for-byte identical)
  ```

---

## 3. Companion Reputation Registry

- **Contract Name**: `ShipReputation`
- **Contract Address**: [`0x6F95d9DD35D1e19A85D9aB7c467F8660f89954AC`](https://explorer-studio.genlayer.com/address/0x6F95d9DD35D1e19A85D9aB7c467F8660f89954AC)
- **Deployment Transaction**: [`0x65a5bc3899a179ccd26a4cee83314102d05659913290bf5ba2978fc2316f8141`](https://explorer-studio.genlayer.com/tx/0x65a5bc3899a179ccd26a4cee83314102d05659913290bf5ba2978fc2316f8141)
- **Local Source SHA256**: `12e4c5e9cf8f480823ff778181b6a0d50ae7d37ec7c3a5b079cf6275779d1ed7`
- **On-Chain Deployed Source SHA256**: `12e4c5e9cf8f480823ff778181b6a0d50ae7d37ec7c3a5b079cf6275779d1ed7`
- **Byte-for-Byte Exact Match**: `true`
- **Source Artifact Extracted From Deploy Tx**: `docs/evidence_v3_1/source/shipreputationv3_1_onchain.py`
- **Diff Output Against Local Source**:
  ```
  git diff --no-index contracts/ShipReputationV2.py docs/evidence_v3_1/source/shipreputationv3_1_onchain.py
  (empty diff - 100% byte-for-byte identical)
  ```

---

## 4. Milestone 1 Candidate Reference (Tried, Not Adopted)

- **Candidate Escrow V3**: [`0xDf8Adb520FeE510d8793bC5d01C7aF751A4fE772`](https://explorer-studio.genlayer.com/address/0xDf8Adb520FeE510d8793bC5d01C7aF751A4fE772)
- **Candidate Reputation V3**: [`0x31F0955Ad7bA06C1902d83B876308e5F125865dF`](https://explorer-studio.genlayer.com/address/0x31F0955Ad7bA06C1902d83B876308e5F125865dF)
- **Status**: Tried, Not Adopted (F4 modal label agreement was 8/10, below >= 9/10 threshold; 100% reliability with 30/30 successful runs).
- **Candidate Source File**: `contracts/candidates/ShipEscrowV3_labels_bound_not_adopted.py`

---

## 5. Superseded Baseline Reference (V2.1)

- **Baseline Escrow V2.1**: [`0x8a9c079a7E1F756e07e8FbE392a5E93106DE28bF`](https://explorer-studio.genlayer.com/address/0x8a9c079a7E1F756e07e8FbE392a5E93106DE28bF)
- **Baseline Reputation V2.1**: [`0x8e6D0356F4Bf987E95eB3cC6e7DF84ce2f708C81`](https://explorer-studio.genlayer.com/address/0x8e6D0356F4Bf987E95eB3cC6e7DF84ce2f708C81)
- **Status**: Superseded by V3.1 upon gate adoption.

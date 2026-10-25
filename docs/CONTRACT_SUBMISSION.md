# Ship Escrow V2 - Contract Submission Reference

> Status: **Preview**  
> Target Network: **GenLayer Studionet** (Chain ID: 61999)  
> Tag Reference: `se-v2-4`

---

## 1. Active Contract Coordinates

- **Contract Name**: `ShipEscrowV2`
- **Contract Address**: [`0x8a9c079a7E1F756e07e8FbE392a5E93106DE28bF`](https://explorer-studio.genlayer.com/address/0x8a9c079a7E1F756e07e8FbE392a5E93106DE28bF)
- **Deployment Transaction**: [`0xa47ecee0c8108c12baf8a71acfb87ce3aff22ee2aa85d73bfa0e26a67d67d733`](https://explorer-studio.genlayer.com/tx/0xa47ecee0c8108c12baf8a71acfb87ce3aff22ee2aa85d73bfa0e26a67d67d733)
- **Repository URL (at final tag)**: [https://github.com/hypercybers99/ship-escrow-genlayer/tree/se-v2-4](https://github.com/hypercybers99/ship-escrow-genlayer/tree/se-v2-4)
- **Contract Source Path in Repo**: [`contracts/ShipEscrowV2.py`](https://github.com/hypercybers99/ship-escrow-genlayer/blob/se-v2-4/contracts/ShipEscrowV2.py)
- **Explorer URL**: [https://explorer-studio.genlayer.com/address/0x8a9c079a7E1F756e07e8FbE392a5E93106DE28bF](https://explorer-studio.genlayer.com/address/0x8a9c079a7E1F756e07e8FbE392a5E93106DE28bF)

---

## 2. Source Verification

- **Local Source SHA256**: `c00b1366e960882367bf1f3e3c99b975691c28cb29750b7e16a0646e5e353048`
- **On-Chain Deployed Source SHA256**: `c00b1366e960882367bf1f3e3c99b975691c28cb29750b7e16a0646e5e353048`
- **Byte-for-Byte Exact Match**: `true`
- **Source Artifact Extracted From Deploy Tx**: `docs/evidence_v2/source/shipescrowv2_onchain.py`
- **Diff Output Against Local Source**:
  ```
  git diff --no-index contracts/ShipEscrowV2.py docs/evidence_v2/source/shipescrowv2_onchain.py
  (empty diff - 100% byte-for-byte identical)
  ```

---

## 3. Companion Reputation Registry

- **Contract Name**: `ShipReputationV2`
- **Contract Address**: [`0x8e6D0356F4Bf987E95eB3cC6e7DF84ce2f708C81`](https://explorer-studio.genlayer.com/address/0x8e6D0356F4Bf987E95eB3cC6e7DF84ce2f708C81)
- **Deployment Transaction**: [`0x5046e6d602dac897980c852b651aa9ab44fea2a0a7762a7dd34523742f5a3b5c`](https://explorer-studio.genlayer.com/tx/0x5046e6d602dac897980c852b651aa9ab44fea2a0a7762a7dd34523742f5a3b5c)
- **Local Source SHA256**: `12e4c5e9cf8f480823ff778181b6a0d50ae7d37ec7c3a5b079cf6275779d1ed7`
- **On-Chain Deployed Source SHA256**: `12e4c5e9cf8f480823ff778181b6a0d50ae7d37ec7c3a5b079cf6275779d1ed7`
- **Byte-for-Byte Exact Match**: `true`
- **Source Artifact Extracted From Deploy Tx**: `docs/evidence_v2/source/shipreputationv2_onchain.py`

---

## 4. Milestone 1 Candidate Reference (Tried, Not Adopted)

- **ShipEscrowV3 Candidate**: [`0xDf8Adb520FeE510d8793bC5d01C7aF751A4fE772`](https://explorer-studio.genlayer.com/address/0xDf8Adb520FeE510d8793bC5d01C7aF751A4fE772)
- **ShipReputationV3 Candidate**: [`0x31F0955Ad7bA06C1902d83B876308e5F125865dF`](https://explorer-studio.genlayer.com/address/0x31F0955Ad7bA06C1902d83B876308e5F125865dF)
- **Evaluation Decision**: `REJECT_V3_KEEP_V2_1` (`docs/GATE_V3_DECISION.md`)
- **Active Contracts**: The active coordinates in Sections 1 and 3 remain unchanged.

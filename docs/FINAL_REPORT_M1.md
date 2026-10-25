# Ship Escrow Milestone 1 - Final Engineering Report

> Status: **Preview**  
> Active Deployment: **ShipEscrowV2 (`0x8a9c079a7E1F756e07e8FbE392a5E93106DE28bF`) & ShipReputationV2 (`0x8e6D0356F4Bf987E95eB3cC6e7DF84ce2f708C81`)**  
> Candidate V3 (Tried, Not Adopted): **ShipEscrowV3 (`0xDf8Adb520FeE510d8793bC5d01C7aF751A4fE772`) & ShipReputationV3 (`0x31F0955Ad7bA06C1902d83B876308e5F125865dF`)**  
> Network: **GenLayer Studionet** (Chain ID: 61999)  

---

## 1. Executive Summary

Milestone 1 targeted the primary measured bottleneck of Ship Escrow V2.1: **unauthenticated GitHub REST API rate limits on shared validator egress IPs** (`api.github.com`, 60 req/hr/IP limit), alongside the requirement to **bind individual criterion labels in validator consensus**.

### Key Deliverables & Outcomes

1. **Pre-Registration (Stage 0)**:
   - Committed [`docs/MILESTONE_V3_PLAN.md`](file:///E:/ShipEscrow_V2/docs/MILESTONE_V3_PLAN.md) and [`docs/EXPECTED_V3.md`](file:///E:/ShipEscrow_V2/docs/EXPECTED_V3.md) before contract code modifications.
   - Measured and recorded pre-V3 baseline state in [`docs/before_state_v3.json`](file:///E:/ShipEscrow_V2/docs/before_state_v3.json): 80 attempts, 53 successes, 27 failures (66.25% reliability), 100% of failures caused by unauthenticated REST rate limits.

2. **Validator Probe Protocol (Stage 1)**:
   - Deployed probe contract at [`0xf5256FB126c54719f99C027482220c24E281493b`](https://explorer-studio.genlayer.com/address/0xf5256FB126c54719f99C027482220c24E281493b).
   - Executed 40 sequential validator calls with measured minimum pacing of 7500 ms (average: 7507 ms).
   - Results: `info/refs` (40/40 200 OK), `.patch` (40/40 200 OK), `compare.diff` (40/40 200 OK), REST API contrast (34/40 200 OK, 6/40 403 Forbidden).
   - Parity across PRs #2–#8: 7/7 identical to stored V2.1 baseline.
   - Decision: **`GO`** recorded in [`docs/PROBE_V3_DECISION.md`](file:///E:/ShipEscrow_V2/docs/PROBE_V3_DECISION.md).

3. **Contract Implementation & Unit Tests (Stage 2)**:
   - Implemented `contracts/ShipEscrowV3.py` with LF line endings and strict consensus comparison of 8 fields including `criterion_results`.
   - Full test suite passed: **84 / 84 PASSED** (pure deterministic tests, mocked contract pipelines, and direct mode VM tests).

4. **Gate Batch Evaluation & Honest Decision (Stage 3)**:
   - Deployed candidate contracts on Studionet: `ShipEscrowV3` at [`0xDf8Adb520FeE510d8793bC5d01C7aF751A4fE772`](https://explorer-studio.genlayer.com/address/0xDf8Adb520FeE510d8793bC5d01C7aF751A4fE772) and `ShipReputationV3` at [`0x31F0955Ad7bA06C1902d83B876308e5F125865dF`](https://explorer-studio.genlayer.com/address/0x31F0955Ad7bA06C1902d83B876308e5F125865dF). Verified on-chain source byte-for-byte (`diffEmpty: true`).
   - Executed 30 live on-chain runs (10 each for F1, F4, F5) with pacing >= 8s.
   - **Execution Reliability**: 30 of 30 runs succeeded (**100.0% reliability**, 0 rate-limit reverts).
   - **Label Consensus Agreement**: F1 (10/10 `["YES","YES","YES"]`), F4 (8/10 `["YES","YES","NO"]`, 2/10 `["YES","PARTIAL","NO"]`), F5 (10/10 `["NO"]`).
   - **Gate Outcome**: Because F4 yielded 8/10 modal agreement instead of the pre-registered >= 9/10 threshold, the pre-registered rule strictly triggered: **`REJECT_V3_KEEP_V2_1`**.
   - **Rollout Action**: Rollout stopped; candidate V3 recorded as **"Tried, Not Adopted"**; **V2.1 contracts remain active**.

---

## 2. Before vs After Reliability Comparison

| Metric | Pre-V3 Combined Baseline | V3 Validator Probe | V3 Gate Batch |
|---|---|---|---|
| **Total Attempts** | 80 | 40 calls | 30 live runs |
| **Successful Runs** | 53 | 40 / 40 (100.0%) | 30 / 30 (**100.0%**) |
| **Reverts / Failures** | 27 | 0 (0.0%) | 0 (**0.0%**) |
| **Execution Reliability** | **66.25%** | **100.0%** | **100.0%** |
| **Rate Limit 403 Errors** | 27 | 0 on git endpoints (6 on REST) | **0** |
| **Consensus Binding** | 7 fields | N/A (read-only probe) | 8 fields (includes `criterion_results`) |

---

## 3. Validator Probe Results (40 Calls + Parity)

- **Probe Contract Address**: [`0xf5256FB126c54719f99C027482220c24E281493b`](https://explorer-studio.genlayer.com/address/0xf5256FB126c54719f99C027482220c24E281493b)
- **Deployment Transaction**: [`0x82c3b76d2b67dc71a7039b296a0f7268c6012dd1174eded99f3f32e45bd0db8d`](https://explorer-studio.genlayer.com/tx/0x82c3b76d2b67dc71a7039b296a0f7268c6012dd1174eded99f3f32e45bd0db8d)
- **Source SHA256**: `059e8ffb57008fc99d8daa8a71c281ca0ecb1a8da464faf10174bd18ce9c6f4a`
- **Measured Pacing**: Minimum 7500 ms, Average 7507 ms

### Endpoint Success Summary

| Endpoint Monitored | Total Calls | HTTP 200 Responses | Non-200 Errors | Reliability |
|---|---|---|---|---|
| **Item (a): `info/refs`** | 40 | 40 | 0 | **100.0%** |
| **Item (b): `pull/{n}.patch`** | 40 | 40 | 0 | **100.0%** |
| **Item (c): `compare.diff`** | 40 | 40 | 0 | **100.0%** |
| **Item (d): REST API Contrast** | 40 | 34 | 6 (HTTP 403) | **85.0%** |

### PR Parity Verification (#2 through #8)

| PR # | Fixture Meaning | Retrieved Head SHA | Stored V2.1 Base SHA | Parity Match |
|---|---|---|---|---|
| **PR #2** | Clean Release (F1) | `5db0441e76af93606fd82feebbe49c5a2f145326` | `9d3e8ada2d4c7ed38e6a7843e971df38f6ab4207` | **PASS** |
| **PR #3** | Trap: README Only (F2) | `73de6b568ca38717a2d6a62a14aa581c0bcc4e28b` | `9d3e8ada2d4c7ed38e6a7843e971df38f6ab4207` | **PASS** |
| **PR #4** | Trap: Test Deleted (F3) | `eaa9a2af9ccb0fa6d13b030a8f176c5235d15a982` | `9d3e8ada2d4c7ed38e6a7843e971df38f6ab4207` | **PASS** |
| **PR #5** | Partial Release (F4) | `73fbd168b09e75873472a9a2b186d17d30916b17` | `9d3e8ada2d4c7ed38e6a7843e971df38f6ab4207` | **PASS** |
| **PR #6** | Prompt Injection (F5) | `b9e099153ea3dd002fc3584a8078d68e974fa427` | `9d3e8ada2d4c7ed38e6a7843e971df38f6ab4207` | **PASS** |
| **PR #7** | Multi-Commit Head (F6) | `960fbf1ac0e73a099f4251512b5c2d569252ac39` | `9d3e8ada2d4c7ed38e6a7843e971df38f6ab4207` | **PASS** |
| **PR #8** | Advancing Head (F7) | `2332a887996496eed2f20ed63e2c3b51fefde204` | `9d3e8ada2d4c7ed38e6a7843e971df38f6ab4207` | **PASS** |

---

## 4. Gate Batch Results & Decision Record

- **ShipEscrowV3 Address**: [`0xDf8Adb520FeE510d8793bC5d01C7aF751A4fE772`](https://explorer-studio.genlayer.com/address/0xDf8Adb520FeE510d8793bC5d01C7aF751A4fE772)
- **Deploy Tx**: [`0xb6af9125becd43587d66bf1430f570c7d074c05e432b3a20155b8ed4f9b8222f`](https://explorer-studio.genlayer.com/tx/0xb6af9125becd43587d66bf1430f570c7d074c05e432b3a20155b8ed4f9b8222f)
- **Source SHA256**: `4d3a561d7309234436aa567116f95fd431f590a0ccb0d1d681639ec535728186`
- **ShipReputationV3 Address**: [`0x31F0955Ad7bA06C1902d83B876308e5F125865dF`](https://explorer-studio.genlayer.com/address/0x31F0955Ad7bA06C1902d83B876308e5F125865dF)
- **Deploy Tx**: [`0x2640f87b15949ae4dff0505a015f4696795f34496ab40843430a493f7cd73cef`](https://explorer-studio.genlayer.com/tx/0x2640f87b15949ae4dff0505a015f4696795f34496ab40843430a493f7cd73cef)
- **Source SHA256**: `12e4c5e9cf8f480823ff778181b6a0d50ae7d37ec7c3a5b079cf6275779d1ed7`
- **Gate Runs Evidence**: [`docs/evidence_v3/gate/`](file:///E:/ShipEscrow_V2/docs/evidence_v3/gate/)

### 30-Run Gate Summary

| Fixture | Attempts | Successes | Failures | Reliability | Modal Label Vector | Modal Agreement | Success Gate | Label Gate | Gate Result |
|---|---|---|---|---|---|---|---|---|---|
| **F1** | 10 | 10 | 0 | **100.0%** | `["YES","YES","YES"]` | 10/10 (100.0%) | PASS | PASS | **PASS** |
| **F4** | 10 | 10 | 0 | **100.0%** | `["YES","YES","NO"]` | 8/10 (80.0%) | PASS | FAIL | **FAIL** |
| **F5** | 10 | 10 | 0 | **100.0%** | `["NO"]` | 10/10 (100.0%) | PASS | PASS | **PASS** |
| **Total** | 30 | 30 | 0 | **100.0%** | — | — | PASS | FAIL | **`REJECT_V3_KEEP_V2_1`** |

### Individual Run Breakdown for F4

| Run Index | Bounty ID | On-Chain Verdict | Payout % | Consensus Bound Labels | Status |
|---|---|---|---|---|---|
| Run 01 | 11 | RELEASE_50 | 50% | `["YES","PARTIAL","NO"]` | SUCCESS |
| Run 02 | 12 | RELEASE_75 | 75% | `["YES","YES","NO"]` | SUCCESS |
| Run 03 | 13 | RELEASE_75 | 75% | `["YES","YES","NO"]` | SUCCESS |
| Run 04 | 14 | RELEASE_75 | 75% | `["YES","YES","NO"]` | SUCCESS |
| Run 05 | 15 | RELEASE_50 | 50% | `["YES","PARTIAL","NO"]` | SUCCESS |
| Run 06 | 16 | RELEASE_75 | 75% | `["YES","YES","NO"]` | SUCCESS |
| Run 07 | 17 | RELEASE_75 | 75% | `["YES","YES","NO"]` | SUCCESS |
| Run 08 | 18 | RELEASE_75 | 75% | `["YES","YES","NO"]` | SUCCESS |
| Run 09 | 19 | RELEASE_75 | 75% | `["YES","YES","NO"]` | SUCCESS |
| Run 10 | 20 | RELEASE_75 | 75% | `["YES","YES","NO"]` | SUCCESS |

---

## 5. Active Deployment Confirmation

As pre-registered in `docs/MILESTONE_V3_PLAN.md` and recorded in `docs/GATE_V3_DECISION.md`:
- V3 candidate contracts achieved 100% execution availability, completely eliminating unauthenticated IP rate limits.
- However, because the modal label consensus convergence on partial release fixture F4 was 8/10 (< 9/10), the pre-registered activation condition was not met.
- **Active deployment remains V2.1**:
  - **ShipEscrowV2**: [`0x8a9c079a7E1F756e07e8FbE392a5E93106DE28bF`](https://explorer-studio.genlayer.com/address/0x8a9c079a7E1F756e07e8FbE392a5E93106DE28bF)
  - **ShipReputationV2**: [`0x8e6D0356F4Bf987E95eB3cC6e7DF84ce2f708C81`](https://explorer-studio.genlayer.com/address/0x8e6D0356F4Bf987E95eB3cC6e7DF84ce2f708C81)
- The repo contracts directory maintains the active deployment source (`contracts/ShipEscrowV2.py` SHA256 `c00b1366e960882367bf1f3e3c99b975691c28cb29750b7e16a0646e5e353048`).

---

## 6. Hash Verification Table

Every address, commit SHA, and transaction hash in this report is matched against repository evidence artifacts:

| Entity Description | Identifier / Hash | Verified Evidence Source |
|---|---|---|
| **Active ShipEscrowV2** | `0x8a9c079a7E1F756e07e8FbE392a5E93106DE28bF` | `docs/ADDRESS_REGISTRY.md` |
| **Active ShipReputationV2** | `0x8e6D0356F4Bf987E95eB3cC6e7DF84ce2f708C81` | `docs/ADDRESS_REGISTRY.md` |
| **Active ShipEscrowV2 Deploy Tx** | `0xa47ecee0c8108c12baf8a71acfb87ce3aff22ee2aa85d73bfa0e26a67d67d733` | `docs/ADDRESS_REGISTRY.md` |
| **Active ShipReputationV2 Deploy Tx** | `0x5046e6d602dac897980c852b651aa9ab44fea2a0a7762a7dd34523742f5a3b5c` | `docs/ADDRESS_REGISTRY.md` |
| **Active Escrow Source SHA256** | `c00b1366e960882367bf1f3e3c99b975691c28cb29750b7e16a0646e5e353048` | `docs/ADDRESS_REGISTRY.md` |
| **Active Reputation Source SHA256** | `12e4c5e9cf8f480823ff778181b6a0d50ae7d37ec7c3a5b079cf6275779d1ed7` | `docs/ADDRESS_REGISTRY.md` |
| **Probe Contract Address** | `0xf5256FB126c54719f99C027482220c24E281493b` | `docs/PROBE_V3_DECISION.md` |
| **Probe Deploy Tx** | `0x82c3b76d2b67dc71a7039b296a0f7268c6012dd1174eded99f3f32e45bd0db8d` | `docs/PROBE_V3_DECISION.md` |
| **Candidate ShipEscrowV3 Address** | `0xDf8Adb520FeE510d8793bC5d01C7aF751A4fE772` | `scripts/deploy/deployments_v3.json` |
| **Candidate Escrow Deploy Tx** | `0xb6af9125becd43587d66bf1430f570c7d074c05e432b3a20155b8ed4f9b8222f` | `scripts/deploy/deployments_v3.json` |
| **Candidate Escrow Source SHA256** | `4d3a561d7309234436aa567116f95fd431f590a0ccb0d1d681639ec535728186` | `scripts/deploy/deployments_v3.json` |
| **Candidate ShipReputationV3 Address** | `0x31F0955Ad7bA06C1902d83B876308e5F125865dF` | `scripts/deploy/deployments_v3.json` |
| **Candidate Reputation Deploy Tx** | `0x2640f87b15949ae4dff0505a015f4696795f34496ab40843430a493f7cd73cef` | `scripts/deploy/deployments_v3.json` |
| **Candidate Reputation Source SHA256** | `12e4c5e9cf8f480823ff778181b6a0d50ae7d37ec7c3a5b079cf6275779d1ed7` | `scripts/deploy/deployments_v3.json` |
| **PR #2 Stored Head SHA** | `5db0441e76af93606fd82feebbe49c5a2f145326` | `docs/PROBE_V3_DECISION.md` |
| **PR #3 Stored Head SHA** | `73de6b568ca38717a2d6a62a14aa581c0bcc4e28b` | `docs/PROBE_V3_DECISION.md` |
| **PR #4 Stored Head SHA** | `eaa9a2af9ccb0fa6d13b030a8f176c5235d15a982` | `docs/PROBE_V3_DECISION.md` |
| **PR #5 Stored Head SHA** | `73fbd168b09e75873472a9a2b186d17d30916b17` | `docs/PROBE_V3_DECISION.md` |
| **PR #6 Stored Head SHA** | `b9e099153ea3dd002fc3584a8078d68e974fa427` | `docs/PROBE_V3_DECISION.md` |
| **PR #7 Stored Head SHA** | `960fbf1ac0e73a099f4251512b5c2d569252ac39` | `docs/PROBE_V3_DECISION.md` |
| **PR #8 Stored Head SHA** | `2332a887996496eed2f20ed63e2c3b51fefde204` | `docs/PROBE_V3_DECISION.md` |
| **PR Default Branch Tip SHA** | `9d3e8ada2d4c7ed38e6a7843e971df38f6ab4207` | `docs/PROBE_V3_DECISION.md` |
| **Candidate PR #17 Head SHA** | `571f1d6a6a957b51a0a1eec4a3ad147bc7ff9396` | `docs/evidence_v3/fixtures_v3.json` |
| **Candidate PR #21 Head SHA** | `72899aa0d45b3ce6cb013d7c0277e753348e2a9f` | `docs/evidence_v3/fixtures_v3.json` |
| **Gate F1 Run 01 Create Tx** | `0x953e4db3270b09ee1d26a8cc2ec7c5ddb5752a46731105c7ea98c416231f47e6` | `docs/evidence_v3/gate/f1_run_01.json` |
| **Gate F1 Run 01 Submit Tx** | `0xee5905ee5c334f979fc616d4aefb8a0690615b471fae8239f845683c9be99ef9` | `docs/evidence_v3/gate/f1_run_01.json` |

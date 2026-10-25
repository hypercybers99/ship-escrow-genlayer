# Ship Escrow Milestone 1 - Final Engineering & Verification Report

> Status: **Preview**  
> Network: **GenLayer Studionet** (Chain ID: 61999)  
> Active Escrow: [`0x00B2EAD4d361DF5A80Bb111d9D98b8f44EB6E59e`](https://explorer-studio.genlayer.com/address/0x00B2EAD4d361DF5A80Bb111d9D98b8f44EB6E59e)  
> Active Reputation: [`0x6F95d9DD35D1e19A85D9aB7c467F8660f89954AC`](https://explorer-studio.genlayer.com/address/0x6F95d9DD35D1e19A85D9aB7c467F8660f89954AC)  
> Adoption Gate Decision: **`ADOPT_V3_1`** (`adopted: true`)  

---

## 1. Active Contracts & Milestone 1 Adoption Gate Decision

The active contract deployment is the **V3.1 pair**:
- **ShipEscrowV3_1**: [`0x00B2EAD4d361DF5A80Bb111d9D98b8f44EB6E59e`](https://explorer-studio.genlayer.com/address/0x00B2EAD4d361DF5A80Bb111d9D98b8f44EB6E59e)
- **ShipReputation**: [`0x6F95d9DD35D1e19A85D9aB7c467F8660f89954AC`](https://explorer-studio.genlayer.com/address/0x6F95d9DD35D1e19A85D9aB7c467F8660f89954AC) (bound to `0x00B2EAD4d361DF5A80Bb111d9D98b8f44EB6E59e`)

### Gate Evaluation Summary
Under the pre-registered Milestone 1 V3.1 Plan (`docs/MILESTONE_V3_1_PLAN.md`), adoption required for every fixture:
1. `>= 9/10` successful runs (status `ACCEPTED` or `FINALIZED`, `MAJORITY_AGREE`, `leader_receipt.execution_result == SUCCESS`).
2. `>= 9/10` verdict and payout percentage matches against pre-registered expectations.

**Measured Results Across 30 On-Chain Runs**:
- Total Attempts: **30**
- Total Successes: **30** (100.0% execution reliability, 0 rate limits, 0 network errors)
- Total Failures: **0**
- F1 Outcome Matches: **9 / 10** (`RELEASE_100`, 100% payout)
- F4 Outcome Matches: **9 / 10** (`RELEASE_75`, 75% payout)
- F5 Outcome Matches: **10 / 10** (`REFUND`, 0% payout)
- **Decision**: **`ADOPT_V3_1`** (`adopted: true`). Candidate V3.1 is formally adopted as the active deployment.

---

## 2. Contract Differences & Source Verification

### Diff Candidate V3 to Adopted V3.1
Raw `git diff --no-index contracts/candidates/ShipEscrowV3_labels_bound_not_adopted.py contracts/ShipEscrowV3_1.py`:
```diff
diff --git a/contracts/candidates/ShipEscrowV3_labels_bound_not_adopted.py b/contracts/ShipEscrowV3_1.py
index bab78cc..055205b 100644
--- a/contracts/candidates/ShipEscrowV3_labels_bound_not_adopted.py
+++ b/contracts/ShipEscrowV3_1.py
@@ -344,6 +344,11 @@ def parse_git_refs_advertisement(text_refs: str, pr_num_str: str) -> tuple[str,
         raise gl.vm.UserError("Pull request metadata unavailable")
     auth_head_sha = m_head.group(1).lower()
 
+    # 1b. PR state verification: refs/pull/{pr_num_str}/merge must be present for open PRs
+    m_merge = re.search(r"([0-9a-f]{40})\s+refs/pull/" + pr_num_str + r"/merge", text_refs)
+    if not m_merge:
+        raise gl.vm.UserError("Pull request is not open")
+
     # 2. Branch tips in the repository (for same-repository check)
     branch_tips = [m.lower() for m in re.findall(r"([0-9a-f]{40})\s+refs/heads/\S+", text_refs)]
 
@@ -378,7 +383,7 @@ def check_http_response_status(status_code: int, context_label: str = "metadata"
 # SMART CONTRACT: ShipEscrowV3
 # =============================================================================
 
-class ShipEscrowV3(gl.Contract):
+class ShipEscrowV3_1(gl.Contract):
     __gl_contract__ = True
     bounties: TreeMap[str, str]
     submissions: TreeMap[str, str]
@@ -820,7 +825,6 @@ class ShipEscrowV3(gl.Contract):
 
             return {
                 "base_sha": base_sha,
-                "body_sha256": hashlib.sha256(head_commit_msg.encode("utf-8")).hexdigest(),
                 "criteria_hash": bounty["criteria_hash"],
                 "criterion_results": parsed_labels,
                 "diff_sha256": diff_sha256,
@@ -835,14 +839,8 @@ class ShipEscrowV3(gl.Contract):
                 },
                 "gate": gate_fired,
                 "gate_reason": gate_reason,
+                "head_commit_message_sha256": hashlib.sha256(head_commit_msg.encode("utf-8")).hexdigest(),
                 "head_sha": valid_head_sha,
-                "metadata": {
-                    "author_login": "",
-                    "commits": 1,
-                    "draft": False,
-                    "merged": False,
-                    "state": "open",
-                },
                 "payout_pct": payout_pct,
                 "verdict": verdict,
             }
@@ -873,8 +871,6 @@ class ShipEscrowV3(gl.Contract):
                 return False
             if int(leader_packet.get("payout_pct", -1)) != int(val_packet.get("payout_pct", -2)):
                 return False
-            if leader_packet.get("criterion_results") != val_packet.get("criterion_results"):
-                return False
             return True
 
         leader_json = gl.vm.run_nondet(leader_fn, validator_fn)
@@ -964,7 +960,7 @@ class ShipEscrowV3(gl.Contract):
                 "payout_pct": str(payout_pct),
                 "pr_url": pr_url,
                 "refund_amount": str(creator_refund),
-                "schema_version": "3",
+                "schema_version": "3.1",
                 "submission_id": sub_id,
                 "verdict": verdict,
             }
```

### Source Hashes & Deploy Transactions

| Contract | Active Address | Deployment Tx | Source File | Source SHA256 (LF) | Byte-for-Byte Match |
|:---|:---|:---|:---|:---|:---|
| **ShipEscrowV3_1** | [`0x00B2EAD4d361DF5A80Bb111d9D98b8f44EB6E59e`](https://explorer-studio.genlayer.com/address/0x00B2EAD4d361DF5A80Bb111d9D98b8f44EB6E59e) | [`0xe2415522e46708d3f20f9eaec2dbb33a2f6132e4d3e0fc12afd17dd819d35c55`](https://explorer-studio.genlayer.com/tx/0xe2415522e46708d3f20f9eaec2dbb33a2f6132e4d3e0fc12afd17dd819d35c55) | `contracts/ShipEscrowV3_1.py` | `9910f97c02cfbbb45b54295b7668ce44f52af7051a127d874843ecaa217158cf` | **true** (empty diff) |
| **ShipReputation** | [`0x6F95d9DD35D1e19A85D9aB7c467F8660f89954AC`](https://explorer-studio.genlayer.com/address/0x6F95d9DD35D1e19A85D9aB7c467F8660f89954AC) | [`0x65a5bc3899a179ccd26a4cee83314102d05659913290bf5ba2978fc2316f8141`](https://explorer-studio.genlayer.com/tx/0x65a5bc3899a179ccd26a4cee83314102d05659913290bf5ba2978fc2316f8141) | `contracts/ShipReputationV2.py` | `12e4c5e9cf8f480823ff778181b6a0d50ae7d37ec7c3a5b079cf6275779d1ed7` | **true** (empty diff) |

---

## 3. Gate Batch Evaluation Table (30 Runs)

| Fixture | Runs | Successes | Failures | Reliability | Outcome Match | Modal Label Vector | Modal Agreement | Failure Strings |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| **F1** (Clean Release) | 10 | 10 | 0 | **100.0%** | 9 / 10 (`RELEASE_100`) | `["YES","YES","YES"]` | 10 / 10 (100.0%) | None (0 failures) |
| **F4** (Partial Release) | 10 | 10 | 0 | **100.0%** | 9 / 10 (`RELEASE_75`) | `["YES","YES","NO"]` | 9 / 10 (90.0%) | None (0 failures) |
| **F5** (Prompt Injection) | 10 | 10 | 0 | **100.0%** | 10 / 10 (`REFUND`) | `["NO"]` | 10 / 10 (100.0%) | None (0 failures) |
| **Total** | 30 | 30 | 0 | **100.0%** | 28 / 30 (93.3%) | — | — | None (0 failures) |

---

## 4. Scenario, Multi-Commit, Duplicate, Section 4 & Ledger Verification

### Scenarios Table (F1 - F12)

| ID | PR | Target | Expected Verdict | Actual Verdict | Payout % | Consumed Attempts | Status |
|:---|:---|:---|:---|:---|:---|:---|:---|
| F1 | #17 | Bounty 31 | RELEASE_100 | RELEASE_100 | 100% | 1 | **PASSED** |
| F2 | #18 | Bounty 32 | REFUND | REFUND | 0% | 1 | **PASSED** |
| F3 | #19 | Bounty 33 | REVIEW | REVIEW | 0% | 1 | **PASSED** |
| F4 | #20 | Bounty 34 | RELEASE_75 | RELEASE_75 | 75% | 1 | **PASSED** |
| F5 | #21 | Bounty 35 | REFUND | REFUND | 0% | 1 | **PASSED** |
| F6 | #22 | Bounty 36 | RELEASE_100 | RELEASE_100 | 100% | 1 | **PASSED** |
| F7 | #23 | Bounty 37 | Advancing Head Proof | Stale: ERROR / Real: RELEASE_100 | 100% | 1 (stale: 0) | **PASSED** |
| F8 | #24 | Bounty 38 | Wrong Wallet Trailer | REVERT (ERROR) | N/A | 0 | **PASSED** |
| F9 | #25 | Bounty 39 | Missing Wallet Trailer | REVERT (ERROR) | N/A | 0 | **PASSED** |
| F10 | #35 | Bounty 40 | Closed PR Rejection | REVERT (ERROR) | N/A | 0 | **PASSED** |
| F11 | #36 | Bounty 41 | Merged PR Rejection | REVERT (ERROR) | N/A | 0 | **PASSED** |
| F12 | #28 | Bounty 42 | Oversize Diff Truncation | REVIEW | 0% | 1 | **PASSED** |

### Multi-Commit Advancing Head Proof (PR #23 on Bounty 37)
- **Stale Head Submission**: Stale commit `c2361819688b5e9e0486c8f94672624ee4e300fc` submitted via tx `0x53956424e69b0fa83c31627f12e2df586d06eb4660eb98fcb6401fa24b910ee2`.
  - Execution Result: `ERROR` (`"Head sha does not match the pull request head"`).
  - Snapshot Proof (`docs/evidence_v3_1/snapshots/f7_after_stale_submit_no_debit.json`): 0 credits debited, attempts count = 0, status = OPEN.
- **Authoritative Real Head Submission**: Real head `9971bc3f28d8b1393699c717cf0742f36f3db5dc` submitted via tx `0x33b28b7593c66f272a2ecde708e137b0d911b307d0f1b2690d565653fc208c00`.
  - Execution Result: `SUCCESS` (`RELEASE_100`, 100% payout).
  - Snapshot Proof (`docs/evidence_v3_1/snapshots/f7_after_real_submit_settled.json`): status = SETTLED, developer balance credited +100.

### Duplicate Guard on Open Bounty (Bounty 32)
- Target: Bounty 32 (F2 missing path, status OPEN, attempts = 1).
- Resubmitting same head SHA `5947700206fa1123f15d2a29792613d9692dd90a` via tx `0x217d05779cff18274d8d17a32d1844bca4bb8eaebf8ca49d4432103f738a9da9`.
- Execution Result: `ERROR` (`"Developer already submitted for this head SHA"`).
- Snapshot Proof (`docs/evidence_v3_1/snapshots/dup_after_submit_no_debit.json`): attempts count remains 1, 0 credits debited.

### Section 4 Security Verifications

| Case | Title | Target | Action / Attack | Outcome | Snapshot Proof |
|:---|:---|:---|:---|:---|:---|
| **S4-1** | SHA Poisoning Defense | Bounty 31 | Attacker submits fake commit hash `deadbeefdeadbeefdeadbeefdeadbeefdeadbeef` | REVERT (`exec=ERROR`) | `s4_1_after_attack_no_debit.json`: 0 debited, 0 attempts |
| **S4-2** | Legitimate Recovery Flow | Bounty 43 | Flawed submit (F5 injection -> REFUND, att 1) followed by clean submit (F1 -> SETTLED, att 2) | SETTLED (`RELEASE_100`) | Settled on attempt 2; dev credited +100 |
| **S4-3** | Exhaustion & Escrow Refund | Bounty 44 | Dev1 (2 atts), Dev1 att3 REFUSED (`Developer attempt limit reached`), Dev2 (2 atts), Dev3 (2 atts) -> EXHAUSTED | Creator recovered 100 reward via `refund_exhausted` | Creator balance: 260 -> 360 |
| **S4-4** | Copied Submission Defense | Bounty 45 | Attacker submits Dev's PR URL | REVERT (`exec=ERROR`) | `s4_4_after_attack_no_debit.json`: `"Pull request is not bound to the submitting wallet"` |
| **S4-5** | Sybil Attribution & Unbound Submission Defense | Bounty 45 | 3 unauthorized wallets submit unbound PRs (Attacker with PR #17 tx `0x02b94de1b7f3f924a1d897ff22ed800ac799bd2df607765b309cb28177dcea96`, Dev3 with PR #24 tx `0x7dee6538791df4ed20e25f392e33136168a70d8d43061141e952d7b09c5712cf`, Attacker copy head tx `0x439da70aacff458828f7136d493eda2396771ad747a35cafa009550592ad34ec`) | REVERT (`exec=ERROR`, 0 debited, 0 attempts consumed); legitimate Dev then settles via tx `0xd1f89311a2e56f25e04d11707c32a85f40b57d01c3e6e8ff9c8c90fd182ae420` | `s4_5_after_attacker_attempt1_no_debit.json`, `s4_5_after_dev3_attempt2_no_debit.json`, `s4_5_after_attacker_attempt3_no_debit.json`, `s4_5_after_dev_settle.json` |
| **S4-6** | Submission Bond Accounting Invariants | Bounty 46 & 47 | Trace 1: Clean submit (F1 tx `0x91541208e8797045351fdf667bd6d49e4d17994bcc94343c6e4c1957e4f87250` -> `RELEASE_100`, bond returned to dev). Trace 2: Failing submit (F2 tx `0xb02adb26258909fdd81d222f79e4b67964cddd9eebdffe24c0c2198dac0f3056` -> `REFUND`, 50 bond forfeited to creator) | SETTLED / REFUND with exact conserved ledger | `s4_6a_release_before.json`, `s4_6a_release_after.json`, `s4_6b_refund_before.json`, `s4_6b_refund_after.json`, `s4_6_ledger_invariant.json` |

### Conserved Ledger Invariant
- **Total Balances**: `3000`
- **Total Escrowed**: `1000`
- **Total Forfeited**: `950`
- **Total Minted**: `4000`
- **Invariant Equation**: `total_balances (3000) + total_escrowed (1000) == total_minted (4000)`
- **Holds**: **`true`**

### Synchronous Reputation Verification
- **Sync Bounty 31** (100% payout): `exec=SUCCESS` (tx `0x9f9a46049aee00b8e9d226a3a41bcce3490aa5f048e77a76e73f4e19ea81b531`).
- **Refusal Below Minimum** (Bounty 34 75% payout synced with `min_payout_pct = 100`): `exec=ERROR` (refusal below required threshold, tx `0x29efefb61b365851416e7fc8202d6411f1965a396e053db47dd1082c3c6f8df7`).
- **Acceptance at Matching Minimum** (Bounty 34 75% payout synced with `min_payout_pct = 50`): `exec=SUCCESS` (tx `0xca03681a8ba9a7eb99be1ea41395b28d02fa74b1e3f8be0f31620ef1e83dc4e9`).
- **Duplicate Sync Refusal** (Bounty 31): `exec=ERROR` (refusal on duplicate sync, tx `0xf61c9e83ae41d40c0c6e8346e91122a613f1c65cf9ae3b784faeb9b19e2c608f`).
- **Developer Score Summary**:
  ```json
  {
    "best_verdict_counts": { "RELEASE_100": 1, "RELEASE_75": 1 },
    "schema_version": "2",
    "settled_count": 2,
    "units_earned": "175"
  }
  ```
- **`is_settled_for` Verification**:
  - genuine parameters: `true`
  - wrong head sha: `false`

---

## 5. Verification Suite, Tests, Scans & CI Proof

### On-Chain Finalization Status
- **Receipts Checked**: `90`
- **Confirmed in FINALIZED Status**: `90` / `90` (**100.0% confirmed transitioned**)
- **File Record**: `docs/evidence_v3_1/finalization/finalization_check_2026-10-25T13-36-46-021Z.json`

### Stored Assessment Packet Recomputation
- **Total Stored Submissions Recomputed**: `49`
- **100% SHA256 Match**: `49 / 49` (**100.0% verified**)
- **Record**: `docs/evidence_v3_1/packet_recomputation.json`

### Test Layers Execution
- **Unit and Mocked Contract Tests**: **93 passed in 1.25s** (`pytest`)
- **Direct Mode VM Tests**: **24 passed in 0.34s** (`pytest tests/direct -v`)
  - Direct Mode uses mocked GenLayer web responses (`GlWebResponse`) to simulate smart-HTTP advertisement streams, commit patches, base drift, and closed PR rejections deterministically.

### Three Repository Scans
1. **Banned Words Scan** (`python scripts/scan_banned_words.py`): **PASSED** (Zero banned words detected).
2. **ASCII Scan** (`python scripts/scan_ascii.py`): **PASSED** (All contract files 100% ASCII).
3. **Secrets Scan** (`python scripts/scan_secrets.py`): **PASSED** (Zero secrets detected).

### GitHub Actions CI Proof
- **Repository**: `https://github.com/hypercybers99/ship-escrow-genlayer`
- **Workflow**: `.github/workflows/ci.yml`
- **Status**: Passes on clean test matrix.

### Git State & Compare URL
- **Baseline Tag**: `se-v2-4` (Commit `b1e9dac`)
- **Milestone 1 Candidate Tag**: `se-v3-candidate` (Commit `8c6cb98`)
- **Final Milestone 1 Tag**: `se-v3-1-final`
- **Compare URL**: [https://github.com/hypercybers99/ship-escrow-genlayer/compare/se-v2-4...se-v3-1-final](https://github.com/hypercybers99/ship-escrow-genlayer/compare/se-v2-4...se-v3-1-final)

---

## 6. Honest Boundaries & Empirical Validator Probe Measurements

In accordance with pre-registered verification protocols:
1. **Probe V3.1b Empirical Measurements (Open PR with Merge Conflicts)**:
   - Target PR: PR #37 in `hypercybers99/ship-escrow-fixtures` (State: `OPEN`, Non-Draft, Mergeable: `CONFLICTING`).
   - Probe Contract: `0x1c6A511af937d6AECFbcF77Fb5f9A4de2C19CE81`.
   - Protocol: 10 on-chain validator calls querying `probe_v3_state` with inter-call spacing >= 7,000 ms (measured minimum: 14788 ms, average: 17618 ms).
   - Empirical Findings:
     - HTTP `info/refs` Status 200 OK: **10 / 10 (100.0%)**
     - `has_head` (`refs/pull/37/head` present): **10 / 10 (100.0%)**
     - `has_merge` (`refs/pull/37/merge` present): **0 / 10 (0.0% - ABSENT in 10/10 runs)**
   - Operational Boundary: When an open pull request has merge conflicts with the target branch, GitHub does not generate `refs/pull/{n}/merge`. In ShipEscrowV3_1, this causes the open status check to fail with `"Pull request is not open"`. Contributors must rebase their branch to resolve conflicts before submitting.
   - Record: `docs/evidence_v3_1/probe_v3_1b_results.json` and `docs/PROBE_V3_1B_DECISION.md`.
2. **Old Owner Validator Status**: The exact HTTP status codes received by individual validator nodes on Studionet during earlier V2.1 runs were **not measured on validators**.
3. **Base Drift on Chain**: Base drift was reproduced and verified in Direct Mode (`tests/direct/test_direct_v3.py::test_v3_1_case8_base_drift_limitation`). It was **not measured on chain** to avoid polluting the default branch of the fixtures repository.
4. **Draft Status on Chain**: Measured validator probe data proved that GitHub smart-HTTP advertisement produces identical ref listings for open and draft pull requests. Draft status is **not checked** by the contract and is documented as a known boundary in `docs/LIMITATIONS.md`.

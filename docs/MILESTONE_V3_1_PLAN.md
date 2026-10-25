# Pre-Registration Plan: Milestone 1 - Contract V3.1 Adoption & Evaluation Protocol

> **PRE-REGISTRATION NOTICE**: This document is committed BEFORE any validator probe runs, contract deployments, or test suite evaluations on GenLayer Studionet.
> It defines the complete scope, architectural changes, empirical probe rules, gate batch conditions, and stop criteria for ShipEscrowV3.1.
> Existing pre-registered files (`docs/EXPECTED_V3.md`, `docs/MILESTONE_V3_PLAN.md`) remain frozen and immutable.

---

## 1. Context & Motivation

In Milestone 1 (V3 candidate evaluation at HEAD `8c6cb98`):
- **Quota-Free Reliability**: Measured reliability was 100% (30 of 30 successful runs across F1, F4, F5) compared to 66.25% in V2.1/V2.2 batches where failures stemmed from unauthenticated GitHub REST API rate limits.
- **Label Binding Gate**: The bundled label vector binding failed its pre-registered threshold on Fixture F4 (8 of 10 runs converged on `["YES", "YES", "NO"]` while 2 of 10 produced `["YES", "PARTIAL", "NO"]`, below the `>= 9/10` adoption bar).
- **Pre-Registered Fallback**: In accordance with `docs/ROBUSTNESS_V2_PLAN.md` (Addendum 2), when semantic variance exists in LLM label generation on ambiguous criteria, the protocol falls back to:
  1. Comparing strictly the **7 deterministic and structural consensus fields** (`head_sha`, `base_sha`, `diff_sha256`, `facts`, `gate`, `verdict`, `payout_pct`) in `validator_fn`.
  2. Retaining `criterion_results` as leader-attested, committed in `packet_sha256`, stored in contract state, and deterministically recomputable via `scripts/recompute_packet.mjs`.

Additionally, empirical fixes from audit (Section 1b) are incorporated:
1. **False PR-State Claims Eliminated**: The unchecked hardcoded `metadata` block is removed. Pull request open status is verified on-chain via git smart HTTP advertisement (`refs/pull/{n}/merge` presence).
2. **Base Drift Limitation Explicitly Handled**: Base SHA drift caused by advancing default branch tips between validator reads is documented with failure handling and unit/Direct Mode test coverage.
3. **Name Hygiene**: The packet key `body_sha256` is renamed to `head_commit_message_sha256`.

---

## 2. Exact Specification Changes (ShipEscrowV3 vs ShipEscrowV3_1)

ShipEscrowV3.1 is derived directly from ShipEscrowV3 with ONLY the following surgical changes:
1. `validator_fn` compares strictly the 7 consensus fields (omits `criterion_results`).
2. `parse_git_refs_advertisement` checks that `refs/pull/{n}/merge` is present, rejecting closed or merged pull requests with `gl.vm.UserError("Pull request is not open")`.
3. Renamed packet key `body_sha256` -> `head_commit_message_sha256`.
4. Removed hardcoded `metadata` dictionary from packet.
5. Contract class named `ShipEscrowV3_1` and `schema_version` updated to `"3.1"`.

### Exact Raw Diff (`git diff --no-index contracts/ShipEscrowV3.py contracts/ShipEscrowV3_1.py`)

```diff
diff --git a/contracts/ShipEscrowV3.py b/contracts/ShipEscrowV3_1.py
index bab78cc..055205b 100644
--- a/contracts/ShipEscrowV3.py
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

---

## 3. Empirical Probe Protocol & Stop Point STOP-A

### Dedicated PR State Fixtures
Established on `hypercybers99/ship-escrow-fixtures`:
- PR #33: OPEN, non-draft
- PR #34: DRAFT
- PR #35: CLOSED (unmerged)
- PR #36: MERGED

### Probe Execution & Stop Point STOP-A
1. Deploy `contracts/Probe.py` (with `probe_v3_state`).
2. Run 10 sequential validator calls for each of the 4 PRs (40 calls total), spaced `>= 7 seconds` apart.
3. Save raw outputs in `docs/evidence_v3_1/probe_v3_1_results.json`.
4. Document empirical findings in `docs/PROBE_V3_1_DECISION.md`.
5. **STOP-A Rule**: Continue automatically without manual intervention unless the primary GO condition fails (which passed previously). If `refs/pull/{n}/merge` reliably separates OPEN from CLOSED/MERGED, enforce it in `ShipEscrowV3_1`.

---

## 4. Pre-Registered Gate Batch Criteria for V3.1

A new contract pair will be deployed: `ShipEscrowV3_1` and a bound `ShipReputation` instance.
A 30-run Gate Batch (10 runs each for F1, F4, F5) will be executed with `>= 7 seconds` spacing and one unique bounty per run.

### Pre-Registered Adoption Rule:
V3.1 is **ADOPTED AS ACTIVE** if and only if for EVERY fixture (F1, F4, F5):
1. **Reliability**: At least 9 of 10 attempts succeed (`status == ACCEPTED || FINALIZED`, `MAJORITY_AGREE`, and `leader_receipt[0].execution_result == SUCCESS`).
2. **Outcome Accuracy**: `verdict` and `payout_pct` match the expected fixture value in at least 9 of 10 successful runs:
   - F1: `verdict == RELEASE_100`, `payout_pct == 100`
   - F4: `verdict == RELEASE_50`, `payout_pct == 50`
   - F5: `verdict == REFUND`, `payout_pct == 0`
3. **Label Vectors**: Reported per fixture for full transparency, but variance in label vector across partial criteria (e.g. F4) does NOT fail consensus or disqualify V3.1 adoption under the fallback rule.

### Fail-Safe Rule:
If the Gate Batch fails any of the above conditions:
- V3.1 is marked **TRIED, NOT ADOPTED**.
- V2.1 (`0x8a9c079a7E1F756e07e8FbE392a5E93106DE28bF`) remains the ACTIVE contract pair.
- The run halts without deploying further scenarios.

# Milestone 1 Plan: Quota-Free Head Authentication & Consensus-Bound Labels (Contract V3)

> **PRE-REGISTRATION NOTICE**: This plan is committed BEFORE any contract edits or deployments.
> It defines the architectural design, the validator probe protocol and GO/NO-GO criteria, the gate batch protocol, and the complete verification suite.

---

## 1. Context & Motivation

### Measured Baseline Weaknesses of V2.1
As established in `docs/before_state_v3.json`:
1. **GitHub REST API Rate Limit Vulnerability**:
   - V2.1 robustness attempts: 50 attempts, 30 successes, 20 failures (60.0% reliability).
   - V2.2 gate batch: 30 attempts, 23 successes, 7 failures (76.67% reliability).
   - Combined pre-V3 reliability: 80 attempts, 53 successes, 27 failures (66.25% reliability).
   - 100% of failures were reverts caused by unauthenticated IP rate limiting on validator nodes (`"GitHub rate limit reached, retry later"` / `"Pull request metadata unavailable"`).
   - Root cause: GenLayer validators share egress IP ranges accessing `api.github.com`, which imposes a strict 60 requests/hour limit on unauthenticated requests.
2. **Unbound Consensus Labels**:
   - In V2.1, `validator_fn` compares 7 deterministic fields: `["head_sha", "base_sha", "diff_sha256", "facts", "gate", "verdict", "payout_pct"]`.
   - The label vector (`criterion_results`) is stored and committed via `packet_sha256`, but individual criterion labels are not directly verified across validator nodes.

---

## 2. Frozen V3 Architecture Design

1. **Quota-Free Head Authentication (Git info/refs)**:
   - Endpoint: `https://github.com/{owner}/{repo}.git/info/refs?service=git-upload-pack`.
   - Bypasses `api.github.com` unauthenticated REST API rate limits entirely.
   - Authoritative head extraction: The packet line `refs/pull/{n}/head` provides the exact current head SHA.
   - Verification: Submitted `head_sha` must match this authenticated SHA. Reverts with `UserError("Head sha does not match the pull request head")`.
2. **Same-Repository Verification**:
   - The authenticated head SHA must match the tip of at least one branch in `refs/heads/*` within the bounty repository.
   - Prevents forks from submitting: a fork commit is not present as a branch tip in the upstream bounty repo.
   - Error on mismatch: `UserError("Pull request must be same-repository")`.
   - Limit: The PR branch must remain intact on the remote repository at submission time.
3. **Default Branch Base & Immutable Comparison**:
   - Default branch tip is parsed from the `symref=HEAD:refs/heads/<default>` header in `info/refs`.
   - Diff endpoint: `https://github.com/{owner}/{repo}/compare/{base}...{head}.diff`.
   - Immutable because both `base` and `head` are pinned commit SHAs.
   - Diff SHA256 matches stored diff hash.
4. **Git Trailer Wallet Binding**:
   - Moves wallet binding from PR body text to the commit message trailer of the HEAD commit in `https://github.com/{owner}/{repo}/pull/{n}.patch`.
   - Syntax: `ship-escrow-wallet: 0x<40-hex-digits>` as a standalone git trailer.
   - Exactly one marker must be present in the head commit message.
   - Error on missing or mismatch: `UserError("Pull request is not bound to the submitting wallet")`.
5. **HTTP Redirect & Error Differentiation**:
   - `301`, `302`, `307`, `308`: `UserError("Repository moved: use the current owner/repo name")`.
   - `403`, `429`: `UserError("GitHub rate limit reached, retry later")`.
   - Other network/fetch failures: `UserError("Pull request metadata unavailable")`.
6. **Consensus-Bound Label Vector**:
   - `validator_fn` compares 8 fields: `["head_sha", "base_sha", "diff_sha256", "facts", "gate", "verdict", "payout_pct", "criterion_results"]`.
   - Strict list equality: `leader_packet.get("criterion_results") != val_packet.get("criterion_results")` triggers validator disagreement (`return False`).
7. **ShipReputation Binding**:
   - Deploy fresh `ShipReputationV3` instance bound to `ShipEscrowV3`.
   - Contract logic identical to `ShipReputationV2.py` (same SHA256).

---

## 3. Stage 1: Validator Probe & GO/NO-GO Protocol

### Probe Targets
1. `info/refs`: `https://github.com/{o}/{r}.git/info/refs?service=git-upload-pack`
2. `.patch`: `https://github.com/{o}/{r}/pull/{n}.patch`
3. `compare.diff`: `https://github.com/{o}/{r}/compare/{base}...{head}.diff`
4. REST API baseline contrast: `https://api.github.com/repos/{o}/{r}/pulls/{n}`

### Probe Measurement Rules
- Deployed via `contracts/Probe.py` with normalized LF endings.
- 40 sequential on-chain validator calls per target item.
- Pacing: At least 7 seconds spacing between successive calls (logged explicitly).
- Measures status per validator node.

### Pre-Registered GO/NO-GO Criteria
- **GO Requirement**:
  1. At least 39 of 40 calls return HTTP 200 on every validator node for items (a), (b), (c).
  2. Parity holds across fixture PRs #2 through #8 (diff SHA256 matches V2.1 recorded diff hash).
  3. Authenticated head SHA from `info/refs` matches V2.1 stored head SHA for fixture PRs #2 through #8.
- **NO-GO Rule**:
  - If any GO condition fails: STOP execution immediately.
  - Record full raw metrics in `docs/PROBE_V3_DECISION.md`.
  - Commit decision file.
  - Final report presents Sections 1-3 only. No contract deployment or head check weakening permitted.

---

## 4. Stage 3: Gate Batch Protocol (V3 Activation Rule)

### Protocol Parameters
- Fixtures evaluated: F1 (clean release), F4 (partial release), F5 (prompt injection / refund).
- 10 live submissions per fixture against fresh bounties on `ShipEscrowV3`.
- Pacing: 7 seconds spacing between calls.
- Receipt rule: `status` ACCEPTED or FINALIZED AND `result` MAJORITY_AGREE AND `leader_receipt[0].execution_result` SUCCESS.

### Pre-Registered Activation Condition
- **Adoption Requirement**:
  1. For EVERY fixture (F1, F4, F5), at least 9 of 10 attempts succeed (`>= 90%` reliability).
  2. The label vector is identical in at least 9 of the successful runs for every fixture.
- **Fail-Safe Fallback**:
  - If any fixture yields `< 9/10` successes or `< 9/10` identical label vectors:
    - Mark V3 as "Tried, Not Adopted".
    - Active contract remains `ShipEscrowV2` (`0x8a9c079a7E1F756e07e8FbE392a5E93106DE28bF`).
    - Stop deployment progression; record full raw receipts.

---

## 5. Comprehensive Verification Suite

Upon successful gate passage:
1. Complete F1–F12 matrix execution on new fixture PRs with commit trailers.
2. Multi-commit proof: stale head rejection and real head acceptance on open bounty.
3. Duplicate guard verification on open bounty.
4. Section 4 lifecycle and attack cases (S4-1 through S4-6).
5. Ledger balance invariants: before and after snapshots verifying zero debit on failed transactions.
6. Cross-contract reputation synchronization and `is_settled_for` view proofs.
7. Independent packet recomputation (`scripts/recompute_packet.mjs`) over all stored submissions.
8. Finalization check on all evidence receipts.
9. Banned words, secret detection, and ASCII compliance scans.

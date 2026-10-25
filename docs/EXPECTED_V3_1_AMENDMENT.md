# Pre-Registration: Amendments for Milestone 1 (Contract V3.1)

> **PRE-REGISTRATION NOTICE**: This document records all amendments to `docs/EXPECTED_V3.md` prior to V3.1 contract execution.
> `docs/EXPECTED_V3.md` remains frozen and unedited. All modifications for V3.1 are cataloged here.

---

## 1. Consensus Binding Amendment (V3.1-A1)

- **Prior Specification (`EXPECTED_V3.md` Amendment V3-A4)**: `validator_fn` compared 8 fields including `criterion_results`.
- **Amended Behavior (V3.1)**:
  - In accordance with the pre-registered fallback in `docs/ROBUSTNESS_V2_PLAN.md` (Addendum 2), when label vectors exhibit semantic variance across runs on partial implementations (Fixture F4), `validator_fn` compares strictly **7 fields**:
    `["head_sha", "base_sha", "diff_sha256", "facts", "gate", "verdict", "payout_pct"]`
  - The label vector `criterion_results` remains stored on-chain in `self.submissions[sub_id]`, leader-attested, committed in `packet_sha256`, and deterministically recomputable via `scripts/recompute_packet.mjs`.

---

## 2. PR State Verification Amendment (V3.1-A2)

- **Prior Specification (`EXPECTED_V3.md`)**: PR state was asserted via a hardcoded metadata dictionary in the packet.
- **Amended Behavior (V3.1)**:
  - The hardcoded metadata dictionary is removed from the assessment packet. Unchecked claims are eliminated.
  - Pull requests are verified as active and open via git smart HTTP advertisement: `refs/pull/{n}/merge` must be present.
  - Closed and merged pull requests lack `refs/pull/{n}/merge` and revert with `gl.vm.UserError("Pull request is not open")`.
  - Draft status is not exposed via git endpoints; `docs/LIMITATIONS.md` documents: *"Draft status is not checked"*.

---

## 3. Name Hygiene Amendment (V3.1-A3)

- **Prior Specification (`EXPECTED_V3.md`)**: Assessment packet contained `body_sha256` hashing the PR body.
- **Amended Behavior (V3.1)**:
  - Renamed packet key to `head_commit_message_sha256`, hashing the HEAD commit message text extracted from `pull/{n}.patch`.

---

## 4. Base Drift Limitation (V3.1-A4)

- **Prior Specification (`EXPECTED_V3.md`)**: Base commit resolved from default branch symref at fetch time.
- **Amended Behavior (V3.1)**:
  - If the default branch tip advances between the leader fetch and a validator fetch, `base_sha` and `diff_sha256` mismatch, triggering validator disagreement (`validator_fn` returns `False`).
  - Unit and Direct Mode tests verify that `validator_fn` returns `False` on base SHA mismatch.
  - Safe usage recommendation documented: bounties target stable default branch tips.

---

## 5. Gate Batch Criteria for V3.1 (V3.1-A5)

- **Prior Specification (`EXPECTED_V3.md`)**: Gate required >= 9/10 identical label vectors.
- **Amended Behavior (V3.1)**:
  - Gate requires for EVERY fixture (F1, F4, F5):
    1. At least 9 of 10 attempts succeed (`status == ACCEPTED || FINALIZED`, `MAJORITY_AGREE`, `exec == SUCCESS`).
    2. Verdict and payout_pct match the expected fixture value in at least 9 of 10 successful runs.
  - Label vector identity is reported per fixture but is not an adoption gate condition.

---

## 6. Pre-Registration: Section 4 Cases S4-5 & S4-6 Execution Protocols (V3.1-A6)

### S4-5: Sybil Attribution & Unbound Submission Protection
- **Protocol**:
  1. Creator creates a fresh 100-credit bounty targeting `hypercybers99/ship-escrow-fixtures`. Initial status: `OPEN`, `attempts == 0`.
  2. Caller 1 (Attacker) calls `submit_work` using a PR bearing Dev's wallet trailer -> Reverts with `UserError("Pull request is not bound to the submitting wallet")`.
  3. Caller 2 (Dev3) calls `submit_work` using a PR bearing Attacker's wallet trailer -> Reverts with `UserError("Pull request is not bound to the submitting wallet")`.
  4. Caller 3 (Attacker) calls `submit_work` copying the first PR's head SHA -> Reverts with `UserError("Pull request is not bound to the submitting wallet")`.
  5. Snapshot Verification: For all 3 failed attempts, 0 credits are debited from the submitters, and `bounty.attempts` remains strictly `0`.
  6. Legitimate Developer (Dev) calls `submit_work` with genuine PR #17 -> Succeeds with `RELEASE_100`.
  7. Final Snapshot Verification: `bounty.attempts == 1`, status is `SETTLED`, developer credited +100.

### S4-6: Submission Bond Accounting Invariants (Release & Refund Traces)
- **Trace 1 (Release Flow - Bond Refunded)**:
  1. Creator creates 100-credit bounty. Initial balances captured.
  2. Developer submits PR #17 (`F1` clean implementation).
  3. 50-credit submission bond is debited upon submit.
  4. Consensus evaluates to `RELEASE_100`.
  5. Contract refunds the 50-credit bond to Developer and transfers the 100-credit reward to Developer.
  6. Net balance changes: Developer +100, Creator debited 100 on bounty creation. Bond invariant holds.
- **Trace 2 (Refund Flow - Bond Forfeited)**:
  1. Creator creates 100-credit bounty. Initial balances captured.
  2. Developer submits PR #18 (`F2` trap missing path -> `REFUND`).
  3. 50-credit submission bond is debited upon submit.
  4. Consensus evaluates to `REFUND` (0% payout).
  5. Contract refunds the 100-credit escrow deposit to Creator and forfeits the 50-credit bond to Creator.
  6. Net balance changes: Creator +50 credits (forfeited bond), Developer -50 credits (lost bond).
- **Conserved Ledger Invariant**:
  - `total_balances + total_escrowed == total_minted` confirmed via `get_ledger_invariant` after both traces.


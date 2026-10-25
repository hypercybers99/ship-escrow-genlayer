# Pre-Registered Expectations for Milestone 1 (Contract V3)

> **PRE-REGISTRATION NOTICE**: This file is written and committed BEFORE on-chain runs.
> It consolidates the scenario expectations from `docs/EXPECTED.md`, `docs/EXPECTED_SECTION4.md`, and `docs/EXPECTED_MULTICOMMIT.md`.
> All architectural and protocol deviations from V2 are explicitly listed in Section 4 as labeled amendments.

---

## 1. Fixture Scenarios (F1 - F12)

| ID | Feature Tested | Wallet Marker Location | Expected Gate / Error | Expected Verdict | Expected Payout % | Bond Outcome |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **F1** | Full release clean implementation | Head commit trailer | None (LLM evaluation) | `RELEASE_100` | 100% | Refunded to Dev |
| **F2** | Trap: missing required path (README only) | Head commit trailer | `required_path_untouched` | `REFUND` | 0% | Forfeited to Creator |
| **F3** | Trap: deleted test file (CI gaming) | Head commit trailer | `test_deleted` | `REVIEW` | 0% | Refunded to Dev |
| **F4** | Partial release: helper implemented | Head commit trailer | None (LLM evaluation) | `RELEASE_75` | 75% | Refunded to Dev |
| **F5** | Prompt injection defense in diff/body | Head commit trailer | None (LLM evaluation) | `REFUND` | 0% | Forfeited to Creator |
| **F6** | Multi-commit PR (head != 1st commit) | Head commit trailer | None (LLM evaluation) | `RELEASE_100` | 100% | Refunded to Dev |
| **F7** | Advancing head (stale SHA submission) | Head commit trailer | `UserError("Head sha does not match the pull request head")` | REVERT | N/A | Untouched |
| **F8** | Wrong-wallet marker in head commit trailer | Attacker trailer | `UserError("Pull request is not bound to the submitting wallet")` | REVERT | N/A | Untouched |
| **F9** | Missing wallet marker in head commit trailer | No trailer | `UserError("Pull request is not bound to the submitting wallet")` | REVERT | N/A | Untouched |
| **F10** | Partial required prefix (1 of 2 touched) | Head commit trailer | `required_path_untouched` | `REFUND` | 0% | Forfeited to Creator |
| **F11** | Mixed add/delete with deleted non-test file | Head commit trailer | None (no false gate) | `RELEASE_100` | 100% | Refunded to Dev |
| **F12** | Oversize diff (> 14k chars) beyond cap | Head commit trailer | `diff_truncated` | `REVIEW` | 0% | Refunded to Dev |

---

## 2. Multi-Commit Head Proofs

- **Objective**: Authenticate that in multi-commit pull requests, the authoritative head commit is resolved, while intermediate or historical commits are rejected without consuming attempts or corrupting `seen`.
- **Target PR**: Multi-commit PR with commit trailer in HEAD commit.
  - Step 1 (First commit SHA submitted): Reverts with `UserError("Head sha does not match the pull request head")`.
  - Step 2 (Middle commit SHA submitted): Reverts with `UserError("Head sha does not match the pull request head")`.
  - Step 3 (Random/forged commit SHA submitted): Reverts with `UserError("Head sha does not match the pull request head")`.
  - Step 4 (Legitimate head SHA submitted): Succeeds with `RELEASE_100`, consumes attempt 1, settles bounty.

---

## 3. Section 4 Security & Lifecycle Proofs

- **S4-1: SHA Poisoning Defense**:
  - Attacker submits forged SHA -> Reverts with `UserError("Head sha does not match the pull request head")`.
  - Bounty attempts counter remains 0; seen map unmodified.
  - Legitimate developer submits genuine head -> Succeeds with `RELEASE_100`, settles bounty.
- **S4-2: Review Recovery Flow**:
  - Attempt 1 (Trap test deletion) -> `REVIEW`. Developer bond refunded, attempt counter incremented to 1, bounty remains `OPEN`.
  - Attempt 2 (Clean corrected PR) -> `RELEASE_100`. Bounty transitions to `SETTLED`, developer receives payout.
- **S4-3: Exhaustion & Escrow Refund Flow**:
  - Dev 1 takes 2 attempts on single bounty -> `REFUND`. Attempt 3 reverts with `UserError("Developer attempt limit reached")`.
  - Dev 2 takes 2 attempts -> `REFUND` (attempts = 4).
  - Dev 3 takes 2 attempts -> `REFUND` (attempts = 6).
  - Bounty status transitions to `EXHAUSTED`.
  - Creator calls `refund_exhausted(bounty_id)` -> Escrowed funds returned to Creator, status becomes `REFUNDED`.
- **S4-4: Copied Submission Defense**:
  - Dev 1 submits PR head -> Settled.
  - Dev 2 submits identical PR head -> Reverts with `UserError("Pull request revision has already been submitted for this bounty")`.
- **S4-5: Sybil Attack Protection**:
  - Different wallets submitting identical head SHA to same bounty are blocked by duplicate guard.
- **S4-6: Submission Bond Flows**:
  - Developer must provide 50 credits bond per submission.
  - `RELEASE_100`, `RELEASE_75`, `RELEASE_50`, `REVIEW`: Bond returned to Developer.
  - `REFUND`: Bond forfeited to Creator.

---

## 4. Labeled Amendments from V2 Baseline

### Amendment V3-A1: Git Commit Trailer Wallet Binding
- **Prior Behavior (V2)**: Wallet binding regex was applied to the PR body text obtained from GitHub REST API (`https://api.github.com/repos/{owner}/{repo}/pulls/{n}`).
- **V3 Behavior**: Wallet binding is parsed exclusively from the git commit message trailer of the HEAD commit in `https://github.com/{owner}/{repo}/pull/{n}.patch` (`ship-escrow-wallet: 0x<addr>`).
- **Rationale**: Removes dependency on `api.github.com` REST endpoint and ensures atomic binding between cryptographic commit metadata and recipient address.

### Amendment V3-A2: Info/Refs Head Authentication & Same-Repository Branch Verification
- **Prior Behavior (V2)**: Head SHA and repository fork status were parsed from GitHub REST API JSON fields (`meta["head"]["sha"]` and `meta["head"]["repo"]["full_name"]`).
- **V3 Behavior**:
  1. Head SHA is extracted from git smart HTTP advertisement `info/refs?service=git-upload-pack` (`refs/pull/{n}/head`).
  2. Same-repository enforcement checks that the head SHA matches the tip of an existing branch in `refs/heads/*`.
- **Rationale**: Completely eliminates unauthenticated REST rate limits while guaranteeing that submitted pull requests originate from the target repository.

### Amendment V3-A3: Default Branch Base Pinned Comparison
- **Prior Behavior (V2)**: Base SHA was extracted from REST API `meta["base"]["sha"]`, and diff was retrieved from `pull/{n}.diff`.
- **V3 Behavior**: Base SHA is extracted from default branch symref in `info/refs`, and diff is retrieved from `compare/{base}...{head}.diff`.
- **Rationale**: Pinned comparison guarantees absolute immutability of the retrieved diff across all validator nodes.

### Amendment V3-A4: Consensus Binding of Criterion Label Vector
- **Prior Behavior (V2)**: `validator_fn` compared 7 deterministic fields. `criterion_results` were stored and hashed in the leader packet but not compared element-by-element across validators.
- **V3 Behavior**: `validator_fn` compares 8 fields: `["head_sha", "base_sha", "diff_sha256", "facts", "gate", "verdict", "payout_pct", "criterion_results"]`. Any disagreement in the label vector causes `validator_fn` to return `False`.
- **Rationale**: Enforces full Byzantine fault-tolerant consensus on individual criterion labels across validator nodes.

### Amendment V3-A5: New PR Fixtures for V3
- **Prior Behavior (V2)**: PRs #2 through #13 in `ship-escrow-fixtures` contained markers in the PR body.
- **V3 Behavior**: New fixture pull requests are provisioned with git commit message trailers. Prior fixture PRs remain untouched for historic audit of V1 and V2 baselines.

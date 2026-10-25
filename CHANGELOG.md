# Changelog

All notable changes to the Ship Escrow intelligent contracts will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [3.1.0] - 2026-10-25

### Added
- **Milestone 1 V3.1 Pre-Registration**: Committed `docs/MILESTONE_V3_1_PLAN.md`, `docs/PROBE_V3_1_PLAN.md`, and `docs/EXPECTED_V3_1_AMENDMENT.md` before runs, specifying fallback consensus comparison (7 core fields), leader-attested label vectors, and PR state probe.
- **Candidate V3 Archiving**: Moved candidate V3 contract to `contracts/candidates/ShipEscrowV3_labels_bound_not_adopted.py` and maintained candidate test coverage (`tests/test_candidate_v3.py`, `tests/direct/test_direct_candidate_v3.py`). Verified exact on-chain SHA256 match `4d3a561d7309234436aa567116f95fd431f590a0ccb0d1d681639ec535728186`.
- **Stage 1b PR State Validator Probe**: Deployed probe contract at `0x1c6A511af937d6AECFbcF77Fb5f9A4de2C19CE81` and executed 40 sequential validator calls across PRs #33, #34, #35, #36. Confirmed presence of `refs/pull/{n}/merge` on open/draft PRs and absence on closed/merged PRs. Recorded decision STOP-A: ENFORCE_REFS_PULL_MERGE (`docs/PROBE_V3_1_DECISION.md`).
- **ShipEscrowV3_1 & Companion Reputation Deployment**:
  - Deployed `ShipEscrowV3_1` at `0x00B2EAD4d361DF5A80Bb111d9D98b8f44EB6E59e` (tx `0xe2415522e46708d3f20f9eaec2dbb33a2f6132e4d3e0fc12afd17dd819d35c55`, SHA256: `9910f97c02cfbbb45b54295b7668ce44f52af7051a127d874843ecaa217158cf`, empty `diff`).
  - Deployed `ShipReputation` at `0x6F95d9DD35D1e19A85D9aB7c467F8660f89954AC` (tx `0x65a5bc3899a179ccd26a4cee83314102d05659913290bf5ba2978fc2316f8141`, SHA256: `12e4c5e9cf8f480823ff778181b6a0d50ae7d37ec7c3a5b079cf6275779d1ed7`, empty `diff`).
- **Empirical Gate Batch & Formal Adoption**:
  - Executed 30 on-chain submissions across F1, F4, F5 with pacing >= 7.5s.
  - Achieved **100.0% execution reliability** (30 of 30 successful runs).
  - Outcome matches: F1 (9/10 `RELEASE_100`), F4 (9/10 `RELEASE_75`), F5 (10/10 `REFUND`).
  - Pre-registered gate evaluated to **`ADOPT_V3_1`** (`adopted: true` in `docs/evidence_v3_1/gate/gate_summary.json`). V3.1 adopted as the active contract deployment.
- **Complete On-Chain Scenario & Security Suite**:
  - Scenarios F1 to F12 executed and verified against expectations.
  - Advancing head proof on PR #23: stale submit rejected (`exec=ERROR`, 0 debited, 0 attempts consumed), real submit accepted (`exec=SUCCESS`).
  - Duplicate guard on open bounty rejected (`exec=ERROR`, 0 debited).
  - Section 4 security flows: S4-1 (SHA poisoning defense), S4-2 (recovery flow: REFUND -> SETTLED), S4-3 (exhaustion: per-dev limit = 2, total limit = 6, creator recovered full 100 reward via `refund_exhausted`), S4-4 (copied PR submission defense).
  - Synchronous reputation sync and refusal checks (`min_payout_pct` enforcement, duplicate refusal).
  - Conserved ledger invariant verified (`total_balances 2000 + total_escrowed 1000 == total_minted 3000`).
  - All 46 stored on-chain submissions verified: 100% match with canonical `packet_sha256`.
  - Finalization log verified: 81 of 81 checked receipts confirmed in `FINALIZED` status.

## [3.0.0-candidate] - 2026-10-25

### Added
- **Milestone 1 Pre-Registration**: Committed `docs/MILESTONE_V3_PLAN.md` and `docs/EXPECTED_V3.md` before contract edits or deployments, pre-registering the validator probe protocol, candidate V3 architecture, and gate batch protocol.
- **Before-State Measurement**: Captured baseline metrics in `docs/before_state_v3.json` (V2.1 baseline: 60.0% reliability; V2.2 gate: 76.67% reliability; combined: 66.25% reliability; 100% of failures caused by unauthenticated GitHub REST API rate limits; 7 compared fields in `validator_fn`).
- **Validator Probe Contract & Protocol (Stage 1)**: Extended `contracts/Probe.py` with `probe_v3_quad` and deployed to Studionet at `0xf5256FB126c54719f99C027482220c24E281493b`. Executed 40 sequential validator calls (measured minimum spacing: 7500 ms, average: 7507 ms):
  - `info/refs?service=git-upload-pack`: 40/40 returned 200 OK (100.0%).
  - `pull/{n}.patch`: 40/40 returned 200 OK (100.0%).
  - `compare/{base}...{head}.diff`: 40/40 returned 200 OK (100.0%).
  - REST API contrast: 34/40 returned 200 OK, 6/40 returned 403 Forbidden (85.0% reliability).
  - PR Parity #2–#8: 7/7 identical to stored V2.1 baseline values. Pre-registered GO condition met (`docs/PROBE_V3_DECISION.md`).
- **ShipEscrowV3 Implementation**: Created `contracts/ShipEscrowV3.py` implementing quota-free head authentication via `info/refs`, same-repository verification against branch tips, default branch tip base SHA from symref, commit message trailer parsing from HEAD in `.patch`, and consensus-bound 8-field validator comparison including strict list equality on `criterion_results`. All 84 unit, mocked, and direct mode tests passed.
- **Milestone 1 Fixture PRs**: Provisioned fixture PRs #17–#32 in `hypercybers99/ship-escrow-fixtures` with commit message trailers (`ship-escrow-wallet: 0x...`) in `docs/evidence_v3/fixtures_v3.json`.
- **Candidate V3 Deployment & Gate Batch (Stage 3)**:
  - Deployed `ShipEscrowV3` (`0xDf8Adb520FeE510d8793bC5d01C7aF751A4fE772`) and `ShipReputationV3` (`0x31F0955Ad7bA06C1902d83B876308e5F125865dF`). Decoded on-chain source and verified byte-for-byte exact match.
  - Executed 30 on-chain runs (10 each for F1, F4, F5) with pacing >= 8s (`docs/evidence_v3/gate/`).
  - Achieved **100.0% execution reliability** (30/30 successes, 0 rate limit reverts, 0 network errors).
  - Consensus label agreement: F1 (10/10 `["YES","YES","YES"]`), F4 (8/10 `["YES","YES","NO"]`, 2/10 `["YES","PARTIAL","NO"]`), F5 (10/10 `["NO"]`).
  - Evaluated pre-registered activation condition: Because F4 yielded 8/10 modal agreement instead of >= 9/10, the pre-registered decision triggered: **`REJECT_V3_KEEP_V2_1`**.
  - Rollout stopped, candidate V3 recorded as **"Tried, Not Adopted"**, and **V2.1 contracts remain active**.
- **Comprehensive Milestone 1 Reports**: Added `docs/MILESTONE_1.md` and `docs/FINAL_REPORT_M1.md` with 100% hash verification across all tokens.

## [2.2.1] - 2026-10-24

### Changed
- **Active Contract Source Alignment**: Restored `contracts/ShipEscrowV2.py` to active deployed source (`0x8a9c079a7E1F756e07e8FbE392a5E93106DE28bF`, SHA256: `c00b1366e960882367bf1f3e3c99b975691c28cb29750b7e16a0646e5e353048`), matching `docs/evidence_v2/source/shipescrowv2_onchain.py` with an empty diff.
- **Candidate Contract Relocation**: Moved candidate V2.2 contract to `contracts/candidates/ShipEscrowV2_2_not_adopted.py` and extracted on-chain deployed source to `docs/evidence_v2/source/shipescrowv2_2_not_adopted_onchain.py`.
- **Hash Discrepancy Resolution**: Documented why candidate contract deployed with Windows CRLF has on-chain payload SHA256 `f2e5cd407e493763154307b77c65ad5c058d3985dec625d483991e1e85340f6c` while normalized LF in repo has SHA256 `7b14e4399dd99cff65a47ece067a8cea9d6bcbff55f1ad8debfcdb730c12b3bf`.
- **Test Suite Separation**: Main unit tests (`test_layer3_mocked_contract.py`) and direct mode tests (`test_direct_mode.py`) target active source `contracts/ShipEscrowV2.py`. Candidate V2.2 tests moved to dedicated files (`tests/test_candidate_v2_2.py`, `tests/direct/test_direct_candidate_v2_2.py`).
- **Regenerated Contract Submission Reference**: Updated `docs/CONTRACT_SUBMISSION.md` targeting final tag `se-v2-4`, canonical repository URLs (`hypercybers99`), and heading "Source Verification".
- **Evidence Claim Corrections**:
  - Retracted `probe_old_owner_receipt.json` as it tested singular `/pull/2` rather than `/pulls/2`, removing 404 claims.
  - Labeled `probe_owner_measurement.json` as measured from a local script, not from validators; stated old-owner status on validator nodes as not measured on validators.
  - Formally stated V2.2 gate outcome: `labels were identical in all successful runs; binding was not adopted because the pre-registered success threshold was not met under GitHub unauthenticated rate limits; labels are stored, hash-committed, recomputable and leader-attested; validators compare head, base, diff hash, facts, gate, verdict and payout`.
  - Added script-extracted list of compared fields from real `validator_fn`.

## [2.2.0] - 2026-10-24

### Added
- **Pre-Registered Addendum 3 (Consensus Label Binding Gate)**: Added `docs/ROBUSTNESS_V2_PLAN_ADDENDUM3.md` specifying consensus label vector equality (`criterion_results`) and HTTP diagnostic error messages.
- **Diagnosable HTTP Error Discrimination**: Discriminates HTTP 301/302/307/308 redirects (`"Repository moved: use the current owner/repo name in the bounty and the PR URL"`) and HTTP 403/429 rate limits (`"GitHub rate limit reached, retry later"`), pinned across unit and direct mode tests.
- **Candidate V2.2 Deployment & Empirical Gate Evaluation**: Deployed candidate pair `0x5e403fCB8d05166A132cB9c8885bDc90b767EC6F` and `0xF4b6649e7213874140451e01Faa4d9632A8edDA2`. Executed 30-run Gate Batch across F5, F4, F1 on Studionet. Reached 100% modal label identity on all successful runs (F5: 10/10 `["NO"]`, F4: 7/7 `["YES","YES","NO"]`, F1: 6/6 `["YES","YES","YES"]`), but under sequential bursts multi-criteria fixtures encountered validator IP rate limits (7/10 and 6/10 successes). In accordance with pre-registered gate protocol (requiring >= 9/10 successes), gate outcome evaluated to `REJECT_V2_2_KEEP_V2_1`. V2.2 preserved for audit; V2.1 contracts remain active.
- **Root-Cause Measurements**: Captured `probe_rate_limit_403_receipt.json`, `probe_old_owner_receipt.json` (subsequently retracted due to wrong URL), and 40-sample HTTP measurement `probe_owner_measurement.json` (measured from local script, not from validators).
- **Diagnosable Error Catalog**: Added troubleshooting guide and error catalog table to `README.md` and `docs/LIMITATIONS.md`.

## [2.1.0] - 2026-10-24

### Added
- **Stored Assessment Packets**: Added `criterion_results`, `gate`, and `packet` dictionary storage in `ShipEscrowV2` on-chain storage with matching `scripts/recompute_packet.mjs` verification.
- **GitHub Account Rename Resilience**: Added support for GitHub repository owner alias (`huzyow155` -> `hypercybers99`).
- **Active V2.1 Deployment**: Deployed active pair `0x8a9c079a7E1F756e07e8FbE392a5E93106DE28bF` and `0x8e6D0356F4Bf987E95eB3cC6e7DF84ce2f708C81`.
- **Honest Robustness Attempts Table**: Reconciled all 23 failure receipts, recording true attempt counts (F1: 19, F4: 17, F5: 14) and error distributions in `scripts/robustness_report.mjs`.

## [2.0.0] - 2026-10-21

### Added
- **Multi-Commit Head Proof & Contrast**: Pre-registered and verified on-chain multi-commit proof (`docs/EXPECTED_MULTICOMMIT.md` and `docs/CONTRACT_SUBMISSION.md`). Proved PR #7 rejects first commit, middle commit, and random SHA before consuming attempts; settles real head SHA with `RELEASE_75` (75% payout) and verifies parameter-bound view `is_settled_for`. Proved PR #8 advancing head rejects stale SHA and accepts real head SHA.
- **Section 4 Steward Attack Defense & Lifecycle Proofs**: Executed 6 on-chain proof cases on Studionet: SHA poisoning defense (S4-1), legitimate recovery flow (S4-2), exhaustion flow & escrow refund (S4-3), copied submission defense (S4-4), Sybil exhaustion resistance (S4-5), and submission bond accounting invariants (S4-6).
- **30 Real On-Chain Robustness Batches**: Executed 30 real on-chain transactions across F1, F4, and F5 with 10/10 verdict consistency (`docs/ROBUSTNESS_V2_PLAN.md`). Formally evaluated and confirmed decision `DO_NOT_BIND_LABELS_KEEP_LEADER_ATTESTED`.
- **True Studionet Finalization Verification**: Implemented `scripts/check_finalization_v2.js` querying GenLayer `getTransaction`, confirming 36/36 transactions transitioned to `FINALIZED`.
- **Discrete Direct Mode Suite**: Refactored `tests/direct/test_direct_mode.py` into 10 discrete named test functions passing 10/10 in pytest.
- **Conserved Accounting Ledger**: Added `claim_demo_credits`, debited deposits on `create_bounty`, refundable submission bond (50 credits), and `get_ledger_invariant` view asserting `total_balances + total_escrowed == total_minted`.
- **Authoritative REST API Metadata Authentication**: Fetch `head.sha`, `base.sha`, `body`, `state`, and `user.login` via GitHub REST API, verifying `head.sha == submitted head_sha` before state mutations.
- **Immutable Revision Diff**: Fetch diffs via `compare/<base_sha>...<head_sha>.diff` permanently bound to commit SHAs.
- **Attribution Binding**: Require `ship-escrow-wallet: 0x<caller_address>` marker in the PR body.
- **Attempt Limits**: Implemented per-developer cap (2 attempts) and bounty-level cap (6 attempts), ensuring only authenticated attempts consume counters.
- **Fair Cancellation**: Enforce `attempts == 0` for `cancel_bounty`; added `refund_exhausted` when bounty status reaches `EXHAUSTED`.
- **Multi-Prefix Path Matching**: `required_paths` now checks EVERY mandatory prefix at path segment boundaries.
- **Per-File Deletion Tracking**: Fixed false positives by tracking deletion state per file header (`diff --git`); removed broad `"test" in name` heuristic.
- **Diff Truncation Safety**: Diffs exceeding 14,000 characters deterministically evaluate to `REVIEW`.
- **Consensus Packet Commitments**: Upgraded consensus string from `verdict|sha16` to canonical packet commitment `verdict|payout_pct|packet_sha256`.
- **Parameter-Bound Settlement Verification**: Enhanced `is_settled_for` to accept `min_payout_pct`, checking criteria hash, head SHA, developer address, and payout threshold.
- **Official Direct Mode Test Suite**: Implemented `genlayer-test` Direct Mode covering 10 edge cases.
- **Public CI Workflow**: Added `.github/workflows/ci.yml` running lint, scans, and unit test suites on push.

### Changed
- Superseded V1 contracts (`ShipEscrow.py`, `ShipReputation.py`) and archived in `archive/v1/`.
- Deployed active V2 contracts: `ShipEscrowV2` at `0xAD5579496E66a3ac5C79c27C9Bd8784Aae7747Cd` and `ShipReputationV2` at `0x88F9Bb007266f4e35Ad50a6a244117EC61BC446F`.

## [1.0.0] - 2026-10-16

### Added
- Initial implementation of `ShipEscrow` and `ShipReputation` on GenLayer Studionet.
- Basic diff parsing, LLM semantic evaluation, and multi-validator consensus.
- Fixtures F1-F5.

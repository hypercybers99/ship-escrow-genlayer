# Ship Escrow V3.1 - Honest Limitations & Trust Boundaries

> Status: **Preview**  
> Active Deployment: **ShipEscrowV3_1 (`0x00B2EAD4d361DF5A80Bb111d9D98b8f44EB6E59e`) & ShipReputation (`0x6F95d9DD35D1e19A85D9aB7c467F8660f89954AC`)**  
> Network: **GenLayer Studionet** (Chain ID: 61999)  

> [!IMPORTANT]
> **DISCLAIMER: SIMULATED CREDITS, NOT CUSTODY-BACKED TOKENS**  
> Credits in Ship Escrow are maintained on an internal, conserved accounting ledger with auditable deposit, release, and refund invariants (`total_balances + total_escrowed == total_minted`). They do not represent custody-backed tokens, cryptocurrencies, or monetary value.

This document outlines the architectural trust assumptions, honest boundaries, and deliberate constraints of Ship Escrow on GenLayer Studionet.

---

## 1. Trust Assumptions & Attribution Binding

### Git Commit Trailer (`Ship-Escrow-Dev: 0x<address>`)
- **Mechanism**: The submitter must ensure that the HEAD commit message of the pull request contains the exact commit trailer:
  ```
  Ship-Escrow-Dev: 0x<caller_address>
  ```
- **Trust Model**: The commit message is signed into the commit hash (`head_sha`). It is immutable once created. Validators parse this trailer from the raw git patch (`pull/{n}.patch`).
- **Threat Mitigated**: Third parties cannot observe an open PR and submit it to claim another contributor's reward; any submit call from a wallet that does not match the trailer reverts with `"Pull request is not bound to the submitting wallet"`.
- **Residual Risk**: A developer who rebases or rewrites commit history must ensure the HEAD commit retains this trailer. If missing, submission rejects before consensus without debiting credits or consuming an attempt.

---

## 2. Quota-Free Git Head Authentication & Checked Facts

### Which Pull Request Facts Are Checked by V3.1:
1. **Head SHA**: Checked against `refs/pull/{n}/head` in `info/refs?service=git-upload-pack`.
2. **Base SHA**: Checked against the repository default branch tip identified by the `HEAD` symref in git advertisement.
3. **Same-Repo Verification**: Checked by ensuring `refs/heads/{branch}` matches `refs/pull/{n}/head` in the same git advertisement.
4. **Wallet Binding**: Checked via the `Ship-Escrow-Dev: <wallet>` trailer in the HEAD commit message of `pull/{n}.patch`.
5. **Open Status**: Checked via the presence of `refs/pull/{n}/merge` in git advertisement. If absent, the pull request is rejected with `"Pull request is not open"`.

### Which Pull Request Facts Are NOT Checked:
1. **Author Login**: Not checked. Smart-HTTP git advertisement does not include GitHub account usernames. Attribution is enforced solely via cryptographic wallet binding in the commit trailer.
2. **Draft Status**: **Draft status is not checked**. Measured data from the 40-call Stage 1b validator probe proved that GitHub's git smart-HTTP advertisement produces identical advertisements for open and draft PRs (`refs/pull/{n}/head` and `refs/pull/{n}/merge` are present in 10/10 runs on both open PR #33 and draft PR #34).

---

## 3. Base Drift & Concurrency Boundary

- **Mechanism**: In V3.1, the base commit is the repository default branch tip read at fetch time from git smart-HTTP advertisement.
- **Limitation**: If another contributor merges a commit to the repository's default branch between the leader validator's fetch and a follower validator's fetch, `base_sha` and the resulting diff will differ.
- **Fail-Safe Behavior**: GenLayer's Equivalence Principle detects the mismatch across validators, and the transaction reverts cleanly.
- **No State Change**: A base drift revert debits 0 credits, consumes 0 bounty attempts, and changes no balances. Developers can immediately retry submission once the default branch stabilizes.
- **Reproduction**: Tested and verified in Direct Mode (`tests/direct/test_direct_v3.py::test_v3_1_case8_base_drift_limitation`).

---

## 4. Default-Branch and Same-Repository PR Boundaries

- **Default-Branch Only**: Bounties target the default branch of the repository. Non-default target branches are not supported because the advertisement base is derived from the repository default branch `HEAD` symref.
- **PR Branch Must Exist During Submission**: Same-repo verification verifies `refs/heads/{branch}` matches `refs/pull/{n}/head`. If the developer deletes their branch immediately after creating the PR, the advertisement will not contain the branch ref and submission will reject.

---

## 5. Stuck-Bounty Boundary (No On-Chain Clock)

- **Root Cause**: GenVM currently does not expose a deterministic block timestamp, transaction timestamp, or clock oracle (`gl.block`, `gl.transaction`, and `gl.message.timestamp` do not exist in the runtime; `time.time()` reads non-deterministic host system wall clocks).
- **Design Decision**: To prevent consensus divergence across validators with differing local clocks, Ship Escrow does NOT invent or simulate a clock.
- **Cancel Boundary**: The bounty creator can invoke `cancel_bounty` ONLY while `attempts == 0`.
- **Trade-off**: If a developer submits work that yields `REVIEW` (payout 0%, attempts = 1), the creator cannot unilaterally cancel the bounty to reclaim escrowed funds. The bounty remains open until subsequent submissions either settle (`RELEASE_x`), reject (`REFUND`), or reach the total cap of 6 attempts (`EXHAUSTED`), at which point `refund_exhausted` unlocks the creator's deposit. This design prioritizes protecting developers against malicious maintainer cancellations over creator liquidity.

---

## 6. Diff Cap & Truncation Safety

- **14,000 Character Boundary**: Diff texts are capped at 14,000 characters to prevent GenVM out-of-memory faults and keep LLM context evaluation bounded.
- **Fail-Safe Rule**: If a diff is truncated, the contract strictly forbids releasing funds or failing on missing files. Any truncated diff evaluation automatically yields `REVIEW` with 0% payout.

---

## 7. Simulated Accounting Ledger, Not External Custody

- **Ledger Invariant**: Balances are conserved internally (`total_balances + total_escrowed == total_minted`).
- **No Native Token Custody**: No ERC-20 tokens, wrapped assets, or native gas coins are held in smart contract custody. The contract provides verifiable settlement accounting, not financial asset custody.

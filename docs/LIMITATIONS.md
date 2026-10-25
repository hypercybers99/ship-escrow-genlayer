# Ship Escrow V2 - Honest Limitations & Trust Boundaries

> Status: **Preview**  
> Network: **GenLayer Studionet** (Chain ID: 61999)  

> [!IMPORTANT]
> **DISCLAIMER: SIMULATED CREDITS, NOT CUSTODY-BACKED TOKENS**  
> Credits in Ship Escrow V2 are maintained on an internal, conserved accounting ledger with auditable deposit, release, and refund invariants (`total_balances + total_escrowed == total_minted`). They do not represent custody-backed tokens, cryptocurrencies, or monetary value.

This document outlines the architectural trust assumptions, honest boundaries, and deliberate constraints of Ship Escrow V2 on GenLayer Studionet.

---

## 1. Trust Assumptions & Attribution Binding

### PR Body Wallet Marker (`ship-escrow-wallet: 0x<address>`)
- **Mechanism**: The submitter must ensure the PR body on GitHub contains the exact line:
  ```
  ship-escrow-wallet: 0x<caller_address>
  ```
- **Trust Model**: Ship Escrow trusts GitHub's access control: only the PR creator or repository maintainers with write permissions can edit the PR body.
- **Threat Mitigated**: Third parties cannot observe an open PR and submit it to claim another contributor's reward (attempt fails before consensus with `"Pull request is not bound to the submitting wallet"`).
- **Residual Risk**: A malicious repository maintainer could theoretically edit a contributor's PR description on GitHub to hijack attribution before on-chain submission. Contributors should submit on-chain immediately after opening their pull request.

---

## 2. GitHub REST API, Rate Limits & Owner Observations

- **Unauthenticated Endpoint Usage**: Validators independently query `https://api.github.com/repos/<owner>/<repo>/pulls/<n>`. Unauthenticated requests on GitHub are subject to IP-based rate limits (60 requests per hour per egress IP).
- **Original Robustness Run Observations**:
  - Across the 30 initial robustness runs on active V2.1 (`0x8a9c...`), 10 runs succeeded while 20 failed with `"Pull request metadata unavailable"`.
  - Why 10 runs succeeded with old-owner (`huzyow155`) URLs while 20 failed remains an **unexplained observation**.
  - The actual HTTP response codes received by individual validator nodes on Studionet were **not measured on validators**.
  - Subsequent 40-sample response tests showing HTTP 301 redirects for the old owner were measured from a local script, not from validators.
  - An earlier probe file (`probe_old_owner_receipt.json`) tested `.../pull/2` (singular) rather than `.../pulls/2`, causing a 404 from GitHub; this file has been marked as a wrong URL and retracted from all claims.
- **Candidate V2.2 Gate Protocol Observations**:
  - Candidate V2.2 introduced discriminative error messages (`"GitHub rate limit reached, retry later"` for HTTP 403/429 and `"Repository moved..."` for 301 redirects).
  - In the 30-run Addendum 3 Gate Batch, all 23 successful runs had identical label vectors; the gate failed on availability due to unauthenticated GitHub rate limits (`"GitHub rate limit reached, retry later"`), not label disagreement.
  - Pre-registered gate outcome: `labels were identical in all successful runs; binding was not adopted because the pre-registered success threshold was not met under GitHub unauthenticated rate limits; labels are stored, hash-committed, recomputable and leader-attested; validators compare head, base, diff hash, facts, gate, verdict and payout`.
- **Candidate V3 Milestone 1 Gate Protocol Observations**:
  - Candidate V3 evaluated quota-free head authentication via `info/refs?service=git-upload-pack`, commit message trailer parsing from HEAD in `.patch`, and consensus-bound label vectors.
  - Across 40 sequential validator probe calls, `info/refs`, `.patch`, and `compare.diff` all scored 100% 200 OK responses, whereas the unauthenticated REST API contrast suffered a 15% 403 rate-limit failure rate.
  - Across the 30-run Milestone 1 Gate Batch, execution reliability was 100.0% (30/30 successes without a single rate limit revert).
  - However, on Fixture F4 (partial release), consensus-bound label vectors yielded 8/10 modal vector agreement (`["YES","YES","NO"]` 8/10, `["YES","PARTIAL","NO"]` 2/10), failing the pre-registered requirement of >= 9/10 identical label vectors.
  - As pre-registered in `docs/MILESTONE_V3_PLAN.md`, rollout was stopped, V3 was marked as "Tried, Not Adopted", and active deployment remains V2.1 (`0x8a9c079a7E1F756e07e8FbE392a5E93106DE28bF`).
- **Usage Guidance & Safety Guarantee**:
  - Submissions should be spaced several minutes apart to avoid triggering GitHub's rolling unauthenticated IP rate window.
  - If a rate limit is encountered, developers should simply retry after several minutes.
  - A failed submission changes no balance, debits no credits, and consumes no bounty attempt counters (verified in receipts such as [`docs/evidence_v2/robustness_v2_2/failures/f4_run_08_raw.json`](file:///E:/ShipEscrow_V2/docs/evidence_v2/robustness_v2_2/failures/f4_run_08_raw.json)).

---

## 3. Same-Repository Pull Request Restriction

- **Requirement**: The pull request `head.repo.full_name` must equal `base.repo.full_name`.
- **Rationale**: Fetching immutable revision diffs via `https://github.com/<owner>/<repo>/compare/<base_sha>...<head_sha>.diff` requires both commits to reside within the same repository. Cross-fork compare diffs can produce ambiguous merge bases or missing diff responses across independent validator network routes.
- **Integration Impact**: Bounties require contributors to push branches directly to the repository (e.g. feature branches) or maintainers to mirror fork branches before on-chain submission.

---

## 4. Stuck-Bounty Boundary (No On-Chain Clock)

- **Root Cause**: GenVM currently does not expose a deterministic block timestamp, transaction timestamp, or clock oracle (`gl.block`, `gl.transaction`, and `gl.message.timestamp` do not exist in the runtime; `time.time()` reads non-deterministic host system wall clocks).
- **Design Decision**: To prevent consensus divergence across validators with differing local clocks, Ship Escrow V2 does NOT invent or simulate a clock.
- **Cancel Boundary**: The bounty creator can invoke `cancel_bounty` ONLY while `attempts == 0`.
- **Trade-off**: If a developer submits work that yields `REVIEW` (payout 0%, attempts = 1), the creator cannot unilaterally cancel the bounty to reclaim escrowed funds. The bounty remains open until subsequent submissions either settle (`RELEASE_x`), reject (`REFUND`), or reach the total cap of 6 attempts (`EXHAUSTED`), at which point `refund_exhausted` unlocks the creator's deposit. This design prioritizes protecting developers against malicious maintainer cancellations over creator liquidity.

---

## 5. Diff Cap & Truncation Safety

- **14,000 Character Boundary**: Diff texts are capped at 14,000 characters to prevent GenVM out-of-memory faults and keep LLM context evaluation bounded.
- **Fail-Safe Rule**: If a diff is truncated, the contract strictly forbids releasing funds or failing on missing files. Any truncated diff evaluation automatically yields `REVIEW` with 0% payout.

---

## 6. Simulated Accounting Ledger, Not External Custody

- **Ledger Invariant**: Balances are conserved internally (`total_balances + total_escrowed == total_minted`).
- **No Native Token Custody**: No ERC-20 tokens, wrapped assets, or native gas coins are held in smart contract custody. The contract provides verifiable settlement accounting, not financial asset custody.

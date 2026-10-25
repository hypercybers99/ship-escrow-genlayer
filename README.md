# Ship Escrow Intelligent Contract (V3.1)

[![CI](https://github.com/hypercybers99/ship-escrow-genlayer/actions/workflows/ci.yml/badge.svg)](https://github.com/hypercybers99/ship-escrow-genlayer/actions/workflows/ci.yml)

> Status: **Preview**  
> Target Network: **GenLayer Studionet** (Chain ID: 61999)  
> License: MIT (Copyright 2026 Hyper, hypercybers99)  
>
> **Active Contracts (V3.1 - Adopted)**:
> - ShipEscrowV3_1: [`0x00B2EAD4d361DF5A80Bb111d9D98b8f44EB6E59e`](https://explorer-studio.genlayer.com/address/0x00B2EAD4d361DF5A80Bb111d9D98b8f44EB6E59e)  
> - ShipReputation: [`0x6F95d9DD35D1e19A85D9aB7c467F8660f89954AC`](https://explorer-studio.genlayer.com/address/0x6F95d9DD35D1e19A85D9aB7c467F8660f89954AC)  
>
> **Candidate Contracts (Milestone 1 - Tried, Not Adopted)**:
> - ShipEscrowV3: [`0xDf8Adb520FeE510d8793bC5d01C7aF751A4fE772`](https://explorer-studio.genlayer.com/address/0xDf8Adb520FeE510d8793bC5d01C7aF751A4fE772)  
> - ShipReputationV3: [`0x31F0955Ad7bA06C1902d83B876308e5F125865dF`](https://explorer-studio.genlayer.com/address/0x31F0955Ad7bA06C1902d83B876308e5F125865dF)  
>
> **Baseline Contracts (V2.1 - Superseded)**:
> - ShipEscrowV2: [`0x8a9c079a7E1F756e07e8FbE392a5E93106DE28bF`](https://explorer-studio.genlayer.com/address/0x8a9c079a7E1F756e07e8FbE392a5E93106DE28bF)  
> - ShipReputationV2: [`0x8e6D0356F4Bf987E95eB3cC6e7DF84ce2f708C81`](https://explorer-studio.genlayer.com/address/0x8e6D0356F4Bf987E95eB3cC6e7DF84ce2f708C81)  
>
> **Superseded Contracts (Audit only)**:
> - ShipEscrowV2 (initial): [`0xAD5579496E66a3ac5C79c27C9Bd8784Aae7747Cd`](https://explorer-studio.genlayer.com/address/0xAD5579496E66a3ac5C79c27C9Bd8784Aae7747Cd)  
> - ShipReputationV2 (initial): [`0x88F9Bb007266f4e35Ad50a6a244117EC61BC446F`](https://explorer-studio.genlayer.com/address/0x88F9Bb007266f4e35Ad50a6a244117EC61BC446F)  
> - ShipEscrowV1: [`0x8DC94110Ed3E111Fb74Dce849CdBA8f567E6024F`](https://explorer-studio.genlayer.com/address/0x8DC94110Ed3E111Fb74Dce849CdBA8f567E6024F)  
> - ShipReputationV1: [`0x55c56f0dfFb8227345814A37c68394b05c26E901`](https://explorer-studio.genlayer.com/address/0x55c56f0dfFb8227345814A37c68394b05c26E901)  
>
> **External Links**:
> - Web app (Preview): https://ship-escrow-app.vercel.app  
> - App repository: https://github.com/hypercybers99/ship-escrow-app  
> - Fixtures repository: https://github.com/hypercybers99/ship-escrow-fixtures  

> [!NOTE]
> **GitHub Account Rename**: The GitHub username `huzyow155` was renamed to `hypercybers99`. GitHub automatically maintains permanent redirects for repositories and pull requests (`https://github.com/huzyow155/ship-escrow-fixtures` -> `https://github.com/hypercybers99/ship-escrow-fixtures`). Both URLs route to the identical git repository, commits, and pull requests. In Ship Escrow contracts, validation logic explicitly recognises this alias and resolves repo names seamlessly.  

> [!IMPORTANT]
> **DISCLAIMER: SIMULATED CREDITS, NOT CUSTODY-BACKED TOKENS**  
> Credits in Ship Escrow are maintained on an internal, conserved accounting ledger with auditable deposit, release, and refund invariants (`total_balances + total_escrowed == total_minted`). They do not represent custody-backed tokens, cryptocurrencies, or monetary value.

---

Ship Escrow is an Intelligent Contract on GenLayer that automates bounty escrow settlement for GitHub pull requests. It combines deterministic structural diff parsing, hard safety gates, cryptographic packet commitments, and multi-validator LLM consensus to evaluate code against human-written acceptance criteria.

---

## How to try it in 2 minutes

No wallet is needed to read:
1. Open the web app: https://ship-escrow-app.vercel.app
2. Inspect settled bounties and review on-chain verdict stamps (`RELEASE_100`, `RELEASE_75`, `REFUND`, `REVIEW`).
3. Scroll to the **Settlement Verification Tool**: click **Verify Settlement On-Chain** to confirm settlement parameters match on-chain facts.
4. Click **Mutate 1 Char** and verify it returns false when criteria or head SHA are altered.
5. Open the **Evidence** page to review all pre-registered fixture predictions against on-chain transaction receipts.

---

## 1. Problem Statement & V3.1 Improvements

Open-source bounty programs traditionally suffer from maintainer delays, arbitrary rejections, or naive bot automation that gets gamed by deleting tests or touching unrelated files.

In V3.1, Ship Escrow delivers:
1. **Conserved Credit Ledger**: Enforces `total_balances + total_escrowed == total_minted` invariant across `claim_demo_credits`, `create_bounty`, `submit_work`, `cancel_bounty`, and `refund_exhausted`.
2. **Quota-Free Git Head Authentication**: Authenticates pull requests directly through git smart-HTTP advertisement (`/info/refs?service=git-upload-pack`) without relying on GitHub's unauthenticated REST API rate limits, achieving 100% execution reliability.
3. **Commit Trailer Attribution Binding**: Binds work submission to the caller wallet via the git commit trailer `Ship-Escrow-Dev: <caller_address>` in the HEAD commit message of `pull/{n}.patch`.
4. **Strict Diff Parsing & Hard Gates**: Requires touching EVERY mandatory prefix (at path boundaries), isolates test file deletions per file header (no broad keyword heuristics), and forces `REVIEW` on truncated diffs.
5. **Auditable Assessment Packet Commitments**: Stored assessments commit to all facts, diff SHA-256, gate, verdict, payout percentage, and leader-attested criterion labels in `packet_sha256`, enabling parameter-bound `is_settled_for` and reputation tracking.

---

## 2. Why GenLayer

Ship Escrow leverages unique GenLayer capabilities:
- **Direct Web Access**: Validators independently fetch public git advertisement streams and immutable diffs over HTTPS.
- **Natural Language & Semantic Judgment**: Validators interpret whether code changes fulfill written acceptance criteria using an LLM.
- **Equivalence Principle**: Multi-validator consensus validates strict equality of all 7 core deterministic and settlement fields (`head_sha`, `base_sha`, `diff_sha256`, `facts`, `gate`, `verdict`, `payout_pct`).

---

## 3. Non-Goals & Trust Boundaries

- **No Token Custody**: Studionet does not provide external token custody. Balances are tracked as credit accounts in an on-contract ledger.
- **No Dynamic Code Execution**: Ship Escrow does not run compilers, execute tests, or execute arbitrary code. It judges textual diffs and metadata.
- **Public GitHub Repositories Only**: Private repositories, GitLab, and other code hosts are out of scope.
- **Default-Branch Target & Same-Repository Pull Requests**: Required for immutable git advertisement base resolution and compare-by-SHA diff availability.
- **Base Drift Limitation**: If the default branch moves between leader and validator fetch, consensus reverts cleanly without debiting credits or consuming an attempt. Submissions may be retried immediately.
- **No Native Deadlines**: Due to lack of a trusted on-chain clock in GenVM, time-based expirations are not enforced. Cancel is allowed only when `attempts == 0`.

---

## 4. Contract Architecture

- **`ShipEscrowV3_1.py`**: The active Intelligent Contract handling bounty lifecycle, conserved credit balances, attempt caps, diff parsing, and packet commitments.
- **`ShipReputationV2.py`**: Cross-contract reputation consumer contract synchronizing verified settlements via `is_settled_for` with parameter-bound threshold checks.
- **`contracts/candidates/`**: Candidate contracts evaluated under gate protocols and preserved for audit.
- **`archive/v1/`**: Superseded V1 contracts preserved for historical audit.

---

## 5. Repository Structure

```
.
├── contracts/
│   ├── ShipEscrowV3_1.py      # Active Intelligent Contract (V3.1)
│   ├── ShipReputationV2.py    # Reputation Consumer Contract
│   ├── candidates/            # Evaluated candidate contracts (V2.2, V3)
│   └── Probe.py               # Runtime diagnostic probe
├── archive/
│   └── v1/                    # Superseded V1 contracts (audit only)
├── fixtures/
│   ├── fixtures_v2.json       # F1-F12 test fixtures catalog
│   └── EXPECTED.md            # Pre-registered predictions
├── docs/
│   ├── ADDRESS_REGISTRY.md    # Active V3.1 and historic contracts registry
│   ├── MILESTONE_1.md         # Milestone 1 final truth & empirical analysis
│   ├── CONTRACT_SUBMISSION.md # Active deployment reference & verification
│   ├── DESIGN.md              # Architecture & packet commitment design
│   ├── LIMITATIONS.md         # Honest limitations & trust boundaries
│   ├── VERIFICATION.md        # Full verification suite results
│   └── evidence_v3_1/         # V3.1 deploy, gate, and scenario receipts
├── tests/
│   ├── test_v3_pure.py        # Layer 1: V3.1 parser & pure functions
│   ├── test_layer2_ledger_fuzz.py # Layer 2: 5000-iteration ledger fuzz & attacks
│   ├── test_layer3_v3_mocked.py # Layer 3: End-to-end pipeline simulation
│   └── direct/                # Official Direct Mode genlayer-test suite
└── scripts/
    ├── deploy/                # Deploy & verification scripts
    ├── check_finalization_v3_1.mjs # Finalization status tracker
    └── recompute_packet.mjs   # Packet commitment verifier
```

---

## 6. Error Catalog & Diagnosable Error Strings ("If You See This Error")

| On-Chain Error Message | Exact Trigger Condition | Cause / Investigation | Action / Resolution |
| :--- | :--- | :--- | :--- |
| `"Repository moved or renamed, update the bounty repo"` | Git HTTP returns `301`, `302`, `307`, or `308` redirect. | Repository was renamed or transferred to a new GitHub organization/owner. | Bounty creator and developer must specify the canonical current owner/repo in bounty repository field and PR URL. |
| `"GitHub rate limit reached, retry later"` | Git HTTP returns `429` (IP rate limit exceeded). | Rate limit exceeded. | Wait 1-2 minutes, then resubmit. Transaction reverts without debiting credits or consuming submission attempts. |
| `"GitHub service temporarily unavailable, retry later"` | Git HTTP returns `500`, `502`, `503`, or `504`. | GitHub experiencing service degradation. | Wait for GitHub availability to restore and retry submission. |
| `"Pull request is not open"` | Git advertisement lacks `refs/pull/{n}/merge`. | Pull request is closed, merged, or does not exist. | Open the pull request on GitHub before submitting. |
| `"Pull request is not bound to the submitting wallet"` | Commit patch lacks `Ship-Escrow-Dev: <caller_address>`. | Submitting wallet differs from the trailer in HEAD commit message. | Developer must add `Ship-Escrow-Dev: <caller_address>` trailer to the HEAD commit message. |
| `"Head sha does not match the pull request head"` | Submitted commit SHA differs from `refs/pull/{n}/head`. | Stale commit hash submitted, or new commit pushed after hash was copied. | Run `git rev-parse HEAD` on the PR branch and submit the current head commit SHA. |
| `"Pull request branch not found in repository"` | PR head SHA does not match any branch tip in `refs/heads/`. | Pull request submitted from an external fork instead of a branch within the target repository. | Push branch directly to the target repository (same-repo pull request). |
| `"Diff exceeds maximum allowed size (14000 chars)"` | Raw compare diff exceeds 14,000 characters. | Large pull request touching many files or large assets. | Automatically sets gate `diff_truncated`, yielding `REVIEW` verdict (0% payout) for human review. |
| `"Required path boundary was not touched"` | No modified file starts with the mandatory path prefix. | Pull request made changes entirely outside the required paths specified in the bounty. | Modify files under the mandatory paths defined in bounty acceptance criteria. |

# Ship Escrow Intelligent Contract (V2)

[![CI](https://github.com/huzyow155/ship-escrow-genlayer/actions/workflows/ci.yml/badge.svg)](https://github.com/huzyow155/ship-escrow-genlayer/actions/workflows/ci.yml)

> Status: **Preview**  
> Target Network: **GenLayer Studionet** (Chain ID: 61999)  
> License: MIT (Copyright 2026 Hyper, huzyow155)  
>
> **Active Contracts (V2.1)**:
> - ShipEscrowV2: [`0x8a9c079a7E1F756e07e8FbE392a5E93106DE28bF`](https://explorer-studio.genlayer.com/address/0x8a9c079a7E1F756e07e8FbE392a5E93106DE28bF)  
> - ShipReputationV2: [`0x8e6D0356F4Bf987E95eB3cC6e7DF84ce2f708C81`](https://explorer-studio.genlayer.com/address/0x8e6D0356F4Bf987E95eB3cC6e7DF84ce2f708C81)  
>
> **Candidate Contracts (Milestone 1 - Tried, Not Adopted)**:
> - ShipEscrowV3: [`0xDf8Adb520FeE510d8793bC5d01C7aF751A4fE772`](https://explorer-studio.genlayer.com/address/0xDf8Adb520FeE510d8793bC5d01C7aF751A4fE772)  
> - ShipReputationV3: [`0x31F0955Ad7bA06C1902d83B876308e5F125865dF`](https://explorer-studio.genlayer.com/address/0x31F0955Ad7bA06C1902d83B876308e5F125865dF)  
>
> **Superseded Contracts (Audit only)**:
> - ShipEscrowV2 (initial): [`0xAD5579496E66a3ac5C79c27C9Bd8784Aae7747Cd`](https://explorer-studio.genlayer.com/address/0xAD5579496E66a3ac5C79c27C9Bd8784Aae7747Cd)  
> - ShipReputationV2 (initial): [`0x88F9Bb007266f4e35Ad50a6a244117EC61BC446F`](https://explorer-studio.genlayer.com/address/0x88F9Bb007266f4e35Ad50a6a244117EC61BC446F)  
> - ShipEscrowV1: [`0x8DC94110Ed3E111Fb74Dce849CdBA8f567E6024F`](https://explorer-studio.genlayer.com/address/0x8DC94110Ed3E111Fb74Dce849CdBA8f567E6024F)  
> - ShipReputationV1: [`0x55c56f0dfFb8227345814A37c68394b05c26E901`](https://explorer-studio.genlayer.com/address/0x55c56f0dfFb8227345814A37c68394b05c26E901)  
>
> **External Links**:
> - Web app (Preview): https://ship-escrow-app.vercel.app  
> - App repository: https://github.com/huzyow155/ship-escrow-app  
> - Fixtures repository: https://github.com/huzyow155/ship-escrow-fixtures  

> [!NOTE]
> **GitHub Account Rename**: The GitHub username `huzyow155` was renamed to `hypercybers99`. GitHub automatically maintains permanent redirects for repositories and pull requests (`https://github.com/huzyow155/ship-escrow-fixtures` -> `https://github.com/hypercybers99/ship-escrow-fixtures`). Both URLs route to the identical git repository, commits, and pull requests. In ShipEscrowV2, the contract validation logic explicitly recognises this alias and resolves repo names seamlessly.  

> [!IMPORTANT]
> **DISCLAIMER: SIMULATED CREDITS, NOT CUSTODY-BACKED TOKENS**  
> Credits in Ship Escrow V2 are maintained on an internal, conserved accounting ledger with auditable deposit, release, and refund invariants (`total_balances + total_escrowed == total_minted`). They do not represent custody-backed tokens, cryptocurrencies, or monetary value.

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

## 1. Problem Statement & V2 Steward Improvements

Open-source bounty programs traditionally suffer from maintainer delays, arbitrary rejections, or naive bot automation that gets gamed by deleting tests or touching unrelated files.

In V2, Ship Escrow addresses all 5 steward audit findings:
1. **Conserved Credit Ledger**: Enforces `total_balances + total_escrowed == total_minted` invariant across `claim_demo_credits`, `create_bounty`, `submit_work`, `cancel_bounty`, and `refund_exhausted`.
2. **Authenticated, Immutable Revision**: Evaluates pull requests strictly by immutable `compare/<base_sha>...<head_sha>.diff` verified against the authoritative GitHub REST API `head.sha`, rejecting draft, closed-unmerged, or cross-repo pull requests before state mutations.
3. **Attribution Binding & Anti-Spam**: Requires explicit PR body marker `ship-escrow-wallet: 0x<address>` matching the caller, debits a refundable submission bond (50 credits), and enforces attempt caps (2 per developer, 6 per bounty).
4. **Strict Diff Parsing & Hard Gates**: Requires touching EVERY mandatory prefix (at path boundaries), isolates test file deletions per file header (no broad keyword heuristics), and forces `REVIEW` on truncated diffs.
5. **Canonical Consensus Packet Commitments**: Consensus is reached on `verdict|payout_pct|packet_sha256` committing to all facts, metadata, diff SHA-256, and criteria hash, with parameter-bound `is_settled_for` and synchronous reputation tracking.

---

## 2. Why GenLayer

Ship Escrow leverages unique GenLayer capabilities:
- **Direct Web Access**: Validators independently fetch public GitHub pull request metadata and immutable diffs over HTTPS.
- **Natural Language & Semantic Judgment**: Validators interpret whether code changes fulfill written acceptance criteria using an LLM.
- **Equivalence Principle**: Multi-validator consensus validates strict equality of the assessment packet digest (`gl.eq_principle.strict_eq`).

---

## 3. Non-Goals & Trust Boundaries

- **No Token Custody**: Studionet does not provide external token custody. Balances are tracked as credit accounts in an on-contract ledger.
- **No Dynamic Code Execution**: Ship Escrow does not run compilers, execute tests, or execute arbitrary code. It judges textual diffs and metadata.
- **Public GitHub Repositories Only**: Private repositories, GitLab, and other code hosts are out of scope.
- **Same-Repository Pull Requests**: Required for immutable compare-by-SHA diff availability.
- **No Native Deadlines**: Due to lack of a trusted on-chain clock in GenVM, time-based expirations are not enforced. Cancel is allowed only when `attempts == 0`.

---

## 4. Contract Architecture

- **`ShipEscrowV2.py`**: The primary Intelligent Contract handling bounty lifecycle, conserved credit balances, attempt caps, submission bonds, diff parsing, and packet commitments.
- **`ShipReputationV2.py`**: Cross-contract reputation consumer contract synchronizing verified settlements via `is_settled_for` with parameter-bound threshold checks.
- **`archive/v1/`**: Superseded V1 contracts preserved for historical audit.

---

## 5. Repository Structure

```
.
├── contracts/
│   ├── ShipEscrowV2.py        # Primary Intelligent Contract (V2)
│   ├── ShipReputationV2.py    # Reputation Consumer Contract (V2)
│   └── Probe.py               # Runtime diagnostic probe
├── archive/
│   └── v1/                    # Superseded V1 contracts (audit only)
├── fixtures/
│   ├── fixtures_v2.json       # F1-F12 test fixtures catalog
│   ├── EXPECTED.md            # Pre-registered predictions
│   └── diffs_v2/              # Immutable recorded diff files
├── docs/
│   ├── PROBE_DECISIONS.md     # Studionet empirical runtime probe findings
│   ├── EXPECTED.md            # Pre-registered fixture outcomes (2ef5070 baseline)
│   ├── EXPECTED_AMENDMENT.md  # Throwaway address & PR body audit amendment
│   ├── EXPECTED_MULTICOMMIT.md# Multi-commit head verification pre-registration
│   ├── EXPECTED_SECTION4.md   # Section 4 lifecycle & attack pre-registration
│   ├── ROBUSTNESS_V2_PLAN.md  # 30-run robustness pre-registration plan
│   ├── CONTRACT_SUBMISSION.md # Multi-commit proof report for reviewer
│   ├── DESIGN.md              # V2 architecture & packet commitment design
│   ├── ERROR_CODES.md         # Pinned error catalog
│   ├── LIMITATIONS.md         # Honest limitations & trust boundaries
│   ├── INTEGRATION.md         # Full frontend and SDK integration guide
│   ├── VERIFICATION.md        # On-chain test results and receipts
│   └── ADDRESS_REGISTRY.md    # Active V2 and superseded V1 contracts
├── tests/
│   ├── test_layer1_pure.py    # Layer 1: Pure functions & parser parity
│   ├── test_layer2_ledger_fuzz.py # Layer 2: 5000-iteration ledger fuzz & attacks
│   ├── test_layer3_mocked_contract.py # Layer 3: End-to-end pipeline simulation
│   └── direct/                # Official Direct Mode genlayer-test suite (10 discrete named tests)
└── scripts/
    ├── deploy/                # Deploy & verification scripts
    ├── run_real_robustness_batches.js # 30-run real on-chain robustness evaluation
    ├── robustness_report.mjs  # Robustness analysis & report generator
    ├── run_multicommit_proofs.mjs # Multi-commit on-chain verification suite
    ├── run_section4_proofs.js # Section 4 attack defense & lifecycle suite
    ├── check_finalization_v2.js  # Finalization status tracker
    └── v2_report.mjs          # Comprehensive verification report generator
```

---

## 6. Error Catalog & Diagnosable Error Strings ("If You See This Error")

Ship Escrow V2 discriminates API error codes and diff edge cases at the contract boundary so that users receive actionable diagnostic messages rather than generic reverts:

| On-Chain Error Message | Exact Trigger Condition | Cause / Investigation | Action / Resolution |
| :--- | :--- | :--- | :--- |
| `"Repository moved: use the current owner/repo name in the bounty and the PR URL"` | GitHub REST API returns HTTP `301`, `302`, `307`, or `308` redirect. | Repository was renamed or transferred to a new GitHub organization/owner (`huzyow155` -> `hypercybers99`). | Bounty creator and developer must specify the canonical current owner/repo (`hypercybers99/ship-escrow-fixtures`) in bounty repository field and PR URL. |
| `"GitHub rate limit reached, retry later"` | GitHub REST API returns HTTP `403` or `429` (IP rate limit exceeded). | Unauthenticated requests exceed GitHub's hourly rolling quota (60 requests/hour per egress IP). | Wait 1-2 minutes for the rolling rate-limit window to reset, then resubmit. Transaction reverts without debiting credits or consuming submission attempts. |
| `"Pull request metadata unavailable"` | GitHub REST API returns HTTP `404`, `500`, `502`, `503`, or invalid JSON payload. | The PR does not exist, repository is private, or GitHub is experiencing service degradation. | Verify the PR number exists, is publicly accessible in a web browser without login, and retry after GitHub service normalizes. |
| `"Pull request is not open or merged"` | Pull request `state != "open"` and `merged == False`, or `draft == True`. | The pull request is marked as a draft, or was closed without being merged into the base branch. | Mark draft PRs as "Ready for review" on GitHub, or ensure closed PRs were merged before submission. |
| `"Pull request is not bound to the submitting wallet"` | PR description body lacks `ship-escrow-wallet: 0x<caller_address>`. | Attacker attempt or missing wallet marker in the GitHub pull request markdown description. | Developer must edit the PR description on GitHub to include `ship-escrow-wallet: <caller_address>` before calling `submit_work`. |
| `"Head sha does not match the pull request head"` | Submitted commit SHA differs from the PR tip commit SHA (`meta["head"]["sha"]`). | Stale commit hash submitted, or new commit pushed after hash was copied. | Run `git rev-parse HEAD` on the PR branch, or inspect GitHub PR "Commits" tab, and submit the current head commit SHA. |
| `"Head repo does not match bounty repo"` | PR `head.repo.full_name` does not match the target repository. | Pull request submitted from an external fork repository instead of a branch within the target repository. | Push branch directly to the target repository (same-repo pull request) so immutable compare diffs can be evaluated. |
| `"Diff exceeds maximum allowed size (14000 chars)"` | Raw compare diff exceeds 14,000 characters. | Large pull request touching many files or large assets. | Automatically sets gate `diff_truncated`, yielding `REVIEW` verdict (0% payout) for human review. |
| `"Required path boundary was not touched"` | No modified file starts with the mandatory path prefix. | Pull request made changes entirely outside the required paths specified in the bounty. | Modify files under the mandatory paths defined in bounty acceptance criteria. |


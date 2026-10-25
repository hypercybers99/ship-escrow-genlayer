# Milestone 1: Quota-Free Head Authentication & V3.1 Adoption

> Status: **Preview**  
> Active Deployment: **ShipEscrowV3_1 (`0x00B2EAD4d361DF5A80Bb111d9D98b8f44EB6E59e`) & ShipReputation (`0x6F95d9DD35D1e19A85D9aB7c467F8660f89954AC`)**  
> Candidate V3 (Tried, Not Adopted): **ShipEscrowV3 (`0xDf8Adb520FeE510d8793bC5d01C7aF751A4fE772`)**  
> Baseline Deployment (Superseded): **ShipEscrowV2 (`0x8a9c079a7E1F756e07e8FbE392a5E93106DE28bF`)**  
> Network: **GenLayer Studionet** (Chain ID: 61999)  

---

## 1. Executive Summary & Problem Analysis

In Ship Escrow V2.1, pull requests were authenticated against GitHub's public REST API (`api.github.com/repos/{owner}/{repo}/pulls/{n}`). Because GenLayer validators execute non-deterministic HTTP requests from shared cloud egress subnets without API keys, validator transactions routinely hit GitHub's unauthenticated 60 requests/hour IP rate limit.

### Measured Baseline Prior to Milestone 1
Across all pre-registered runs prior to Milestone 1 (`docs/before_state_v3.json`):
- **V2.1 Robustness Batch**: 50 attempts, 30 successes, 20 failures (**60.0% reliability**).
- **V2.2 Gate Batch**: 30 attempts, 23 successes, 7 failures (**76.67% reliability**).
- **Combined Baseline**: 80 attempts, 53 successes, 27 failures (**66.25% reliability**).
- **Failure Cause**: 100% of recorded failures (27/27) were transaction reverts carrying the exact error string `"GitHub rate limit reached, retry later"` (HTTP 403).

Milestone 1 eliminated this architectural dependency by migrating head authentication and diff retrieval to quota-free git smart-HTTP advertisement and commit patch streams.

---

## 2. Architectural Changes in V3 & V3.1

| Component | Baseline V2.1 (Superseded) | Active V3.1 (Adopted) |
|---|---|---|
| **Head Authentication** | `api.github.com/repos/.../pulls/{n}` JSON (`head.sha`) | `info/refs?service=git-upload-pack` (`refs/pull/{n}/head`) |
| **Quota Constraint** | 60 unauthenticated reqs/hr/IP (frequent 403 reverts) | Quota-free git smart-HTTP advertisement |
| **Same-Repo Verification** | REST JSON `head.repo.full_name == base.repo.full_name` | Branch tip check: `refs/heads/{branch}` equals `refs/pull/{n}/head` |
| **Base Commit Resolution** | REST API `base.sha` | `HEAD` symref in git advertisement |
| **Diff Retrieval** | `pull/{n}.diff` | Pinned `compare/{base}...{head}.diff` |
| **Wallet Binding** | Regex parsing of pull request body text | `ship-escrow-wallet: 0x<wallet>` trailer in HEAD commit message (`pull/{n}.patch`) |
| **PR State Checking** | REST JSON `state == "open"`, `draft == false` | Enforced presence of `refs/pull/{n}/merge` (rejects closed/merged PRs) |
| **HTTP Error Handling** | Generic HTTP failures | Specific error strings: 301/302/307/308 ("Repository moved: use the current owner/repo name"), 403/429 ("GitHub rate limit reached, retry later"), 5xx ("GitHub source unreachable") |
| **Validator Consensus** | 7 fields compared; labels leader-attested | 7 fields compared; labels leader-attested & hash-committed |

---

## 3. Empirical Measurements & Verification

### Validator Availability & Reliability Contrast
- **V3 Diagnostic Probe**: 40 sequential validator calls across 4 endpoints:
  - `info/refs`: 40/40 returned 200 OK (100.0%)
  - `.patch`: 40/40 returned 200 OK (100.0%)
  - `compare.diff`: 40/40 returned 200 OK (100.0%)
  - REST API contrast: 34/40 returned 200 OK, 6/40 failed with 403 Forbidden (85.0%)
- **Stage 1b PR State Probe** (40 validator calls on probe `0x1c6A511af937d6AECFbcF77Fb5f9A4de2C19CE81`):
  - `refs/pull/{n}/merge` present in 10/10 calls for OPEN PR (#33) and DRAFT PR (#34).
  - `refs/pull/{n}/merge` absent in 10/10 calls for CLOSED PR (#35) and MERGED PR (#36).
  - Decision STOP-A: Enforce `refs/pull/{n}/merge` check. Draft status is not distinguishable on git advertisement and is documented as unchecked.

### Gate Batch Evaluation (30 Runs on Studionet)

Candidate V3.1 was evaluated under pre-registered gate rules (`docs/MILESTONE_V3_1_PLAN.md`):

| Fixture | Runs | Successes | Failures | Reliability | Outcome Matches | Gate Result |
|---|---|---|---|---|---|---|
| **F1** (Clean Release) | 10 | 10 | 0 | **100.0%** | 9/10 (`RELEASE_100`) | **PASS** |
| **F4** (Partial Release) | 10 | 10 | 0 | **100.0%** | 9/10 (`RELEASE_75`) | **PASS** |
| **F5** (Prompt Injection) | 10 | 10 | 0 | **100.0%** | 10/10 (`REFUND`) | **PASS** |
| **Total** | 30 | 30 | 0 | **100.0%** | 28/30 (93.3%) | **`ADOPT_V3_1`** |

All fixtures met the `>= 9/10` success and `>= 9/10` outcome match criteria, resulting in formal adoption (`adopted: true`).

---

## 4. Why Labels Are Leader-Attested (Not Consensus-Bound)

In candidate V3 (`contracts/candidates/ShipEscrowV3_labels_bound_not_adopted.py`), `validator_fn` enforced element-by-element equality on the label vector (`criterion_results`). In the V3 gate evaluation:
- Fixture F1 yielded 10/10 identical `["YES","YES","YES"]`.
- Fixture F5 yielded 10/10 identical `["NO"]`.
- Fixture F4 (partial implementation) yielded 8/10 `["YES","YES","NO"]` and 2/10 `["YES","PARTIAL","NO"]`.

Because 8/10 was below the pre-registered `>= 9/10` threshold, the bundled label binding failed its gate. In accordance with the pre-registered fallback rule (`docs/ROBUSTNESS_V2_PLAN.md` and ADDENDUM2):
1. Consensus compares deterministic fields, gate, verdict, and payout percentage.
2. The full label vector is stored on-chain, leader-attested, committed into `packet_sha256`, and independently recomputable.

---

## 5. Compared Fields in V3.1 Consensus

Extracted directly by script (`scripts/tools/extract_compared_fields.py`) from the active `validator_fn` in `contracts/ShipEscrowV3_1.py`:
1. `head_sha`: Authenticated pull request HEAD commit hash
2. `base_sha`: Default branch base commit hash
3. `diff_sha256`: SHA-256 hash of the retrieved git diff
4. `facts`: Deterministic extraction facts (file lists, touched paths)
5. `gate`: Deterministic safety gate string (e.g. `none`, `required_path_untouched`, `test_deleted`, `diff_truncated`)
6. `verdict`: Settlement verdict string (`RELEASE_100`, `RELEASE_75`, `RELEASE_50`, `RELEASE_25`, `REFUND`, `REVIEW`)
7. `payout_pct`: Integer payout percentage (0, 25, 50, 75, 100)

---

## 6. Known Limitations & Operational Boundaries

1. **Default-Branch Bounties Only**: The base commit is resolved from the repository's default branch symref advertised in git smart-HTTP.
2. **PR Branch Must Exist During Submission**: Same-repo verification verifies that `refs/heads/{branch}` matches `refs/pull/{n}/head`. If the developer deletes their branch prior to submission, verification will reject.
3. **Commit Trailer Required**: The developer's wallet address must appear as a `ship-escrow-wallet: 0x<wallet>` trailer in the HEAD commit message.
4. **Draft Status Not Checked**: As proven by Stage 1b validator probe data, GitHub git smart-HTTP advertisement produces identical advertisements for open and draft PRs (`refs/pull/{n}/head` and `refs/pull/{n}/merge` are both present). Closed and merged PRs are reliably rejected.
5. **Base Drift Limitation**: If the default branch advances between the leader validator fetch and a consensus validator fetch, the base SHA and diff will differ, causing a transaction revert. In this event, no credits are debited, no submission attempts are consumed, and the developer may retry.
6. **Open PRs with Merge Conflicts**: A PR that GitHub cannot merge (conflicts) has no merge ref and is rejected with `'Pull request is not open'`; rebase the branch and submit again.

# Milestone 1: Quota-Free Head Authentication & Consensus-Bound Labels

> Status: **Preview**  
> Candidate Evaluation: **Tried, Not Adopted via Pre-Registered Gate Protocol**  
> Active Deployment: **ShipEscrowV2 (`0x8a9c079a7E1F756e07e8FbE392a5E93106DE28bF`) & ShipReputationV2 (`0x8e6D0356F4Bf987E95eB3cC6e7DF84ce2f708C81`)**  
> Candidate Deployment: **ShipEscrowV3 (`0xDf8Adb520FeE510d8793bC5d01C7aF751A4fE772`) & ShipReputationV3 (`0x31F0955Ad7bA06C1902d83B876308e5F125865dF`)**  
> Network: **GenLayer Studionet** (Chain ID: 61999)  

---

## 1. Executive Summary & Problem Analysis

In Ship Escrow V2.1, pull requests are authenticated against GitHub's public REST API endpoint (`https://api.github.com/repos/{owner}/{repo}/pulls/{n}`). GenLayer validators execute non-deterministic web requests from shared egress IP subnets without client authentication tokens. 

Across the baseline measurement recorded prior to Milestone 1 (`docs/before_state_v3.json`):
- **V2.1 Robustness Attempts**: 50 attempts, 30 successes, 20 failures (**60.0% reliability**).
- **V2.2 Gate Batch Attempts**: 30 attempts, 23 successes, 7 failures (**76.67% reliability**).
- **Combined Pre-V3 Baseline**: 80 attempts, 53 successes, 27 failures (**66.25% reliability**).
- **Failure Cause**: 100% of recorded failures were transaction reverts caused by GitHub unauthenticated IP rate limiting (HTTP 403, 60 requests/hour/IP quota).

Furthermore, while V2.1 stored and committed assessment packets on-chain, individual criterion labels in `criterion_results` were not compared element-by-element across validator nodes in `validator_fn`.

Milestone 1 designed, pre-registered, probed, and evaluated **Contract V3** to address these two specific measured challenges:
1. **Quota-Free Git Head Authentication**: Replacing the REST API with git smart HTTP advertisement (`info/refs?service=git-upload-pack`), git commit message trailers in `pull/{n}.patch`, and pinned immutable `compare/{base}...{head}.diff`.
2. **Consensus-Bound Criterion Labels**: Extending `validator_fn` to compare 8 fields including strict list equality on `criterion_results`.

---

## 2. Before vs After Measurements

### Validator Availability & Reliability

| Metric | Pre-V3 Baseline (Combined) | V3 Validator Probe (Stage 1) | V3 Gate Batch (Stage 3) |
|---|---|---|---|
| **Total Attempts** | 80 | 40 sequential calls | 30 live on-chain runs |
| **Successful Executions** | 53 | 40 / 40 (100.0%) | 30 / 30 (**100.0%**) |
| **Failures / Reverts** | 27 (33.75%) | 0 (0.0%) | 0 (**0.0%**) |
| **Execution Reliability** | **66.25%** | **100.0%** | **100.0%** |
| **HTTP 403 Rate Limit Reverts** | 27 | 0 on git endpoints (6 on REST contrast) | **0** |
| **Pacing Between Calls** | Variable / >= 7s | >= 7500 ms (measured avg: 7507 ms) | >= 8000 ms |

### Architectural Comparison

| Dimension | Baseline V2.1 (Active) | Candidate V3 (Tried, Not Adopted) |
|---|---|---|
| **Head Authentication** | `api.github.com/repos/.../pulls/{n}` (JSON `head.sha`) | `info/refs?service=git-upload-pack` (`refs/pull/{n}/head`) |
| **Quota Constraint** | 60 unauthenticated reqs/hr/IP on GitHub REST | Quota-free git smart HTTP advertisement |
| **Base Commit Resolution** | REST API `base.sha` | Default branch symref in `info/refs` |
| **Diff Retrieval** | `pull/{n}.diff` | Pinned `compare/{base}...{head}.diff` |
| **Wallet Binding** | Regex in PR body text | Git commit trailer in HEAD commit of `pull/{n}.patch` |
| **Consensus Fields** | 7 fields (`head_sha`, `base_sha`, `diff_sha256`, `facts`, `gate`, `verdict`, `payout_pct`) | 8 fields (adds strict `criterion_results` list equality) |
| **Label Consensus** | Leader-attested & committed via `packet_sha256` | Strictly bound in validator consensus comparison |

---

## 3. Validator Probe Results (Stage 1)

Before writing contract code or deploying candidates, a validator probe contract (`contracts/Probe.py`) was extended with `probe_v3_quad` and deployed to Studionet at `0xf5256FB126c54719f99C027482220c24E281493b` (deploy tx `0x82c3b76d2b67dc71a7039b296a0f7268c6012dd1174eded99f3f32e45bd0db8d`).

As pre-registered in `docs/PROBE_V3_PLAN.md`:
- **Protocol**: 40 sequential validator calls, spaced >= 7s apart, querying 4 endpoints simultaneously:
  1. `info/refs?service=git-upload-pack`
  2. `pull/{n}.patch`
  3. `compare/{base}...{head}.diff`
  4. `api.github.com/repos/.../pulls/{n}` (REST API contrast)
- **Empirical Findings**:
  - `info/refs`: **40/40 returned 200 OK** (100.0% reliability).
  - `.patch`: **40/40 returned 200 OK** (100.0% reliability).
  - `compare.diff`: **40/40 returned 200 OK** (100.0% reliability).
  - REST API contrast: **34/40 returned 200 OK, 6/40 returned 403 Forbidden** (85.0% reliability under sequential traffic).
  - PR Parity (#2 through #8): **7/7 passed** (retrieved values matched stored V2.1 baseline digests).
- **Decision**: Pre-registered GO condition satisfied (`docs/PROBE_V3_DECISION.md`).

---

## 4. Gate Batch Evaluation & Pre-Registered Decision (Stage 3)

Candidate contracts were deployed on Studionet:
- `ShipEscrowV3`: `0xDf8Adb520FeE510d8793bC5d01C7aF751A4fE772` (tx `0xb6af9125becd43587d66bf1430f570c7d074c05e432b3a20155b8ed4f9b8222f`, source SHA256 `4d3a561d7309234436aa567116f95fd431f590a0ccb0d1d681639ec535728186`)
- `ShipReputationV3`: `0x31F0955Ad7bA06C1902d83B876308e5F125865dF` (tx `0x2640f87b15949ae4dff0505a015f4696795f34496ab40843430a493f7cd73cef`, source SHA256 `12e4c5e9cf8f480823ff778181b6a0d50ae7d37ec7c3a5b079cf6275779d1ed7`)

Thirty live on-chain runs (10 each for F1, F4, F5) were executed against fresh bounties with >= 8s spacing (`docs/evidence_v3/gate/`):

| Fixture | Runs | Successes | Failures | Reliability | Modal Label Vector | Modal Agreement | Success Gate | Label Gate | Gate Result |
|---|---|---|---|---|---|---|---|---|---|
| **F1** (Clean Release) | 10 | 10 | 0 | **100.0%** | `["YES","YES","YES"]` | 10/10 (100.0%) | PASS | PASS | **PASS** |
| **F4** (Partial Release) | 10 | 10 | 0 | **100.0%** | `["YES","YES","NO"]` | 8/10 (80.0%) | PASS | FAIL | **FAIL** |
| **F5** (Prompt Injection) | 10 | 10 | 0 | **100.0%** | `["NO"]` | 10/10 (100.0%) | PASS | PASS | **PASS** |
| **Total** | 30 | 30 | 0 | **100.0%** | — | — | PASS | FAIL | **`REJECT_V3_KEEP_V2_1`** |

### Pre-Registered Activation Rule Evaluation
Under `docs/MILESTONE_V3_PLAN.md` Section 4:
- Adoption required: `>= 9/10` successes on each fixture AND `>= 9/10` identical label vectors on each fixture.
- While execution reliability was 100% across all 30 runs, Fixture F4 yielded 8/10 modal vector agreement (`["YES","YES","NO"]` 8/10, `["YES","PARTIAL","NO"]` 2/10).
- Because `8 < 9`, the pre-registered label consensus threshold was not met.
- **Decision**: **`REJECT_V3_KEEP_V2_1`**.
- As pre-registered, the milestone rollout was stopped, candidate V3 is recorded as **"Tried, Not Adopted"**, and **V2.1 contracts remain the active deployment**.

---

## 5. Root Cause Analysis & Engineering Trade-Offs

### 1. Root Cause of Rate Limit Elimination
The transition to `info/refs?service=git-upload-pack`, `pull/{n}.patch`, and `compare/{base}...{head}.diff` completely eliminated unauthenticated rate limiting. Across 40 probe calls and 30 live on-chain gate submissions (70 total network transactions), **0 HTTP 403 or 429 errors occurred**. Git smart HTTP endpoints do not share the unauthenticated 60 req/hr rate limit imposed on `api.github.com`.

### 2. The Semantic Label Consensus Trade-Off
When individual criterion labels are strictly compared in `validator_fn`:
```python
if leader_packet.get("criterion_results") != val_packet.get("criterion_results"):
    return False
```
Validators within the same transaction reach consensus via GenLayer's Equivalence Principle (`MAJORITY_AGREE`). However, across independent runs on borderline/partial implementations (such as Fixture F4, which implements code and a single unit test assertion), LLM prompt temperature and minor semantic boundary differences can lead to `PARTIAL` vs `YES` ratings on test completeness. 

Requiring a strict 90% cross-run modal convergence on subjective/partial criteria without prompt few-shot anchoring remains a known trade-off when label vectors are consensus-bound.

---

## 6. Audit & Evidence Manifest

All raw receipts, probe logs, gate runs, and verification files are committed in the repository:
- Pre-Registration Plan: [`docs/MILESTONE_V3_PLAN.md`](file:///E:/ShipEscrow_V2/docs/MILESTONE_V3_PLAN.md)
- Pre-Registration Expectations: [`docs/EXPECTED_V3.md`](file:///E:/ShipEscrow_V2/docs/EXPECTED_V3.md)
- Probe Results & Decision: [`docs/PROBE_V3_DECISION.md`](file:///E:/ShipEscrow_V2/docs/PROBE_V3_DECISION.md), [`docs/evidence_v3/probe_v3_results.json`](file:///E:/ShipEscrow_V2/docs/evidence_v3/probe_v3_results.json)
- Gate Runs & Decision: [`docs/GATE_V3_DECISION.md`](file:///E:/ShipEscrow_V2/docs/GATE_V3_DECISION.md), [`docs/evidence_v3/gate/`](file:///E:/ShipEscrow_V2/docs/evidence_v3/gate/)
- Deployed Candidate Source & Verification: [`docs/evidence_v3/source/`](file:///E:/ShipEscrow_V2/docs/evidence_v3/source/)

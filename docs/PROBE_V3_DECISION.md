# Validator Probe V3 Decision Report

> Generated: 2026-10-25T07:09:39.117Z
> Deployed Probe Address: `0xf5256FB126c54719f99C027482220c24E281493b`
> Source SHA256: `059e8ffb57008fc99d8daa8a71c281ca0ecb1a8da464faf10174bd18ce9c6f4a`

---

## 1. 40-Run Pacing & Reliability Metrics

- **Total Calls per Item**: 40 sequential on-chain transactions
- **Target Inter-call Spacing**: >= 7,000 ms
- **Measured Minimum Spacing**: 7500 ms
- **Measured Average Spacing**: 7507 ms

### Reliability Table

| Item | Endpoint Description | HTTP 200 Count | Rate Limit (403/429) | Reliability % | Pre-Reg Threshold (>= 39/40) | Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **(a) info/refs** | `info/refs?service=git-upload-pack` | 40 / 40 | 0 | 100.0% | 39 / 40 (97.5%) | **PASS** |
| **(b) .patch** | `pull/{n}.patch` commit message | 40 / 40 | 0 | 100.0% | 39 / 40 (97.5%) | **PASS** |
| **(c) compare.diff**| `compare/{base}...{head}.diff` | 40 / 40 | 0 | 100.0% | 39 / 40 (97.5%) | **PASS** |
| **(d) REST API** | `api.github.com/repos/.../pulls/{n}` | 34 / 40 | 6 | 85.0% | Contrast Baseline | Measured Contrast |

---

## 2. Fixture Parity Verification (PRs #2 Through #8)

| PR # | Authenticated Head SHA | Head Parity | Diff SHA256 | Diff Parity | Overall Parity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **PR #2** | `5db0441e76...` | PASS | `ecd93f38b5...` | PASS | **PASS** |
| **PR #3** | `3de6b568ca...` | PASS | `a8e4183a67...` | PASS | **PASS** |
| **PR #4** | `aa9a2af9cc...` | PASS | `8ab52ce693...` | PASS | **PASS** |
| **PR #5** | `73fbd168b0...` | PASS | `07575e637a...` | PASS | **PASS** |
| **PR #6** | `b9e099153e...` | PASS | `c4ae354801...` | PASS | **PASS** |
| **PR #7** | `960fbf1ac0...` | PASS | `f1c1e6ea98...` | PASS | **PASS** |
| **PR #8** | `2332a88799...` | PASS | `d7f833e0ea...` | PASS | **PASS** |

---

## 3. GO / NO-GO Gate Outcome

- **Condition 1 (>= 39/40 HTTP 200 on a, b, c)**: **PASS**
- **Condition 2 (PR #2-#8 Parity with V2.1 Stored Data)**: **PASS**
- **Overall Protocol Gate Decision**: **`GO`**

> **PROCEED TO STAGE 2**: All pre-registered GO conditions satisfied. Head authentication via `info/refs` is quota-free and achieves 100% agreement on validator nodes. Pinned diff matches byte-for-byte.

# Milestone 1 V3 Gate Batch Decision Record

**Evaluation Date**: 2026-10-25T10:02:27.406Z
**Candidate ShipEscrowV3 Address**: `0x320cb3C3987B395099E19544F0556347f44D9B36`
**Pre-Registered Criteria**: >= 9/10 successes on EACH fixture AND >= 9/10 identical label vectors on each fixture.

## Gate Results Summary

| Fixture | Total Attempts | Successes | Failures | Reliability | Modal Label Vector | Modal Count | Success Gate | Label Gate | Status |
|---|---|---|---|---|---|---|---|---|---|
| **F1** | 10 | 10 | 0 | 100.0% | `["YES","YES","YES"]` | 10/10 | PASS | PASS | **PASS** |
| **F4** | 10 | 10 | 0 | 100.0% | `["YES","YES","NO"]` | 10/10 | PASS | PASS | **PASS** |
| **F5** | 10 | 10 | 0 | 100.0% | `["NO"]` | 10/10 | PASS | PASS | **PASS** |

## Activation Decision

**Decision**: **`ADOPT_V3_ACTIVE`**

All pre-registered gate requirements have been satisfied:
- Every fixture achieved >= 90% execution reliability without rate-limiting reverts.
- Label vectors are consensus-bound and matched across >= 90% of runs.
- **`ShipEscrowV3` at `0x320cb3C3987B395099E19544F0556347f44D9B36` is formally adopted as the active contract.**

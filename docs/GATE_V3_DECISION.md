# Milestone 1 V3 Gate Batch Decision Record

**Evaluation Date**: 2026-10-25T11:01:56.584Z
**Candidate ShipEscrowV3 Address**: `0xDf8Adb520FeE510d8793bC5d01C7aF751A4fE772`
**Pre-Registered Criteria**: >= 9/10 successes on EACH fixture AND >= 9/10 identical label vectors on each fixture.

## Gate Results Summary

| Fixture | Total Attempts | Successes | Failures | Reliability | Modal Label Vector | Modal Count | Success Gate | Label Gate | Status |
|---|---|---|---|---|---|---|---|---|---|
| **F1** | 10 | 10 | 0 | 100.0% | `["YES","YES","YES"]` | 10/10 | PASS | PASS | **PASS** |
| **F4** | 10 | 10 | 0 | 100.0% | `["YES","YES","NO"]` | 8/10 | PASS | FAIL | **FAIL** |
| **F5** | 10 | 10 | 0 | 100.0% | `["NO"]` | 10/10 | PASS | PASS | **PASS** |

## Activation Decision

**Decision**: **`REJECT_V3_KEEP_V2_1`**

One or more pre-registered gate requirements failed. As pre-registered, rollout is stopped and V2.1 remains active.

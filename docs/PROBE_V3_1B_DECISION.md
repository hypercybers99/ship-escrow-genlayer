# Validator Probe V3.1b Decision: Merge-Conflicted Open PRs

> Generated: 2026-10-25T13:29:34.084Z  
> Probe Contract: `0x1c6A511af937d6AECFbcF77Fb5f9A4de2C19CE81`  
> Target PR: PR #37 (`https://github.com/hypercybers99/ship-escrow-fixtures/pull/37`)  
> Subject: Presence/Absence of `refs/pull/37/merge` on Open PR with Merge Conflicts  

---

## 1. Protocol Execution Summary

- **Total Validator Calls**: 10 sequential on-chain transactions querying `probe_v3_state`
- **Target Inter-call Spacing**: >= 7,000 ms (measured minimum: 14788 ms, average: 17618 ms)
- **Target Fixture**: Pull Request #37 in `hypercybers99/ship-escrow-fixtures` (State: `OPEN`, Non-Draft, Mergeable: `CONFLICTING`)

---

## 2. Empirical Findings on GenLayer Studionet Validators

| Metric | PR #37 (Open with Merge Conflicts) |
|:---|:---|
| **Total Calls** | 10 / 10 |
| **HTTP refs 200 OK** | **10 / 10 (100.0%)** |
| **`has_head` (`refs/pull/37/head` present)** | **10 / 10 (100.0%)** |
| **`has_merge` (`refs/pull/37/merge` present)** | **0 / 10 (0.0% - ABSENT in 10/10 runs)** |
| **Patch HTTP Status** | 200 OK (10/10) |
| **Diff HTTP Status** | 200 OK (10/10) |

---

## 3. Decision & Operational Boundary

- **Empirical Confirmation**: GitHub creates `refs/pull/{n}/merge` strictly when a pull request can be cleanly and automatically merged into the default branch. When a pull request has merge conflicts, GitHub leaves `refs/pull/{n}/merge` ungenerated, even while the pull request remains active and open.
- **Contract Impact**: In ShipEscrowV3_1, pull request active status is verified by requiring `refs/pull/{n}/merge`. Therefore, a pull request with merge conflicts is rejected with `"Pull request is not open"`.
- **Operational Rule Documented in LIMITATIONS & README**:
  > *"A PR that GitHub cannot merge (conflicts) has no merge ref and is rejected with 'Pull request is not open'; rebase the branch and submit again."*

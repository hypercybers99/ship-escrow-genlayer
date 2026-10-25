# Validator Probe V3.1 Decision Report (Stage 1b / STOP-A)

> Generated: 2026-10-25T11:44:28.733Z  
> Deployed Probe Address: `0x1c6A511af937d6AECFbcF77Fb5f9A4de2C19CE81`  
> Probe Source SHA256: `6c00489943a20395362cdd15e6dc7e60a65603e34942c4983ec263616c74f89c`  

---

## 1. Protocol Pacing & Execution Summary

- **Total Validator Calls**: 40 sequential on-chain transactions (10 per fixture PR)
- **Target Inter-call Spacing**: >= 7,000 ms
- **Measured Minimum Spacing**: 7500 ms
- **Measured Average Spacing**: 7507 ms
- **Agreement**: All 40 transactions achieved consensus and stored deterministic findings.

---

## 2. Empirical PR State Indicator Findings

| PR # | State Category | Runs | `info/refs` 200 | `refs/pull/N/head` Present | `refs/pull/N/merge` Present | `.patch` 200 | `.diff` 200 | Empirical Conclusion |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **PR #33** | OPEN (non-draft) | 10 / 10 | 10 / 10 | 10 / 10 | **10 / 10** | 10 / 10 | 10 / 10 | Active open PR maintains merge ref |
| **PR #34** | DRAFT | 10 / 10 | 10 / 10 | 10 / 10 | **10 / 10** | 10 / 10 | 10 / 10 | Draft PR exposes identical git refs |
| **PR #35** | CLOSED (unmerged)| 10 / 10 | 10 / 10 | 10 / 10 | **0 / 10** | 10 / 10 | 10 / 10 | Merge ref pruned upon close |
| **PR #36** | MERGED | 10 / 10 | 10 / 10 | 10 / 10 | **0 / 10** | 10 / 10 | 10 / 10 | Merge ref pruned upon merge |

---

## 3. Analysis & STOP-A Decision

1. **Separation of OPEN vs CLOSED / MERGED**:
   - The presence of `refs/pull/{n}/merge` in the Git smart HTTP advertisement (`info/refs`) is **100% reliable** across all 40 validator calls.
   - For OPEN PRs (PR #33), `refs/pull/33/merge` was present in **10 of 10 runs (100%)**.
   - For CLOSED PRs (PR #35) and MERGED PRs (PR #36), `refs/pull/{n}/merge` was absent in **0 of 10 runs (0%)**.
   - **Contract Enforcement**: `ShipEscrowV3_1` strictly requires `refs/pull/{n}/merge`. If absent, the contract reverts immediately with:
     ```python
     raise gl.vm.UserError("Pull request is not open")
     ```

2. **DRAFT Status Detectability**:
   - DRAFT PRs (PR #34) advertise both `refs/pull/34/head` and `refs/pull/34/merge` identically to standard open PRs.
   - `.patch` and `.diff` HTTP endpoints also return HTTP 200 without exposing draft headers.
   - Therefore, DRAFT status is **not detectable** via git endpoints without the unauthenticated GitHub REST API.
   - In accordance with the pre-registered specification, `docs/LIMITATIONS.md` explicitly documents: *"Draft status is not checked"*.

3. **Packet Cleanliness & Name Hygiene**:
   - The hardcoded unchecked `metadata` block is completely eliminated from the assessment packet.
   - The packet key `body_sha256` is renamed to `head_commit_message_sha256`.

4. **STOP-A Conclusion**:
   - **DECISION: `ENFORCE_REFS_PULL_MERGE`**. Proceed automatically with Stage 2 and deployment of `ShipEscrowV3_1`.

# Pre-Registration: Probe Protocol for Merge-Conflicted Open PRs (Probe V3.1b)

> Status: **Pre-Registration**  
> Protocol Target: **Studionet Probe Contract (`0x1c6A511af937d6AECFbcF77Fb5f9A4de2C19CE81`)**  
> Evaluation Subject: Presence/Absence of `refs/pull/{n}/merge` on Open PR with Merge Conflicts  

---

## 1. Context & Motivation

In Ship Escrow V3.1, pull request active/open status is validated via git smart-HTTP advertisement:
```python
m_merge = re.search(r"([0-9a-f]{40})\s+refs/pull/" + pr_num_str + r"/merge", text_refs)
if not m_merge:
    raise gl.vm.UserError("Pull request is not open")
```
Stage 1b empirical data proved:
- `refs/pull/{n}/merge` is present in 10/10 runs on clean OPEN (#33) and DRAFT (#34) PRs.
- `refs/pull/{n}/merge` is absent in 10/10 runs on CLOSED (#35) and MERGED (#36) PRs.

However, GitHub generates the synthetic ref `refs/pull/{n}/merge` only when the pull request is clean and automatically mergeable into the target branch. If an OPEN pull request has merge conflicts with the default branch, GitHub cannot compute the merge commit. Consequently, `refs/pull/{n}/merge` will be absent, causing V3.1 to reject the submission with `"Pull request is not open"`.

This probe protocol measures this boundary condition directly on GenLayer Studionet validators.

---

## 2. Experimental Setup

1. **Conflicting Pull Request**:
   - Provision an OPEN, non-draft pull request in `hypercybers99/ship-escrow-fixtures` targeting `main`.
   - The PR branch diverges from an older commit and modifies existing lines in `README.md` to intentionally create a merge conflict against the tip of `main`.
   - GitHub web UI must display: *"This branch has conflicts that must be resolved"*.
2. **Validator Probe Execution**:
   - Execute 10 sequential validator calls invoking `probe_v3_state("hypercybers99", "ship-escrow-fixtures", pr_number, f"probe_conflict_run_{i}")` on probe contract `0x1c6A511af937d6AECFbcF77Fb5f9A4de2C19CE81`.
   - Maintain minimum pacing of `>= 7.5s` between sequential calls.
3. **Data Recording**:
   - Record `has_head`, `has_merge`, `head_sha`, `merge_sha`, `status_refs`, `status_patch`, and `status_diff`.
   - Save raw receipts and output to `docs/evidence_v3_1/probe_v3_1b_results.json`.

---

## 3. Pre-Registered Decision Criteria

- **Hypothesis**: For an OPEN pull request with merge conflicts, `has_head == True` (head SHA is advertised) and `has_merge == False` (merge ref is absent) across all 10 validator calls.
- **Reporting Rule**:
  - Document the empirical findings in `docs/PROBE_V3_1B_DECISION.md`.
  - Document the operational limitation and developer retry advice in `docs/LIMITATIONS.md`, `README.md`, and `docs/MILESTONE_1.md`:
    *"A PR that GitHub cannot merge (conflicts) has no merge ref and is rejected with 'Pull request is not open'; rebase the branch and submit again"*.

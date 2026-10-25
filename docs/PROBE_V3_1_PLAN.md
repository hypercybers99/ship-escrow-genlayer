# Pre-Registration: PR State Indicator Validator Probe Plan (Stage 1b)

> **PRE-REGISTRATION NOTICE**: This plan is committed BEFORE any validator probe runs, contract edits, or deployments.
> It pre-registers the empirical evaluation protocol on GenLayer Studionet to determine which PR state signals (OPEN, DRAFT, CLOSED, MERGED) are reliably exposed via Git endpoints without relying on unauthenticated GitHub REST API calls.

---

## 1. Context & Motivation

In V2.1, pull request state (`open`, `draft`, `merged`, `closed`) was read from the GitHub REST API JSON payload (`meta["state"]`, `meta["draft"]`, `meta["merged"]`), rejecting non-open pull requests before state mutations.

In candidate V3, the REST API was eliminated to avoid unauthenticated IP rate limits. However, the candidate packet temporarily asserted unchecked hardcoded PR state metadata (`"metadata": {"author_login": "", "commits": 1, "draft": false, "merged": false, "state": "open"}`). 

A smart contract must **never assert what was not checked**. 

Stage 1b conducts an on-chain validator probe to determine:
1. Does git smart HTTP advertisement (`info/refs?service=git-upload-pack`) expose an unambiguous, deterministic signal separating OPEN from CLOSED/MERGED pull requests?
2. Is DRAFT status detectable via git advertisement, `.patch`, or `.diff`?

---

## 2. Test Fixtures (Dedicated PRs)

Four dedicated pull requests have been established on `hypercybers99/ship-escrow-fixtures`:
- **PR #33**: OPEN, non-draft (`https://github.com/hypercybers99/ship-escrow-fixtures/pull/33`)
- **PR #34**: DRAFT (`https://github.com/hypercybers99/ship-escrow-fixtures/pull/34`)
- **PR #35**: CLOSED, unmerged (`https://github.com/hypercybers99/ship-escrow-fixtures/pull/35`)
- **PR #36**: MERGED (`https://github.com/hypercybers99/ship-escrow-fixtures/pull/36`)

---

## 3. Validator Probe Protocol

1. **Probe Contract**: Deploy extended `contracts/Probe.py` with `probe_v3_state` method to Studionet.
2. **Sequential Calls**: Execute **10 on-chain validator calls for each of the 4 PRs** (40 transactions total), spaced `>= 7 seconds` apart.
3. **Signals Monitored per Call**:
   - `status_refs`: HTTP response code of `info/refs?service=git-upload-pack`.
   - `has_head`: Presence of `refs/pull/{n}/head` in advertisement.
   - `has_merge`: Presence of `refs/pull/{n}/merge` in advertisement.
   - `head_sha`: Authoritative head SHA extracted from advertisement.
   - `merge_sha`: Merge commit SHA extracted from advertisement (if present).
   - `status_patch`: HTTP response code of `pull/{n}.patch`.
   - `patch_len`: Byte length of `pull/{n}.patch`.
   - `status_diff`: HTTP response code of `pull/{n}.diff`.
   - `diff_len`: Byte length of `pull/{n}.diff`.
4. **Receipt Rule**: Status `ACCEPTED` or `FINALIZED`, `MAJORITY_AGREE`, leader receipt `execution_result == SUCCESS`.

---

## 4. Pre-Registered Decision Criteria (STOP-A)

Upon completion of the 40 validator calls:
1. **Separation of OPEN vs CLOSED/MERGED**:
   - If `has_merge` is `true` in 10/10 runs for OPEN PRs (#33) and `false` in 10/10 runs for CLOSED (#35) and MERGED (#36) PRs:
     - The presence of `refs/pull/{n}/merge` is confirmed as a reliable indicator of an active, open pull request.
     - `ShipEscrowV3_1` will enforce this check and reject missing `refs/pull/{n}/merge` with `gl.vm.UserError("Pull request is not open")`.
2. **Draft PR Detection**:
   - If DRAFT PR (#34) exhibits an identical git signal to OPEN PR (#33) across all endpoints, DRAFT status is deemed undetectable without the unauthenticated REST API.
   - In accordance with the prompt specification, `docs/LIMITATIONS.md` will explicitly state: *"Draft status is not checked"*.
3. **Packet Cleanliness**:
   - The hardcoded `metadata` block is completely removed from the assessment packet.
   - `head_commit_message_sha256` replaces `body_sha256`.
4. **Recording**: Output recorded in `docs/evidence_v3_1/probe_v3_1_results.json` and decision documented in `docs/PROBE_V3_1_DECISION.md`.

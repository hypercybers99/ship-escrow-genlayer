# Ship Escrow V2 - Architecture & Consensus Design

> Status: **Preview**  
> Network: **GenLayer Studionet** (Chain ID: 61999)  

> [!IMPORTANT]
> **DISCLAIMER: SIMULATED CREDITS, NOT CUSTODY-BACKED TOKENS**  
> Credits in Ship Escrow V2 are maintained on an internal, conserved accounting ledger with auditable deposit, release, and refund invariants (`total_balances + total_escrowed == total_minted`). They do not represent custody-backed tokens, cryptocurrencies, or monetary value.

---

## 1. The Core Consensus Primitive (V2)

In GenLayer Intelligent Contracts, multi-validator consensus is achieved when independent validators execute the contract code and agree on the return value of the non-deterministic block wrapped in `gl.eq_principle.strict_eq`.

### What Validators Compare
In V2, the function passed to `gl.eq_principle.strict_eq` returns strictly **ONE** canonical triple:
```
"<VERDICT>|<payout_pct>|<packet_sha256>"
```
Where:
- `VERDICT`: One of six strictly defined enum strings:
  - `RELEASE_100`: Full payout (100% of escrowed amount to contributor).
  - `RELEASE_75`: 75% payout to contributor, 25% refunded to creator.
  - `RELEASE_50`: 50% payout to contributor, 50% refunded to creator.
  - `RELEASE_25`: 25% payout to contributor, 75% refunded to creator.
  - `REFUND`: 0% payout (fails criteria or gates; dev bond forfeited to creator).
  - `REVIEW`: Inconclusive, gated, or truncated diff; attempt consumed without balance transfer; bond returned to dev.
- `payout_pct`: Decimal integer string (`0`, `25`, `50`, `75`, `100`).
- `packet_sha256`: SHA-256 digest (64 hex characters) of the canonical JSON assessment packet binding all assessment facts.

### Bound Fields in `packet_sha256`
The canonical assessment packet commits to:
```json
{
  "base_sha": "05fedc3b516a90c1dd49f348db45c864a19d1148",
  "body_sha256": "8d45d764906f34bae4053ae76f4a64e17ae24e69a73812266f02c11ac5589f83",
  "criteria_hash": "2f4b...3a1c",
  "diff_sha256": "672d...7389",
  "facts": {
    "added_lines": 12,
    "changed_files": ["src/slug.py"],
    "deleted_files": [],
    "deleted_lines": 0,
    "is_truncated": false,
    "test_files_deleted": [],
    "test_files_touched": []
  },
  "gate": "",
  "head_sha": "5db0441e76af93606fd82feebbe49c5a2f145326",
  "metadata": {
    "author_login": "huzyow155",
    "commits": 1,
    "draft": false,
    "merged": false,
    "state": "open"
  },
  "payout_pct": 100,
  "verdict": "RELEASE_100"
}
```

---

## 2. Conserved Balance Ledger Architecture

All balance modifications strictly conserve credits:
- **`claim_demo_credits()`**: Mints 1,000 demo credits to the caller (enforced once per address).
- **`create_bounty(...)`**: Debits creator's balance by `amount` and locks it into `escrowed[bounty_id]`.
- **`submit_work(...)`**: Debits a refundable 50 credit submission bond from the developer.
  - If verdict is `RELEASE_x`: Dev bond returned + payout released from escrow to dev. Unused escrow returned to creator.
  - If verdict is `REVIEW`: Dev bond returned. Escrow remains locked for subsequent attempts.
  - If verdict is `REFUND`: Dev bond (50 credits) is forfeited to creator. Escrow remains locked.
- **`cancel_bounty(...)`**: Permitted ONLY when `attempts == 0`. Full escrowed amount refunded to creator.
- **`refund_exhausted(...)`**: Permitted when bounty status is `EXHAUSTED` (attempts reach cap 6). Full escrowed amount refunded to creator.

### Invariant Equation
The contract enforces and exposes `get_ledger_invariant()`:
$$\sum \text{balances} + \sum \text{escrowed} = \text{total\_minted}$$

Fuzz tested over 5,000 randomized operations with 100% invariant preservation.

---

## 3. Pull Request Authentication & Revision Immutability

1. **Authoritative REST API Metadata**: Validators fetch `https://api.github.com/repos/<owner>/<repo>/pulls/<n>` and verify:
   - PR state is `open` or `merged` (drafts and closed-unmerged rejected).
   - PR is same-repository (`head.repo == base.repo == bounty.owner_repo`).
   - `head.sha` strictly equals the caller's claimed `head_sha`.
2. **Attribution Binding**: The PR body must include:
   ```
   ship-escrow-wallet: 0x<caller_address>
   ```
   If absent or bound to another address, submission reverts before consuming attempts.
3. **Immutable Revision Diff**: Validators fetch `https://github.com/<owner>/<repo>/compare/<base_sha>...<head_sha>.diff`, which is permanently pinned to the commit SHAs, preventing race conditions or moving-head attacks.

---

## 4. Deterministic Gates & Diff Parsing

- **Required Paths Gate (`required_path_untouched`)**:
  - Requires EVERY mandatory prefix in `required_paths` to be touched.
  - Evaluated on path segment boundaries (`path.startswith(prefix + "/")` or `path == prefix`).
  - Fails to `REFUND` (bond forfeited).
- **Deleted Test Files Gate (`test_deleted`)**:
  - Tracked per file header (`diff --git`). Only files whose header contains `deleted file mode` are treated as deleted.
  - Deleted non-test files with `"test"` in their name do NOT fire this gate.
  - If deleted file is a test file, yields `REVIEW` (bond returned).
- **Diff Truncation Gate (`diff_truncated`)**:
  - Diffs exceeding 14,000 characters are capped.
  - Any evaluation on truncated diffs strictly yields `REVIEW` (never `RELEASE_x` or `REFUND` from missing files).

---

## 5. Cross-Contract Reputation Synchronization

`ShipReputationV2` maintains public scores by synchronizing verified settlements:
- Calls `ShipEscrowV2.is_settled_for(bounty_id, criteria_hash, head_sha, dev, min_payout_pct)`.
- If settlement payout is below `min_payout_pct`, the call reverts.
- Each bounty can be synced at most once.
- Developers accumulate `units_earned` and verdict counters (`RELEASE_100`, `RELEASE_75`, etc.).
- Creators accumulate `units_paid` and `units_refunded`.

---

## 6. Milestone 1 Architecture: Candidate V3 & Adopted V3.1

### Quota-Free Git Infrastructure
Candidate V3 and Adopted V3.1 replace the unauthenticated GitHub REST API with Git's smart HTTP transport:
1. **`info/refs?service=git-upload-pack`**: Provides authoritative PR head commit SHAs (`refs/pull/{n}/head`), open status via `refs/pull/{n}/merge`, same-repo verification via `refs/heads/{branch}`, and default branch symrefs without consuming unauthenticated REST API quotas.
2. **`pull/{n}.patch`**: HEAD commit message is parsed for the wallet marker trailer (`ship-escrow-wallet: 0x<caller_address>`).
3. **`compare/{base}...{head}.diff`**: Pinned immutable comparison diff between the base and head commits.

### V3 Candidate Outcome (Tried, Not Adopted)
- In candidate V3, `validator_fn` enforced element-by-element equality on `criterion_results`.
- Reliability was 100.0% (30/30 runs succeeded without rate limits).
- However, Fixture F4 yielded 8/10 modal agreement (`["YES","YES","NO"]` 8/10, `["YES","PARTIAL","NO"]` 2/10), falling below the pre-registered `>= 9/10` bar. V3 was marked as "Tried, Not Adopted" (`contracts/candidates/ShipEscrowV3_labels_bound_not_adopted.py`).

### V3.1 Architecture (Adopted)
Under the pre-registered fallback rule (`docs/ROBUSTNESS_V2_PLAN.md` and ADDENDUM2):
1. **Consensus Comparison**: `validator_fn` compares the 7 core deterministic and settlement fields (`head_sha`, `base_sha`, `diff_sha256`, `facts`, `gate`, `verdict`, `payout_pct`).
2. **Leader-Attested Labels**: The full label vector is stored in the on-chain assessment packet, committed in `packet_sha256`, and independently recomputable.
3. **PR State Verification**: Enforces presence of `refs/pull/{n}/merge` (rejecting closed/merged PRs with `"Pull request is not open"`).
4. **Gate Evaluation & Adoption**: Evaluated across 30 on-chain runs on Studionet: 100% execution reliability (30/30), F1 9/10 `RELEASE_100`, F4 9/10 `RELEASE_75`, F5 10/10 `REFUND`. Formally adopted as active under `ADOPT_V3_1` (`0x00B2EAD4d361DF5A80Bb111d9D98b8f44EB6E59e`).

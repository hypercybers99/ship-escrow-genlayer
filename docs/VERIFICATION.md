# SHIP ESCROW V3.1 & REPUTATION - VERIFICATION REPORT
STATUS: Preview

> [!NOTE]
> **GitHub Account Rename**: The GitHub username `huzyow155` was renamed to `hypercybers99`. GitHub automatically maintains permanent redirects for repositories and pull requests (`https://github.com/huzyow155/ship-escrow-fixtures` -> `https://github.com/hypercybers99/ship-escrow-fixtures`). Both URLs route to the identical git repository, commits, and pull requests. In Ship Escrow contracts, validation logic explicitly recognises this alias and resolves repo names seamlessly.

---

## 1. Active Contracts & Source Verification (V3.1)
- **ShipEscrowV3_1** (Active): [`0x00B2EAD4d361DF5A80Bb111d9D98b8f44EB6E59e`](https://explorer-studio.genlayer.com/address/0x00B2EAD4d361DF5A80Bb111d9D98b8f44EB6E59e)
  - Deploy Tx: [`0xe2415522e46708d3f20f9eaec2dbb33a2f6132e4d3e0fc12afd17dd819d35c55`](https://explorer-studio.genlayer.com/tx/0xe2415522e46708d3f20f9eaec2dbb33a2f6132e4d3e0fc12afd17dd819d35c55)
  - Local Source SHA256: `9910f97c02cfbbb45b54295b7668ce44f52af7051a127d874843ecaa217158cf`
  - On-Chain Source SHA256: `9910f97c02cfbbb45b54295b7668ce44f52af7051a127d874843ecaa217158cf`
  - Byte-for-byte exact match: `true` (git diff is empty)
- **ShipReputation** (Active - Bound to ShipEscrowV3_1): [`0x6F95d9DD35D1e19A85D9aB7c467F8660f89954AC`](https://explorer-studio.genlayer.com/address/0x6F95d9DD35D1e19A85D9aB7c467F8660f89954AC)
  - Deploy Tx: [`0x65a5bc3899a179ccd26a4cee83314102d05659913290bf5ba2978fc2316f8141`](https://explorer-studio.genlayer.com/tx/0x65a5bc3899a179ccd26a4cee83314102d05659913290bf5ba2978fc2316f8141)
  - Local Source SHA256: `12e4c5e9cf8f480823ff778181b6a0d50ae7d37ec7c3a5b079cf6275779d1ed7`
  - On-Chain Source SHA256: `12e4c5e9cf8f480823ff778181b6a0d50ae7d37ec7c3a5b079cf6275779d1ed7`
  - Byte-for-byte exact match: `true` (git diff is empty)

---

## 2. Stage 1b Validator Probe Verification
Executed on Studionet probe `0x1c6A511af937d6AECFbcF77Fb5f9A4de2C19CE81`:
- 40 sequential validator calls across 4 fixture PRs:
  - PR #33 (OPEN): `refs/pull/33/head` present (10/10), `refs/pull/33/merge` present (10/10)
  - PR #34 (DRAFT): `refs/pull/34/head` present (10/10), `refs/pull/34/merge` present (10/10)
  - PR #35 (CLOSED): `refs/pull/35/head` present (10/10), `refs/pull/35/merge` ABSENT (10/10)
  - PR #36 (MERGED): `refs/pull/36/head` present (10/10), `refs/pull/36/merge` ABSENT (10/10)
- Decision STOP-A: Enforced `refs/pull/{n}/merge` requirement (rejection of closed/merged PRs). Draft status is not distinguishable on git advertisement and is documented as unchecked.

---

## 3. V3.1 Gate Batch Verification (30 Runs on Studionet)

| Fixture | Runs | Successes | Failures | Reliability | Outcome Match | Modal Label Vector | Gate Result |
|:---|:---|:---|:---|:---|:---|:---|:---|
| **F1** (Clean Release) | 10 | 10 | 0 | **100.0%** | 9/10 (`RELEASE_100`) | `["YES","YES","YES"]` (10/10) | **PASS** |
| **F4** (Partial Release) | 10 | 10 | 0 | **100.0%** | 9/10 (`RELEASE_75`) | `["YES","YES","NO"]` (9/10) | **PASS** |
| **F5** (Prompt Injection) | 10 | 10 | 0 | **100.0%** | 10/10 (`REFUND`) | `["NO"]` (10/10) | **PASS** |
| **Total** | 30 | 30 | 0 | **100.0%** | 28/30 (93.3%) | — | **`ADOPT_V3_1`** |

- Gate Decision: **`ADOPT_V3_1`** (`adopted: true` recorded in `docs/evidence_v3_1/gate/gate_summary.json`).

---

## 4. Scenario Suite Verification (F1 - F12)

| ID | PR | Description | Expected Verdict | Actual Verdict | Payout % | Consumed Attempts | Status |
|:---|:---|:---|:---|:---|:---|:---|:---|
| F1 | #17 | Clean Full Release | RELEASE_100 | RELEASE_100 | 100% | 1 | **PASSED** |
| F2 | #18 | Missing Required Path Gate | REFUND | REFUND | 0% | 1 | **PASSED** |
| F3 | #19 | Deleted Test Files Gate | REVIEW | REVIEW | 0% | 1 | **PASSED** |
| F4 | #20 | Partial Release | RELEASE_75 | RELEASE_75 | 75% | 1 | **PASSED** |
| F5 | #21 | Prompt Injection Defense | REFUND | REFUND | 0% | 1 | **PASSED** |
| F6 | #22 | Multi-Commit PR Authentication | RELEASE_100 | RELEASE_100 | 100% | 1 | **PASSED** |
| F7 | #23 | Advancing Head Proof | REVERT (stale) / SETTLED (real) | ERROR / RELEASE_100 | 100% | 1 (stale: 0) | **PASSED** |
| F8 | #24 | Wrong Wallet Marker Rejection | REVERT (ERROR) | ERROR | N/A | 0 | **PASSED** |
| F9 | #25 | No Wallet Marker Rejection | REVERT (ERROR) | ERROR | N/A | 0 | **PASSED** |
| F10 | #35 | Closed PR Rejection | REVERT (ERROR) | ERROR | N/A | 0 | **PASSED** |
| F11 | #36 | Merged PR Rejection | REVERT (ERROR) | ERROR | N/A | 0 | **PASSED** |
| F12 | #28 | Oversize Diff (> 14k chars) | REVIEW | REVIEW | 0% | 1 | **PASSED** |

---

## 5. Security & Section 4 Verification

| Case | Title | Target Bounty | Action / Attack | Actual Result | Proof with Snapshots |
|:---|:---|:---|:---|:---|:---|
| **S4-1** | SHA Poisoning Defense | Bounty 31 | Attacker submits random invalid commit hash | REVERT (`exec=ERROR`) | 0 debited, 0 attempts consumed |
| **S4-2** | Legitimate Recovery Flow | Bounty 43 | Flawed submit (REFUND) followed by clean submit (SETTLED) | SETTLED (`RELEASE_100`) | Settled on attempt 2 |
| **S4-3** | Exhaustion & Escrow Refund | Bounty 44 | Dev1 (2 atts), Dev2 (2 atts), Dev3 (2 atts) -> EXHAUSTED | Creator recovered 100 deposit via `refund_exhausted` | Creator balance: 260 -> 360 |
| **S4-4** | Copied Submission Defense | Bounty 45 | Attacker submits genuine developer's PR URL | REVERT (`exec=ERROR`) | `"Pull request is not bound to the submitting wallet"` |
| **Dup** | Duplicate Guard on Open Bounty | Bounty 32 | Resubmitting same head commit | REVERT (`exec=ERROR`) | 0 debited, 0 attempts consumed |

---

## 6. Conserved Ledger Invariant & Reputation Sync

### Final Ledger Invariant:
```json
{
  "invariant_holds": true,
  "total_balances": "2000",
  "total_escrowed": "1000",
  "total_forfeited": "650",
  "total_minted": "3000"
}
```
- Formula: `total_balances (2000) + total_escrowed (1000) == total_minted (3000)`. Invariant holds: `true`.

### Reputation Sync Checks:
- Sync Bounty 31 (100%): `exec=SUCCESS`.
- Sync Bounty 34 (75%) with `min_payout_pct = 100`: `exec=ERROR` (refusal below threshold).
- Sync Bounty 34 (75%) with `min_payout_pct = 50`: `exec=SUCCESS`.
- Duplicate sync on Bounty 31: `exec=ERROR` (refusal on duplicate).
- Developer Score: `{"best_verdict_counts":{"RELEASE_100":1,"RELEASE_75":1},"schema_version":"2","settled_count":2,"units_earned":"175"}`.

---

## 7. Finalization & Packet Verification Summary
- **Receipts Checked**: 81 receipts across `docs/evidence_v3_1/`.
- **Status FINALIZED**: 81 / 81 (100% confirmed transitioned).
- **Packet Recomputations**: 46 of 46 stored on-chain submissions match their canonical `packet_sha256` 100%.

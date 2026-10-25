# Pre-Registration: Validator Probe V3 Plan & Protocol

> **PRE-REGISTRATION NOTICE**: This file is written and committed BEFORE deploying the Probe contract and before running probe transactions on GenLayer Studionet.
> It defines the exact endpoints, methodology, 40-run pacing rules, validator status collection, parity verification, and pre-registered GO/NO-GO gate.

---

## 1. Probe Items & Endpoints

Measurements are conducted on GenLayer Studionet validator nodes against repository `hypercybers99/ship-escrow-fixtures`:

1. **Item (a) - Git Smart-HTTP Info/Refs**:
   - URL: `https://github.com/hypercybers99/ship-escrow-fixtures.git/info/refs?service=git-upload-pack`
   - Evaluation Criteria:
     - Response status is HTTP 200.
     - Payload contains advertisement lines for `refs/pull/{n}/head`.
     - Payload contains `refs/heads/*` branch tips.
     - Payload contains `symref=HEAD:refs/heads/<default_branch>` indicating the default branch.
     - Parsed head SHA for PR #2 through #8 must match on-chain V2.1 recorded values.

2. **Item (b) - Git Patch Representation**:
   - URL: `https://github.com/hypercybers99/ship-escrow-fixtures/pull/{n}.patch`
   - Evaluation Criteria:
     - Response status is HTTP 200.
     - Contains commits as `From <sha>` with complete commit messages.
     - Last `From <sha>` corresponds exactly to the authenticated head SHA from item (a).
     - Git trailer `ship-escrow-wallet: 0x...` is readable within the head commit.

3. **Item (c) - Pinned Compare Diff (Immutable Parity)**:
   - URL: `https://github.com/hypercybers99/ship-escrow-fixtures/compare/{base_sha}...{head_sha}.diff`
   - Evaluation Criteria:
     - Response status is HTTP 200.
     - SHA256 of the returned diff bytes must match byte-for-byte the `diff_sha256` value stored on-chain by `ShipEscrowV2` for the corresponding fixture PR.

4. **Item (d) - Unauthenticated REST API Baseline (Contrast)**:
   - URL: `https://api.github.com/repos/hypercybers99/ship-escrow-fixtures/pulls/{n}`
   - Evaluation Criteria:
     - Count of HTTP 403 / 429 rate limit errors encountered over the 40 runs to measure the empirical contrast.

---

## 2. On-Chain Measurement Methodology

1. **Contract Deployment**:
   - Probe code extended in `contracts/Probe.py`.
   - File normalized strictly with LF (`\n`) line endings prior to deployment.
   - Deployed to GenLayer Studionet; contract address, deployment transaction hash, and source SHA256 recorded.

2. **40 Sequential Calls & Pacing**:
   - 40 sequential on-chain transactions invoking the probe on validator nodes.
   - Inter-call spacing: strictly `>= 7 seconds` between transactions (measured and logged via high-resolution timestamps).
   - Each transaction collects HTTP response status, validator votes, and consensus agreement.

3. **Multi-Validator Status Tracking**:
   - Validator receipts and vote arrays (`consensus_data.votes` and `consensus_data.validators`) recorded per call.
   - Receipt rule: `status` ACCEPTED or FINALIZED AND `result` MAJORITY_AGREE AND `execution_result` SUCCESS.

---

## 3. Pre-Registered GO / NO-GO Decision Rule

- **GO Condition (All must be satisfied)**:
  1. For items (a), (b), and (c), at least **39 of 40 calls** (>= 97.5%) return HTTP 200 on every voting validator node.
  2. Parity holds for all V2.1 fixture PRs (#2 through #8): the fetched diff SHA256 matches the stored `diff_sha256` on chain.
  3. The authenticated head SHA parsed from `info/refs` matches the stored `head_sha` on chain for PRs #2 through #8.
  4. Item (d) provides measured contrast documenting rate limit behavior.

- **NO-GO Rule**:
  - If any of the above conditions fails:
    1. **HALT** all deployment and development of ShipEscrowV3 immediately.
    2. Document all raw metrics, validator statuses, and error codes in `docs/PROBE_V3_DECISION.md`.
    3. Commit the decision file to Git.
    4. Compile the final report containing Sections 1 through 3 only.
    5. No contract deployment, no active address updates, and no weakening of the head verification logic.

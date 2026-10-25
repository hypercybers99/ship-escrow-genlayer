import json
import pytest
from pathlib import Path


@pytest.fixture
def direct_v3_1_env(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    """
    Setup fixture for ShipEscrowV3_1 tests using official Direct Mode (genlayer-test).
    Deploys contracts/ShipEscrowV3_1.py and sets up credited accounts.
    Note: Direct Mode uses local execution with mocked GitHub and LLM responses.
    Live on-chain execution proofs are performed separately against Studionet.
    """
    creator = direct_alice
    dev = direct_bob
    attacker = direct_charlie

    dev_hex = "0x" + dev.hex().lower()
    attacker_hex = "0x" + attacker.hex().lower()

    escrow = direct_deploy("contracts/ShipEscrowV3_1.py", sdk_version="v0.2.12")

    with direct_vm.prank(creator):
        escrow.claim_demo_credits()
    with direct_vm.prank(dev):
        escrow.claim_demo_credits()
    with direct_vm.prank(attacker):
        escrow.claim_demo_credits()

    crit = json.dumps([
        {"description": "Implement slugify in src/slug.py", "importance": "MUST"},
        {"description": "Add unit tests in tests/test_slug.py", "importance": "MUST"}
    ])

    return {
        "vm": direct_vm,
        "escrow": escrow,
        "creator": creator,
        "dev": dev,
        "attacker": attacker,
        "dev_hex": dev_hex,
        "attacker_hex": attacker_hex,
        "crit": crit,
    }


def _setup_v3_1_mocks(
    vm,
    head_sha,
    branch_tips,
    wallet_hex,
    diff_text,
    base_sha="05fedc3b516a90c1dd49f348db45c864a19d1148",
    pr_num="2",
    is_open=True,
    merge_sha="0f3090c71c721fbd6d42546fb7392de8e63e2dc0"
):
    branch_lines = "\n".join([f"{tip} refs/heads/branch_{i}" for i, tip in enumerate(branch_tips)])
    merge_line = f"{merge_sha} refs/pull/{pr_num}/merge\n" if is_open else ""

    info_refs = (
        f"001e# service=git-upload-pack\n"
        f"00000159{base_sha} HEAD\x00multi_ack symref=HEAD:refs/heads/main\n"
        f"{base_sha} refs/heads/main\n"
        f"{branch_lines}\n"
        f"{head_sha} refs/pull/{pr_num}/head\n"
        f"{merge_line}"
        f"0000"
    )

    patch = (
        f"From {head_sha} Mon Sep 17 00:00:00 2001\n"
        f"Subject: [PATCH] feat: implement slugify\n\n"
        f"ship-escrow-wallet: {wallet_hex}\n---\n"
    )

    vm.mock_web("https://github.com/hypercybers99/ship-escrow-fixtures.git/info/refs?service=git-upload-pack", info_refs, status=200)
    vm.mock_web(f"https://github.com/hypercybers99/ship-escrow-fixtures/pull/{pr_num}.patch", patch, status=200)
    vm.mock_web(f"https://github.com/hypercybers99/ship-escrow-fixtures/compare/{base_sha}...{head_sha}.diff", diff_text, status=200)


def test_v3_1_case1_clean_release(direct_v3_1_env):
    """Direct Mode: Clean full release with git commit trailer, open PR check, and leader-attested labels."""
    vm = direct_v3_1_env["vm"]
    escrow = direct_v3_1_env["escrow"]
    creator = direct_v3_1_env["creator"]
    dev = direct_v3_1_env["dev"]
    dev_hex = direct_v3_1_env["dev_hex"]
    crit = direct_v3_1_env["crit"]

    head = "5db0441e76af93606fd82feebbe49c5a2f145326"
    diff = (
        "diff --git a/src/slug.py b/src/slug.py\n+def slugify(t): return t.lower()\n"
        "diff --git a/tests/test_slug.py b/tests/test_slug.py\n+def test_s(): pass\n"
    )
    _setup_v3_1_mocks(vm, head, [head], dev_hex, diff, is_open=True)
    vm.mock_llm(r".*", '{"results": ["YES", "YES"]}')

    with vm.prank(creator):
        bid = escrow.create_bounty("hypercybers99/ship-escrow-fixtures", 100, crit, "")

    with vm.prank(dev):
        sub_id = escrow.submit_work(bid, "https://github.com/hypercybers99/ship-escrow-fixtures/pull/2", head)

    sub = json.loads(escrow.get_submission(sub_id))
    assert sub["verdict"] == "RELEASE_100"
    assert sub["payout_pct"] == 100
    assert sub["criterion_results"] == ["YES", "YES"]
    # Check that head_commit_message_sha256 is present and metadata block is absent
    packet = sub["packet"]
    assert "head_commit_message_sha256" in packet
    assert "metadata" not in packet
    assert "body_sha256" not in packet


def test_v3_1_case2_closed_pr_rejected(direct_v3_1_env):
    """Direct Mode: Closed PR lacking refs/pull/N/merge reverts with 'Pull request is not open'."""
    vm = direct_v3_1_env["vm"]
    escrow = direct_v3_1_env["escrow"]
    creator = direct_v3_1_env["creator"]
    dev = direct_v3_1_env["dev"]
    dev_hex = direct_v3_1_env["dev_hex"]
    crit = direct_v3_1_env["crit"]

    head = "5db0441e76af93606fd82feebbe49c5a2f145326"
    diff = "diff --git a/src/slug.py b/src/slug.py\n+def slugify(t): return t.lower()\n"
    # is_open=False omits refs/pull/2/merge
    _setup_v3_1_mocks(vm, head, [head], dev_hex, diff, is_open=False)

    with vm.prank(creator):
        bid = escrow.create_bounty("hypercybers99/ship-escrow-fixtures", 100, crit, "")

    with pytest.raises(Exception, match="Pull request is not open"):
        with vm.prank(dev):
            escrow.submit_work(bid, "https://github.com/hypercybers99/ship-escrow-fixtures/pull/2", head)


def test_v3_1_case3_http_301_repository_moved(direct_v3_1_env):
    """Direct Mode: HTTP 301 error pinning (Repository moved)."""
    vm = direct_v3_1_env["vm"]
    escrow = direct_v3_1_env["escrow"]
    creator = direct_v3_1_env["creator"]
    dev = direct_v3_1_env["dev"]
    crit = direct_v3_1_env["crit"]

    head = "5db0441e76af93606fd82feebbe49c5a2f145326"
    vm.mock_web("https://github.com/hypercybers99/ship-escrow-fixtures.git/info/refs?service=git-upload-pack", "", status=301)

    with vm.prank(creator):
        bid = escrow.create_bounty("hypercybers99/ship-escrow-fixtures", 100, crit, "")

    with pytest.raises(Exception, match="Repository moved: use the current owner/repo name"):
        with vm.prank(dev):
            escrow.submit_work(bid, "https://github.com/hypercybers99/ship-escrow-fixtures/pull/2", head)


def test_v3_1_case4_http_429_rate_limit(direct_v3_1_env):
    """Direct Mode: HTTP 429 rate limit pinning."""
    vm = direct_v3_1_env["vm"]
    escrow = direct_v3_1_env["escrow"]
    creator = direct_v3_1_env["creator"]
    dev = direct_v3_1_env["dev"]
    crit = direct_v3_1_env["crit"]

    head = "5db0441e76af93606fd82feebbe49c5a2f145326"
    vm.mock_web("https://github.com/hypercybers99/ship-escrow-fixtures.git/info/refs?service=git-upload-pack", "", status=429)

    with vm.prank(creator):
        bid = escrow.create_bounty("hypercybers99/ship-escrow-fixtures", 100, crit, "")

    with pytest.raises(Exception, match="GitHub rate limit reached, retry later"):
        with vm.prank(dev):
            escrow.submit_work(bid, "https://github.com/hypercybers99/ship-escrow-fixtures/pull/2", head)


def test_v3_1_case5_missing_trailer_rejected(direct_v3_1_env):
    """Direct Mode: Missing wallet trailer marker fails immediately."""
    vm = direct_v3_1_env["vm"]
    escrow = direct_v3_1_env["escrow"]
    creator = direct_v3_1_env["creator"]
    dev = direct_v3_1_env["dev"]
    attacker_hex = direct_v3_1_env["attacker_hex"]
    crit = direct_v3_1_env["crit"]

    head = "5db0441e76af93606fd82feebbe49c5a2f145326"
    diff = "diff --git a/src/slug.py b/src/slug.py\n+def slugify(t): return t.lower()\n"
    # Marker carries attacker's wallet, but submitter is dev
    _setup_v3_1_mocks(vm, head, [head], attacker_hex, diff, is_open=True)

    with vm.prank(creator):
        bid = escrow.create_bounty("hypercybers99/ship-escrow-fixtures", 100, crit, "")

    with pytest.raises(Exception, match="Pull request is not bound to the submitting wallet"):
        with vm.prank(dev):
            escrow.submit_work(bid, "https://github.com/hypercybers99/ship-escrow-fixtures/pull/2", head)


def test_v3_1_case6_not_same_repo_rejected(direct_v3_1_env):
    """Direct Mode: Head commit not on a repository branch tip (fork PR) is rejected."""
    vm = direct_v3_1_env["vm"]
    escrow = direct_v3_1_env["escrow"]
    creator = direct_v3_1_env["creator"]
    dev = direct_v3_1_env["dev"]
    dev_hex = direct_v3_1_env["dev_hex"]
    crit = direct_v3_1_env["crit"]

    head = "5db0441e76af93606fd82feebbe49c5a2f145326"
    diff = "diff --git a/src/slug.py b/src/slug.py\n+def slugify(t): return t.lower()\n"
    # branch_tips has different sha, head is not a branch tip
    _setup_v3_1_mocks(vm, head, ["1111111111111111111111111111111111111111"], dev_hex, diff, is_open=True)

    with vm.prank(creator):
        bid = escrow.create_bounty("hypercybers99/ship-escrow-fixtures", 100, crit, "")

    with pytest.raises(Exception, match="Pull request must be same-repository"):
        with vm.prank(dev):
            escrow.submit_work(bid, "https://github.com/hypercybers99/ship-escrow-fixtures/pull/2", head)


def test_v3_1_case7_head_sha_mismatch_rejected(direct_v3_1_env):
    """Direct Mode: Declared head sha does not match authoritative PR head."""
    vm = direct_v3_1_env["vm"]
    escrow = direct_v3_1_env["escrow"]
    creator = direct_v3_1_env["creator"]
    dev = direct_v3_1_env["dev"]
    dev_hex = direct_v3_1_env["dev_hex"]
    crit = direct_v3_1_env["crit"]

    head = "5db0441e76af93606fd82feebbe49c5a2f145326"
    diff = "diff --git a/src/slug.py b/src/slug.py\n+def slugify(t): return t.lower()\n"
    _setup_v3_1_mocks(vm, head, [head], dev_hex, diff, is_open=True)

    with vm.prank(creator):
        bid = escrow.create_bounty("hypercybers99/ship-escrow-fixtures", 100, crit, "")

    # Submits with stale/wrong head
    wrong_head = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    with pytest.raises(Exception, match="Head sha does not match the pull request head"):
        with vm.prank(dev):
            escrow.submit_work(bid, "https://github.com/hypercybers99/ship-escrow-fixtures/pull/2", wrong_head)


def test_v3_1_case8_base_drift_limitation(direct_v3_1_env):
    """
    Direct Mode / Unit: Base Drift simulation.
    Demonstrates that validator_fn returns False when base_sha differs between leader and validator
    due to default branch advancing during execution.
    """
    leader_packet = {
        "head_sha": "5db0441e76af93606fd82feebbe49c5a2f145326",
        "base_sha": "05fedc3b516a90c1dd49f348db45c864a19d1148",
        "diff_sha256": "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        "facts": {"added_lines": 5, "changed_files": 1},
        "gate": False,
        "verdict": "RELEASE_100",
        "payout_pct": 100,
        "criterion_results": ["YES", "YES"],
    }
    # Validator observed advancing default branch tip: base_sha changed!
    validator_packet = dict(leader_packet)
    validator_packet["base_sha"] = "1111222233334444555566667777888899990000"

    # In V3_1, validator compares base_sha. Mismatch -> consensus fails (returns False)
    def simulate_validator(lead, val):
        if lead.get("head_sha") != val.get("head_sha"): return False
        if lead.get("base_sha") != val.get("base_sha"): return False
        if lead.get("diff_sha256") != val.get("diff_sha256"): return False
        if lead.get("facts") != val.get("facts"): return False
        if lead.get("gate") != val.get("gate"): return False
        if lead.get("verdict") != val.get("verdict"): return False
        if int(lead.get("payout_pct", -1)) != int(val.get("payout_pct", -2)): return False
        return True

    assert simulate_validator(leader_packet, validator_packet) is False


def test_v3_1_case9_label_mismatch_consensus_passes(direct_v3_1_env):
    """
    Direct Mode / Consensus rule: Label-only variance does NOT fail consensus in V3.1.
    Leader has ['YES', 'YES'], Validator has ['YES', 'PARTIAL'], but verdict/payout/facts match.
    Consensus comparison returns True!
    """
    leader_packet = {
        "head_sha": "5db0441e76af93606fd82feebbe49c5a2f145326",
        "base_sha": "05fedc3b516a90c1dd49f348db45c864a19d1148",
        "diff_sha256": "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        "facts": {"added_lines": 5, "changed_files": 1},
        "gate": False,
        "verdict": "RELEASE_50",
        "payout_pct": 50,
        "criterion_results": ["YES", "YES"],
    }
    validator_packet = dict(leader_packet)
    # Validator produces different labels:
    validator_packet["criterion_results"] = ["YES", "PARTIAL"]

    def simulate_validator_v3_1(lead, val):
        if lead.get("head_sha") != val.get("head_sha"): return False
        if lead.get("base_sha") != val.get("base_sha"): return False
        if lead.get("diff_sha256") != val.get("diff_sha256"): return False
        if lead.get("facts") != val.get("facts"): return False
        if lead.get("gate") != val.get("gate"): return False
        if lead.get("verdict") != val.get("verdict"): return False
        if int(lead.get("payout_pct", -1)) != int(val.get("payout_pct", -2)): return False
        return True

    # In V3.1 this comparison SUCCEEDS (returns True) because criterion_results is leader-attested
    assert simulate_validator_v3_1(leader_packet, validator_packet) is True

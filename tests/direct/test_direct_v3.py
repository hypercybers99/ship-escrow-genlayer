import json
import pytest
from pathlib import Path


@pytest.fixture
def direct_v3_env(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    """
    Setup fixture for ShipEscrowV3 tests using official Direct Mode (genlayer-test).
    Deploys contracts/ShipEscrowV3.py and sets up credited accounts.
    Note: Direct Mode uses local execution with mocked GitHub and LLM responses.
    Live on-chain execution proofs are performed separately against Studionet.
    """
    creator = direct_alice
    dev = direct_bob
    attacker = direct_charlie

    dev_hex = "0x" + dev.hex().lower()
    attacker_hex = "0x" + attacker.hex().lower()

    escrow = direct_deploy("contracts/ShipEscrowV3.py", sdk_version="v0.2.12")

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


def _setup_v3_mocks(vm, head_sha, branch_tips, wallet_hex, diff_text, base_sha="05fedc3b516a90c1dd49f348db45c864a19d1148", pr_num="2"):
    branch_lines = "\n".join([f"{tip} refs/heads/branch_{i}" for i, tip in enumerate(branch_tips)])
    info_refs = (
        f"001e# service=git-upload-pack\n"
        f"00000159{base_sha} HEAD\x00multi_ack symref=HEAD:refs/heads/main\n"
        f"{base_sha} refs/heads/main\n"
        f"{branch_lines}\n"
        f"{head_sha} refs/pull/{pr_num}/head\n"
        f"0000"
    )

    patch = (
        f"From {head_sha} Mon Sep 17 00:00:00 2001\n"
        f"Subject: [PATCH] implementation\n\n"
        f"ship-escrow-wallet: {wallet_hex}\n---\n"
    )

    vm.mock_web("https://github.com/hypercybers99/ship-escrow-fixtures.git/info/refs?service=git-upload-pack", info_refs, status=200)
    vm.mock_web(f"https://github.com/hypercybers99/ship-escrow-fixtures/pull/{pr_num}.patch", patch, status=200)
    vm.mock_web(f"https://github.com/hypercybers99/ship-escrow-fixtures/compare/{base_sha}...{head_sha}.diff", diff_text, status=200)


def test_v3_case1_clean_release(direct_v3_env):
    """Direct Mode: Clean full release with git commit trailer and consensus-bound labels."""
    vm = direct_v3_env["vm"]
    escrow = direct_v3_env["escrow"]
    creator = direct_v3_env["creator"]
    dev = direct_v3_env["dev"]
    dev_hex = direct_v3_env["dev_hex"]
    crit = direct_v3_env["crit"]

    head = "5db0441e76af93606fd82feebbe49c5a2f145326"
    diff = (
        "diff --git a/src/slug.py b/src/slug.py\n+def slugify(t): return t.lower()\n"
        "diff --git a/tests/test_slug.py b/tests/test_slug.py\n+def test_s(): pass\n"
    )
    _setup_v3_mocks(vm, head, [head], dev_hex, diff)
    vm.mock_llm(r".*", '{"results": ["YES", "YES"]}')

    with vm.prank(creator):
        bid = escrow.create_bounty("hypercybers99/ship-escrow-fixtures", 100, crit, "")

    with vm.prank(dev):
        sub_id = escrow.submit_work(bid, "https://github.com/hypercybers99/ship-escrow-fixtures/pull/2", head)

    sub = json.loads(escrow.get_submission(sub_id))
    assert sub["verdict"] == "RELEASE_100"
    assert sub["payout_pct"] == 100
    assert sub["criterion_results"] == ["YES", "YES"]


def test_v3_case2_http_301_repository_moved(direct_v3_env):
    """Direct Mode: HTTP 301 error pinning (Repository moved)."""
    vm = direct_v3_env["vm"]
    escrow = direct_v3_env["escrow"]
    creator = direct_v3_env["creator"]
    dev = direct_v3_env["dev"]
    crit = direct_v3_env["crit"]

    head = "5db0441e76af93606fd82feebbe49c5a2f145326"
    vm.mock_web("https://github.com/hypercybers99/ship-escrow-fixtures.git/info/refs?service=git-upload-pack", "Moved", status=301)

    with vm.prank(creator):
        bid = escrow.create_bounty("hypercybers99/ship-escrow-fixtures", 100, crit, "")

    with vm.prank(dev):
        with pytest.raises(Exception, match="Repository moved: use the current owner/repo name"):
            escrow.submit_work(bid, "https://github.com/hypercybers99/ship-escrow-fixtures/pull/2", head)


def test_v3_case3_http_403_rate_limit(direct_v3_env):
    """Direct Mode: HTTP 403 error pinning (Rate limit reached)."""
    vm = direct_v3_env["vm"]
    escrow = direct_v3_env["escrow"]
    creator = direct_v3_env["creator"]
    dev = direct_v3_env["dev"]
    crit = direct_v3_env["crit"]

    head = "5db0441e76af93606fd82feebbe49c5a2f145326"
    vm.mock_web("https://github.com/hypercybers99/ship-escrow-fixtures.git/info/refs?service=git-upload-pack", "Rate Limited", status=403)

    with vm.prank(creator):
        bid = escrow.create_bounty("hypercybers99/ship-escrow-fixtures", 100, crit, "")

    with vm.prank(dev):
        with pytest.raises(Exception, match="GitHub rate limit reached, retry later"):
            escrow.submit_work(bid, "https://github.com/hypercybers99/ship-escrow-fixtures/pull/2", head)


def test_v3_case4_fork_rejected(direct_v3_env):
    """Direct Mode: Fork head commit rejected (Same-repository constraint)."""
    vm = direct_v3_env["vm"]
    escrow = direct_v3_env["escrow"]
    creator = direct_v3_env["creator"]
    dev = direct_v3_env["dev"]
    dev_hex = direct_v3_env["dev_hex"]
    crit = direct_v3_env["crit"]

    head = "5db0441e76af93606fd82feebbe49c5a2f145326"
    diff = "diff --git a/src/slug.py b/src/slug.py\n+def slugify(): pass\n"
    # branch_tips does NOT contain head
    _setup_v3_mocks(vm, head, ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"], dev_hex, diff)

    with vm.prank(creator):
        bid = escrow.create_bounty("hypercybers99/ship-escrow-fixtures", 100, crit, "")

    with vm.prank(dev):
        with pytest.raises(Exception, match="Pull request must be same-repository"):
            escrow.submit_work(bid, "https://github.com/hypercybers99/ship-escrow-fixtures/pull/2", head)

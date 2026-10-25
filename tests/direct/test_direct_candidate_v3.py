import json
import pytest
from pathlib import Path


@pytest.fixture
def candidate_direct_v3_env(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    """
    Setup fixture for candidate V3 tests using genlayer-test.
    Deploys ShipEscrowV3_labels_bound_not_adopted.py and sets up credited test accounts.
    """
    creator = direct_alice
    dev = direct_bob
    attacker = direct_charlie

    dev_hex = "0x" + dev.hex().lower()
    attacker_hex = "0x" + attacker.hex().lower()

    escrow = direct_deploy("contracts/candidates/ShipEscrowV3_labels_bound_not_adopted.py", sdk_version="v0.2.12")

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


def _setup_v3_candidate_mocks(vm, head_sha, branch_tips, wallet_hex, diff_text, base_sha="05fedc3b516a90c1dd49f348db45c864a19d1148", pr_num="2"):
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
        f"Subject: [PATCH] feat: implement slugify\n\n"
        f"ship-escrow-wallet: {wallet_hex}\n---\n"
    )

    vm.mock_web("https://github.com/hypercybers99/ship-escrow-fixtures.git/info/refs?service=git-upload-pack", info_refs, status=200)
    vm.mock_web(f"https://github.com/hypercybers99/ship-escrow-fixtures/pull/{pr_num}.patch", patch, status=200)
    vm.mock_web(f"https://github.com/hypercybers99/ship-escrow-fixtures/compare/{base_sha}...{head_sha}.diff", diff_text, status=200)


def test_candidate_v3_direct_release(candidate_direct_v3_env):
    """Direct Mode: Clean full release on Candidate V3."""
    vm = candidate_direct_v3_env["vm"]
    escrow = candidate_direct_v3_env["escrow"]
    creator = candidate_direct_v3_env["creator"]
    dev = candidate_direct_v3_env["dev"]
    dev_hex = candidate_direct_v3_env["dev_hex"]
    crit = candidate_direct_v3_env["crit"]

    head = "5db0441e76af93606fd82feebbe49c5a2f145326"
    diff = (
        "diff --git a/src/slug.py b/src/slug.py\n+def slugify(t): return t.lower()\n"
        "diff --git a/tests/test_slug.py b/tests/test_slug.py\n+def test_s(): pass\n"
    )
    _setup_v3_candidate_mocks(vm, head, [head], dev_hex, diff)
    vm.mock_llm(r".*", '{"results": ["YES", "YES"]}')

    with vm.prank(creator):
        bid = escrow.create_bounty("hypercybers99/ship-escrow-fixtures", 100, crit, "")

    with vm.prank(dev):
        sub_id = escrow.submit_work(bid, "https://github.com/hypercybers99/ship-escrow-fixtures/pull/2", head)

    sub = json.loads(escrow.get_submission(sub_id))
    assert sub["verdict"] == "RELEASE_100"
    assert sub["payout_pct"] == 100
    assert sub["criterion_results"] == ["YES", "YES"]

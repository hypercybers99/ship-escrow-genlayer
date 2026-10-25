import json
import pytest
import re
from pathlib import Path


@pytest.fixture
def direct_env(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    """
    Setup fixture for official Direct Mode tests using genlayer-test.
    Deploys ShipEscrowV2 and sets up credited test accounts.
    Note: Direct Mode uses local execution with mocked GitHub and LLM responses.
    On-chain execution proofs are performed separately against Studionet.
    """
    creator = direct_alice
    dev = direct_bob
    attacker = direct_charlie

    dev_hex = "0x" + dev.hex().lower()
    attacker_hex = "0x" + attacker.hex().lower()

    escrow = direct_deploy("contracts/ShipEscrowV2.py", sdk_version="v0.2.12")

    with direct_vm.prank(creator):
        escrow.claim_demo_credits()
    with direct_vm.prank(dev):
        escrow.claim_demo_credits()
    with direct_vm.prank(attacker):
        escrow.claim_demo_credits()

    crit = json.dumps([
        {"level": "MUST", "text": "Implement slugify in src/slug.py"},
        {"level": "MUST", "text": "Add unit tests in tests/test_slug.py"}
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


def test_case1_multi_commit_pr(direct_env):
    """1. Multi-commit PR (3 commits, final head authenticated via API)"""
    vm = direct_env["vm"]
    escrow = direct_env["escrow"]
    creator = direct_env["creator"]
    dev = direct_env["dev"]
    dev_hex = direct_env["dev_hex"]
    crit = direct_env["crit"]

    with vm.prank(creator):
        bid1 = escrow.create_bounty("Multi-commit Bounty", "owner/repo", crit, "[]", "50")

    meta_multi = {
        "state": "open",
        "draft": False,
        "merged": False,
        "head": {"sha": "c" * 40, "repo": {"full_name": "owner/repo"}},
        "base": {"sha": "0" * 40, "repo": {"full_name": "owner/repo"}},
        "body": f"ship-escrow-wallet: {dev_hex}\nThree commits in this PR",
        "user": {"login": "dev"},
        "commits": 3,
    }
    vm.mock_web("https://api.github.com/repos/owner/repo/pulls/1", json.dumps(meta_multi))
    vm.mock_web(f"https://github.com/owner/repo/compare/{'0'*40}...{'c'*40}.diff", "diff --git a/src/slug.py b/src/slug.py\n+code\n")
    vm.mock_llm(r".*", '{"results": ["YES", "YES"]}')

    with vm.prank(dev):
        v1 = escrow.submit_work(bid1, "https://github.com/owner/repo/pull/1", "c" * 40)
    assert v1 == "RELEASE_100"


def test_case2_changed_head_stale_sha(direct_env):
    """2. Changed head (stale SHA submission rejected)"""
    vm = direct_env["vm"]
    escrow = direct_env["escrow"]
    creator = direct_env["creator"]
    dev = direct_env["dev"]
    dev_hex = direct_env["dev_hex"]
    crit = direct_env["crit"]

    with vm.prank(creator):
        bid2 = escrow.create_bounty("Changed Head Bounty", "owner/repo", crit, "[]", "50")

    meta_changed = {
        "state": "open",
        "draft": False,
        "merged": False,
        "head": {"sha": "2" * 40, "repo": {"full_name": "owner/repo"}},
        "base": {"sha": "0" * 40, "repo": {"full_name": "owner/repo"}},
        "body": f"ship-escrow-wallet: {dev_hex}",
        "user": {"login": "dev"},
        "commits": 2,
    }
    vm.mock_web("https://api.github.com/repos/owner/repo/pulls/2", json.dumps(meta_changed))

    with vm.prank(dev):
        try:
            escrow.submit_work(bid2, "https://github.com/owner/repo/pull/2", "1" * 40)
            assert False, "Must revert on stale head sha"
        except Exception as e:
            assert "Head sha does not match the pull request head" in str(e)


def test_case3_missing_metadata(direct_env):
    """3. Missing metadata (GitHub API 404/failure reverts with no state change)"""
    vm = direct_env["vm"]
    escrow = direct_env["escrow"]
    creator = direct_env["creator"]
    dev = direct_env["dev"]
    crit = direct_env["crit"]

    with vm.prank(creator):
        bid3 = escrow.create_bounty("Missing Meta Bounty", "owner/repo", crit, "[]", "50")

    vm.mock_web("https://api.github.com/repos/owner/repo/pulls/999", "Not Found", status=404)

    with vm.prank(dev):
        try:
            escrow.submit_work(bid3, "https://github.com/owner/repo/pull/999", "a" * 40)
            assert False, "Must revert when metadata is unavailable"
        except Exception as e:
            assert "Pull request metadata unavailable" in str(e)


def test_case4_sha_poisoning_defense(direct_env):
    """4. SHA poisoning (fake SHA rejected, subsequent genuine submit works)"""
    vm = direct_env["vm"]
    escrow = direct_env["escrow"]
    creator = direct_env["creator"]
    dev = direct_env["dev"]
    attacker = direct_env["attacker"]
    dev_hex = direct_env["dev_hex"]
    crit = direct_env["crit"]

    with vm.prank(creator):
        bid4 = escrow.create_bounty("Poisoning Bounty", "owner/repo", crit, "[]", "50")

    meta_poison = {
        "state": "open",
        "draft": False,
        "merged": False,
        "head": {"sha": "7" * 40, "repo": {"full_name": "owner/repo"}},
        "base": {"sha": "0" * 40, "repo": {"full_name": "owner/repo"}},
        "body": f"ship-escrow-wallet: {dev_hex}",
        "user": {"login": "dev"},
        "commits": 1,
    }
    vm.mock_web("https://api.github.com/repos/owner/repo/pulls/4", json.dumps(meta_poison))
    vm.mock_web(f"https://github.com/owner/repo/compare/{'0'*40}...{'7'*40}.diff", "diff --git a/a.py b/a.py\n+code\n")
    vm.mock_llm(r".*", '{"results": ["YES", "YES"]}')

    with vm.prank(attacker):
        try:
            escrow.submit_work(bid4, "https://github.com/owner/repo/pull/4", "8" * 40)
            assert False, "Must revert on wrong sha"
        except Exception as e:
            assert ("Head sha does not match the pull request head" in str(e) or
                    "Pull request is not bound to the submitting wallet" in str(e))

    with vm.prank(dev):
        v4 = escrow.submit_work(bid4, "https://github.com/owner/repo/pull/4", "7" * 40)
    assert v4 == "RELEASE_100"


def test_case5_sybil_exhaustion_defense(direct_env):
    """5. Sybil exhaustion (unbound PRs reject for free without consuming attempts)"""
    vm = direct_env["vm"]
    escrow = direct_env["escrow"]
    creator = direct_env["creator"]
    attacker = direct_env["attacker"]
    crit = direct_env["crit"]

    with vm.prank(creator):
        bid5 = escrow.create_bounty("Sybil Bounty", "owner/repo", crit, "[]", "50")

    meta_unbound = {
        "state": "open",
        "draft": False,
        "merged": False,
        "head": {"sha": "5" * 40, "repo": {"full_name": "owner/repo"}},
        "base": {"sha": "0" * 40, "repo": {"full_name": "owner/repo"}},
        "body": "No wallet marker in this PR",
        "user": {"login": "random"},
        "commits": 1,
    }
    vm.mock_web("https://api.github.com/repos/owner/repo/pulls/5", json.dumps(meta_unbound))

    with vm.prank(attacker):
        try:
            escrow.submit_work(bid5, "https://github.com/owner/repo/pull/5", "5" * 40)
            assert False, "Unbound PR must revert"
        except Exception as e:
            assert "Pull request is not bound to the submitting wallet" in str(e)

    b5 = json.loads(escrow.get_bounty(bid5))
    assert b5["attempts"] == "0", "Failed sybil attempt must NOT consume attempt counter"


def test_case6_copied_submission_defense(direct_env):
    """6. Copied submission (third-party submission rejected by wallet binding)"""
    vm = direct_env["vm"]
    escrow = direct_env["escrow"]
    creator = direct_env["creator"]
    attacker = direct_env["attacker"]
    dev_hex = direct_env["dev_hex"]
    crit = direct_env["crit"]

    with vm.prank(creator):
        bid6 = escrow.create_bounty("Copied Bounty", "owner/repo", crit, "[]", "50")

    meta_dev_only = {
        "state": "open",
        "draft": False,
        "merged": False,
        "head": {"sha": "6" * 40, "repo": {"full_name": "owner/repo"}},
        "base": {"sha": "0" * 40, "repo": {"full_name": "owner/repo"}},
        "body": f"ship-escrow-wallet: {dev_hex}",
        "user": {"login": "dev"},
        "commits": 1,
    }
    vm.mock_web("https://api.github.com/repos/owner/repo/pulls/6", json.dumps(meta_dev_only))

    with vm.prank(attacker):
        try:
            escrow.submit_work(bid6, "https://github.com/owner/repo/pull/6", "6" * 40)
            assert False, "Attacker cannot submit PR bound to dev"
        except Exception as e:
            assert "Pull request is not bound to the submitting wallet" in str(e)


def test_case7_legitimate_recovery_flow(direct_env):
    """7. Legitimate recovery (REVIEW followed by corrected head to RELEASE_100)"""
    vm = direct_env["vm"]
    escrow = direct_env["escrow"]
    creator = direct_env["creator"]
    dev = direct_env["dev"]
    dev_hex = direct_env["dev_hex"]
    crit = direct_env["crit"]

    with vm.prank(creator):
        bid7 = escrow.create_bounty("Recovery Bounty", "owner/repo", crit, "[]", "50")

    meta_rec1 = {
        "state": "open",
        "draft": False,
        "merged": False,
        "head": {"sha": "e1" + "0" * 38, "repo": {"full_name": "owner/repo"}},
        "base": {"sha": "0" * 40, "repo": {"full_name": "owner/repo"}},
        "body": f"ship-escrow-wallet: {dev_hex}",
        "user": {"login": "dev"},
        "commits": 1,
    }
    vm.mock_web("https://api.github.com/repos/owner/repo/pulls/7", json.dumps(meta_rec1))
    vm.mock_web(f"https://github.com/owner/repo/compare/{'0'*40}...{'e1'+'0'*38}.diff", "diff --git a/a.py b/a.py\n+partial\n")
    vm.mock_llm(r".*", '{"results": ["UNCLEAR", "YES"]}')

    with vm.prank(dev):
        v7_1 = escrow.submit_work(bid7, "https://github.com/owner/repo/pull/7", "e1" + "0" * 38)
    assert v7_1 == "REVIEW"

    meta_rec2 = dict(meta_rec1)
    meta_rec2["head"] = {"sha": "e2" + "0" * 38, "repo": {"full_name": "owner/repo"}}
    vm.mock_web("https://api.github.com/repos/owner/repo/pulls/7", json.dumps(meta_rec2))
    vm.mock_web(f"https://github.com/owner/repo/compare/{'0'*40}...{'e2'+'0'*38}.diff", "diff --git a/a.py b/a.py\n+complete\n")
    vm.mock_llm(r".*", '{"results": ["YES", "YES"]}')

    with vm.prank(dev):
        v7_2 = escrow.submit_work(bid7, "https://github.com/owner/repo/pull/7", "e2" + "0" * 38)
    assert v7_2 == "RELEASE_100"


def test_case8_diff_truncation_safety(direct_env):
    """8. Diff truncation safety (oversized diff > 14k strictly yields REVIEW)"""
    vm = direct_env["vm"]
    escrow = direct_env["escrow"]
    creator = direct_env["creator"]
    dev = direct_env["dev"]
    dev_hex = direct_env["dev_hex"]
    crit = direct_env["crit"]

    with vm.prank(creator):
        bid8 = escrow.create_bounty("Truncation Bounty", "owner/repo", crit, "[]", "50")

    meta_trunc = {
        "state": "open",
        "draft": False,
        "merged": False,
        "head": {"sha": "8" * 40, "repo": {"full_name": "owner/repo"}},
        "base": {"sha": "0" * 40, "repo": {"full_name": "owner/repo"}},
        "body": f"ship-escrow-wallet: {dev_hex}",
        "user": {"login": "dev"},
        "commits": 1,
    }
    vm.mock_web("https://api.github.com/repos/owner/repo/pulls/8", json.dumps(meta_trunc))
    vm.mock_web(
        f"https://github.com/owner/repo/compare/{'0'*40}...{'8'*40}.diff",
        "diff --git a/a.py b/a.py\n" + ("+ line of padding\n" * 900)
    )

    with vm.prank(dev):
        v8 = escrow.submit_work(bid8, "https://github.com/owner/repo/pull/8", "8" * 40)
    assert v8 == "REVIEW", "Truncated diff must strictly evaluate to REVIEW"


def test_case9_mixed_add_delete_non_test(direct_env):
    """9. Mixed add/delete (non-test file with 'test' in name does not fire false gate)"""
    vm = direct_env["vm"]
    escrow = direct_env["escrow"]
    creator = direct_env["creator"]
    dev = direct_env["dev"]
    dev_hex = direct_env["dev_hex"]
    crit = direct_env["crit"]

    with vm.prank(creator):
        bid9 = escrow.create_bounty("Non-test Deleted Bounty", "owner/repo", crit, "[]", "50")

    meta_del = {
        "state": "open",
        "draft": False,
        "merged": False,
        "head": {"sha": "9" * 40, "repo": {"full_name": "owner/repo"}},
        "base": {"sha": "0" * 40, "repo": {"full_name": "owner/repo"}},
        "body": f"ship-escrow-wallet: {dev_hex}",
        "user": {"login": "dev"},
        "commits": 1,
    }
    vm.mock_web("https://api.github.com/repos/owner/repo/pulls/9", json.dumps(meta_del))
    diff_del = (
        "diff --git a/contest_rules.md b/contest_rules.md\n"
        "deleted file mode 100644\n"
        "--- a/contest_rules.md\n"
        "+++ /dev/null\n"
        "-obsolete\n"
        "diff --git a/src/slug.py b/src/slug.py\n"
        "--- /dev/null\n"
        "+++ b/src/slug.py\n"
        "+code\n"
    )
    vm.mock_web(f"https://github.com/owner/repo/compare/{'0'*40}...{'9'*40}.diff", diff_del)
    vm.mock_llm(r".*", '{"results": ["YES", "YES"]}')

    with vm.prank(dev):
        v9 = escrow.submit_work(bid9, "https://github.com/owner/repo/pull/9", "9" * 40)
    assert v9 == "RELEASE_100", "Deleted non-test file must not fire test_deleted gate"


def test_case10_required_all_prefixes_gate(direct_env):
    """10. Required-all-prefixes (touching 1 of 2 required prefixes triggers REFUND)"""
    vm = direct_env["vm"]
    escrow = direct_env["escrow"]
    creator = direct_env["creator"]
    dev = direct_env["dev"]
    dev_hex = direct_env["dev_hex"]
    crit = direct_env["crit"]

    with vm.prank(creator):
        bid10 = escrow.create_bounty(
            "Required Paths Bounty", "owner/repo", crit, json.dumps(["src/", "docs/"]), "300"
        )

    meta_req = {
        "state": "open",
        "draft": False,
        "merged": False,
        "head": {"sha": "10" + "0" * 38, "repo": {"full_name": "owner/repo"}},
        "base": {"sha": "0" * 40, "repo": {"full_name": "owner/repo"}},
        "body": f"ship-escrow-wallet: {dev_hex}",
        "user": {"login": "dev"},
        "commits": 1,
    }
    vm.mock_web("https://api.github.com/repos/owner/repo/pulls/10", json.dumps(meta_req))
    vm.mock_web(
        f"https://github.com/owner/repo/compare/{'0'*40}...{'10'+'0'*38}.diff",
        "diff --git a/src/slug.py b/src/slug.py\n+code\n"
    )

    with vm.prank(dev):
        v10 = escrow.submit_work(bid10, "https://github.com/owner/repo/pull/10", "10" + "0" * 38)
    assert v10 == "REFUND", "Failing any required prefix must trigger REFUND"


def test_case11_cross_fork_rejection(direct_env):
    """11. Cross-fork rejection (head.repo differs from base.repo)"""
    vm = direct_env["vm"]
    escrow = direct_env["escrow"]
    creator = direct_env["creator"]
    dev = direct_env["dev"]
    dev_hex = direct_env["dev_hex"]
    crit = direct_env["crit"]

    with vm.prank(creator):
        bid11 = escrow.create_bounty("Fork Bounty", "owner/repo", crit, "[]", "100")

    meta_fork = {
        "state": "open",
        "draft": False,
        "merged": False,
        "head": {"sha": "11" + "0" * 38, "repo": {"full_name": "attacker/fork-repo"}},
        "base": {"sha": "0" * 40, "repo": {"full_name": "owner/repo"}},
        "body": f"ship-escrow-wallet: {dev_hex}",
        "user": {"login": "attacker"},
        "commits": 1,
    }
    vm.mock_web("https://api.github.com/repos/owner/repo/pulls/11", json.dumps(meta_fork))

    with vm.prank(dev):
        with pytest.raises(Exception, match="Pull request must be same-repository"):
            escrow.submit_work(bid11, "https://github.com/owner/repo/pull/11", "11" + "0" * 38)


def test_case12_rename_resilience_alias(direct_env):
    """12. Rename resilience (alias huzyow155 / hypercybers99 accepted interchangeably)"""
    vm = direct_env["vm"]
    escrow = direct_env["escrow"]
    creator = direct_env["creator"]
    dev = direct_env["dev"]
    dev_hex = direct_env["dev_hex"]
    crit = direct_env["crit"]

    with vm.prank(creator):
        bid12 = escrow.create_bounty("Alias Bounty", "hypercybers99/ship-escrow-fixtures", crit, "[]", "100")

    meta_alias = {
        "state": "open",
        "draft": False,
        "merged": False,
        "head": {"sha": "12" + "0" * 38, "repo": {"full_name": "hypercybers99/ship-escrow-fixtures"}},
        "base": {"sha": "0" * 40, "repo": {"full_name": "hypercybers99/ship-escrow-fixtures"}},
        "body": f"ship-escrow-wallet: {dev_hex}",
        "user": {"login": "dev"},
        "commits": 1,
    }
    vm.mock_web("https://api.github.com/repos/huzyow155/ship-escrow-fixtures/pulls/12", json.dumps(meta_alias))
    vm.mock_web(
        f"https://github.com/huzyow155/ship-escrow-fixtures/compare/{'0'*40}...{'12'+'0'*38}.diff",
        "diff --git a/src/slug.py b/src/slug.py\n+code\n"
    )
    vm.mock_llm(r".*", '{"results": ["YES", "YES"]}')

    with vm.prank(dev):
        v12 = escrow.submit_work(bid12, "https://github.com/huzyow155/ship-escrow-fixtures/pull/12", "12" + "0" * 38)
    assert v12 == "RELEASE_100", "Bounty with renamed owner accepts submission under alias URL"



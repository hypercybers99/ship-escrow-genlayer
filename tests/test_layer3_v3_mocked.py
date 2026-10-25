import unittest
import json
import hashlib
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from contracts.ShipEscrowV3_1 import ShipEscrowV3_1, canonical_json, gl
from contracts.ShipReputationV2 import ShipReputationV2


def recompute_packet_sha256(packet: dict) -> str:
    return hashlib.sha256(canonical_json(packet).encode("utf-8")).hexdigest()


class TestLayer3V3_1MockedContractPipelines(unittest.TestCase):
    """End-to-end pipeline unit tests for ShipEscrowV3_1 using mocked web responses."""

    def setUp(self):
        gl.reset()
        self.escrow = ShipEscrowV3_1()
        self.escrow_addr = "0x8DC94110Ed3E111Fb74Dce849CdBA8f567E6024F"
        gl.register_contract(self.escrow_addr, self.escrow)
        self.reputation = ShipReputationV2(self.escrow_addr)

        self.creator = "0x79ed3fc4e32d8df7b23a221a27a057170e6d2069"
        self.dev = "0x6325b360db455435bf5e81d0ae18dc3b249f226c"
        self.attacker = "0xd033dd543890c4eb2952b796037a11481497da9a"

        # Claim initial demo credits
        gl.set_sender(self.creator)
        self.escrow.claim_demo_credits()
        gl.set_sender(self.dev)
        self.escrow.claim_demo_credits()
        gl.set_sender(self.attacker)
        self.escrow.claim_demo_credits()

        self.crit = json.dumps([
            {"description": "Implement slugify in src/slug.py", "importance": "MUST"},
            {"description": "Add unit tests in tests/test_slug.py", "importance": "MUST"},
            {"description": "Update documentation in README.md", "importance": "SHOULD"}
        ])

    def _setup_mock_web(
        self,
        head_sha,
        branch_tips,
        wallet_addr,
        diff_text,
        is_multi=False,
        base_sha="05fedc3b516a90c1dd49f348db45c864a19d1148",
        is_open=True,
        merge_sha="0f3090c71c721fbd6d42546fb7392de8e63e2dc0"
    ):
        from genlayer import GlWebResponse

        branch_lines = "\n".join([f"{tip} refs/heads/branch_{i}" for i, tip in enumerate(branch_tips)])
        merge_line = f"{merge_sha} refs/pull/2/merge\n" if is_open else ""

        info_refs = (
            f"001e# service=git-upload-pack\n"
            f"00000159{base_sha} HEAD\x00multi_ack symref=HEAD:refs/heads/main\n"
            f"{base_sha} refs/heads/main\n"
            f"{branch_lines}\n"
            f"{head_sha} refs/pull/2/head\n"
            f"{merge_line}"
            f"0000"
        )

        if not is_multi:
            patch = (
                f"From {head_sha} Mon Sep 17 00:00:00 2001\n"
                f"From: Dev <dev@example.com>\n"
                f"Subject: [PATCH] feat: implement slugify\n\n"
                f"Adds implementation.\n\n"
                f"ship-escrow-wallet: {wallet_addr}\n---\n"
                f" src/slug.py | 10 ++++++++++\n"
                f" 1 file changed, 10 insertions(+)\n"
            )
        else:
            patch = (
                f"From 21c20625d3b919b2acce25f82339b7b54bdfba01 Mon Sep 17 00:00:00 2001\n"
                f"From: Dev <dev@example.com>\n"
                f"Subject: [PATCH 1/2] skeleton\n\nship-escrow-wallet: 0x0000000000000000000000000000000000000000\n---\n"
                f"From {head_sha} Mon Sep 17 00:00:00 2001\n"
                f"From: Dev <dev@example.com>\n"
                f"Subject: [PATCH 2/2] final\n\nship-escrow-wallet: {wallet_addr}\n---\n"
            )

        gl.nondet.web.pages["https://github.com/hypercybers99/ship-escrow-fixtures.git/info/refs?service=git-upload-pack"] = GlWebResponse(200, info_refs.encode("utf-8"))
        gl.nondet.web.pages["https://github.com/hypercybers99/ship-escrow-fixtures/pull/2.patch"] = GlWebResponse(200, patch.encode("utf-8"))
        gl.nondet.web.pages[f"https://github.com/hypercybers99/ship-escrow-fixtures/compare/{base_sha}...{head_sha}.diff"] = GlWebResponse(200, diff_text.encode("utf-8"))

    def test_pipeline_f1_full_release(self):
        head = "5db0441e76af93606fd82feebbe49c5a2f145326"
        diff = (
            "diff --git a/src/slug.py b/src/slug.py\n+def slugify(): pass\n"
            "diff --git a/tests/test_slug.py b/tests/test_slug.py\n+def test_s(): pass\n"
            "diff --git a/README.md b/README.md\n+# Docs\n"
        )
        self._setup_mock_web(head, [head], self.dev, diff)
        gl.nondet.prompt_handler = lambda p: '{"results": ["YES", "YES", "YES"]}'

        gl.set_sender(self.creator)
        bid = self.escrow.create_bounty("hypercybers99/ship-escrow-fixtures", 100, self.crit, '["src/slug.py"]')

        gl.set_sender(self.dev)
        sub_id = self.escrow.submit_work(bid, "https://github.com/hypercybers99/ship-escrow-fixtures/pull/2", head)

        sub = json.loads(self.escrow.get_submission(sub_id))
        self.assertEqual(sub["verdict"], "RELEASE_100")
        self.assertEqual(sub["payout_pct"], 100)
        self.assertEqual(sub["criterion_results"], ["YES", "YES", "YES"])

        # Name hygiene & metadata removal checks
        packet = sub["packet"]
        self.assertIn("head_commit_message_sha256", packet)
        self.assertNotIn("metadata", packet)
        self.assertNotIn("body_sha256", packet)

        # Check recomputed packet sha matches exactly
        self.assertEqual(recompute_packet_sha256(packet), sub["packet_sha256"])

        # Check bounty settled
        b = json.loads(self.escrow.get_bounty(bid))
        self.assertEqual(b["status"], "SETTLED")

    def test_pipeline_closed_pr_rejected(self):
        head = "5db0441e76af93606fd82feebbe49c5a2f145326"
        diff = "diff --git a/src/slug.py b/src/slug.py\n+def slugify(): pass\n"
        # is_open=False omits refs/pull/2/merge
        self._setup_mock_web(head, [head], self.dev, diff, is_open=False)

        gl.set_sender(self.creator)
        bid = self.escrow.create_bounty("hypercybers99/ship-escrow-fixtures", 100, self.crit, "")

        gl.set_sender(self.dev)
        with self.assertRaises(gl.vm.UserError) as cm:
            self.escrow.submit_work(bid, "https://github.com/hypercybers99/ship-escrow-fixtures/pull/2", head)
        self.assertEqual(str(cm.exception), "Pull request is not open")

    def test_pipeline_f2_missing_required_path_refund(self):
        head = "5db0441e76af93606fd82feebbe49c5a2f145326"
        diff = "diff --git a/other.py b/other.py\n+def foo(): pass\n"
        self._setup_mock_web(head, [head], self.dev, diff)
        gl.nondet.prompt_handler = lambda p: '{"results": ["YES", "YES", "YES"]}'

        gl.set_sender(self.creator)
        bid = self.escrow.create_bounty("hypercybers99/ship-escrow-fixtures", 100, self.crit, '["src/slug.py"]')

        gl.set_sender(self.dev)
        sub_id = self.escrow.submit_work(bid, "https://github.com/hypercybers99/ship-escrow-fixtures/pull/2", head)

        sub = json.loads(self.escrow.get_submission(sub_id))
        self.assertEqual(sub["verdict"], "REFUND")
        self.assertEqual(sub["gate"], "required_path_untouched")

        b = json.loads(self.escrow.get_bounty(bid))
        self.assertEqual(b["status"], "OPEN")
        self.assertEqual(b["attempts"], "1")

    def test_pipeline_f3_test_deleted_review(self):
        head = "5db0441e76af93606fd82feebbe49c5a2f145326"
        diff = (
            "diff --git a/tests/test_slug.py b/tests/test_slug.py\n"
            "deleted file mode 100644\n"
            "--- a/tests/test_slug.py\n"
            "+++ /dev/null\n"
            "-def test_old(): pass\n"
        )
        self._setup_mock_web(head, [head], self.dev, diff)

        gl.set_sender(self.creator)
        bid = self.escrow.create_bounty("hypercybers99/ship-escrow-fixtures", 100, self.crit, "")

        gl.set_sender(self.dev)
        sub_id = self.escrow.submit_work(bid, "https://github.com/hypercybers99/ship-escrow-fixtures/pull/2", head)

        sub = json.loads(self.escrow.get_submission(sub_id))
        self.assertEqual(sub["verdict"], "REVIEW")
        self.assertEqual(sub["gate"], "test_deleted")

        b = json.loads(self.escrow.get_bounty(bid))
        self.assertEqual(b["status"], "OPEN")

    def test_pipeline_fork_rejection(self):
        head = "5db0441e76af93606fd82feebbe49c5a2f145326"
        diff = "diff --git a/src/slug.py b/src/slug.py\n+def slugify(): pass\n"
        self._setup_mock_web(head, ["1111111111111111111111111111111111111111"], self.dev, diff)

        gl.set_sender(self.creator)
        bid = self.escrow.create_bounty("hypercybers99/ship-escrow-fixtures", 100, self.crit, "")

        gl.set_sender(self.dev)
        with self.assertRaises(gl.vm.UserError) as cm:
            self.escrow.submit_work(bid, "https://github.com/hypercybers99/ship-escrow-fixtures/pull/2", head)
        self.assertEqual(str(cm.exception), "Pull request must be same-repository")

    def test_pipeline_wrong_wallet_trailer_rejection(self):
        head = "5db0441e76af93606fd82feebbe49c5a2f145326"
        diff = "diff --git a/src/slug.py b/src/slug.py\n+def slugify(): pass\n"
        self._setup_mock_web(head, [head], self.attacker, diff)

        gl.set_sender(self.creator)
        bid = self.escrow.create_bounty("hypercybers99/ship-escrow-fixtures", 100, self.crit, "")

        gl.set_sender(self.dev)
        with self.assertRaises(gl.vm.UserError) as cm:
            self.escrow.submit_work(bid, "https://github.com/hypercybers99/ship-escrow-fixtures/pull/2", head)
        self.assertEqual(str(cm.exception), "Pull request is not bound to the submitting wallet")

    def test_pipeline_duplicate_submission_guard(self):
        head = "5db0441e76af93606fd82feebbe49c5a2f145326"
        diff = "diff --git a/other.py b/other.py\n+def foo(): pass\n"
        self._setup_mock_web(head, [head], self.dev, diff)

        gl.set_sender(self.creator)
        bid = self.escrow.create_bounty("hypercybers99/ship-escrow-fixtures", 100, self.crit, '["src/slug.py"]')

        gl.set_sender(self.dev)
        self.escrow.submit_work(bid, "https://github.com/hypercybers99/ship-escrow-fixtures/pull/2", head)

        with self.assertRaises(gl.vm.UserError) as cm:
            self.escrow.submit_work(bid, "https://github.com/hypercybers99/ship-escrow-fixtures/pull/2", head)
        self.assertIn("Duplicate submission for head sha", str(cm.exception))


if __name__ == "__main__":
    unittest.main()

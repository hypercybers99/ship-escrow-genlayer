import unittest
import json
import hashlib
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from contracts.ShipEscrowV3 import ShipEscrowV3, canonical_json, gl
from contracts.ShipReputationV2 import ShipReputationV2


def recompute_packet_sha256(packet: dict) -> str:
    return hashlib.sha256(canonical_json(packet).encode("utf-8")).hexdigest()


class TestLayer3V3MockedContractPipelines(unittest.TestCase):
    """End-to-end pipeline unit tests for ShipEscrowV3 using mocked web responses."""

    def setUp(self):
        gl.reset()
        self.escrow = ShipEscrowV3()
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

    def _setup_mock_web(self, head_sha, branch_tips, wallet_addr, diff_text, is_multi=False, base_sha="05fedc3b516a90c1dd49f348db45c864a19d1148"):
        from tests.genlayer import GlWebResponse

        branch_lines = "\n".join([f"{tip} refs/heads/branch_{i}" for i, tip in enumerate(branch_tips)])
        info_refs = (
            f"001e# service=git-upload-pack\n"
            f"00000159{base_sha} HEAD\x00multi_ack symref=HEAD:refs/heads/main\n"
            f"{base_sha} refs/heads/main\n"
            f"{branch_lines}\n"
            f"{head_sha} refs/pull/2/head\n"
            f"0000"
        )

        if is_multi:
            patch = (
                f"From 1111111111111111111111111111111111111111 Mon Sep 17 00:00:00 2001\n"
                f"Subject: [PATCH 1/2] skeleton\n"
                f"ship-escrow-wallet: 0x0000000000000000000000000000000000000000\n---\n\n"
                f"From {head_sha} Mon Sep 17 00:00:00 2001\n"
                f"Subject: [PATCH 2/2] final\n"
                f"ship-escrow-wallet: {wallet_addr}\n---\n"
            )
        else:
            patch = (
                f"From {head_sha} Mon Sep 17 00:00:00 2001\n"
                f"Subject: [PATCH] implementation\n"
                f"ship-escrow-wallet: {wallet_addr}\n---\n"
            )

        def mock_handler(url):
            if "info/refs" in url:
                return GlWebResponse(status=200, body=info_refs.encode("utf-8"))
            elif ".patch" in url:
                return GlWebResponse(status=200, body=patch.encode("utf-8"))
            elif "compare/" in url:
                return GlWebResponse(status=200, body=diff_text.encode("utf-8"))
            return GlWebResponse(status=404, body=b"Not found")

        gl.nondet.web.get_handler = mock_handler

    def test_pipeline_f1_full_release(self):
        head = "5db0441e76af93606fd82feebbe49c5a2f145326"
        diff = (
            "diff --git a/src/slug.py b/src/slug.py\n+def slugify(t): return t.lower()\n"
            "diff --git a/tests/test_slug.py b/tests/test_slug.py\n+def test_s(): pass\n"
            "diff --git a/README.md b/README.md\n+# Docs\n"
        )
        self._setup_mock_web(head, [head], self.dev, diff)
        gl.nondet.prompt_handler = lambda p: json.dumps({"results": ["YES", "YES", "YES"]})

        gl.set_sender(self.creator)
        b_id = self.escrow.create_bounty("hypercybers99/ship-escrow-fixtures", 100, self.crit)

        gl.set_sender(self.dev)
        sub_id = self.escrow.submit_work(b_id, "https://github.com/hypercybers99/ship-escrow-fixtures/pull/2", head)

        bounty = json.loads(self.escrow.get_bounty(b_id))
        self.assertEqual(bounty["status"], "SETTLED")

        sub = json.loads(self.escrow.get_submission(sub_id))
        self.assertEqual(sub["verdict"], "RELEASE_100")
        self.assertEqual(sub["payout_pct"], 100)
        self.assertEqual(sub["criterion_results"], ["YES", "YES", "YES"])

        # Packet sha256 check
        self.assertEqual(sub["packet_sha256"], recompute_packet_sha256(sub["packet"]))

        # Dev balance: initially 1000, 100 bounty payout = 1100 (bond refunded)
        self.assertEqual(self.escrow.get_balance(self.dev), "1100")
        self.assertTrue(self.escrow.is_settled_for(b_id, bounty["criteria_hash"], head, self.dev, 25))

    def test_pipeline_f2_missing_required_path_refund(self):
        head = "3de6b568ca38717a2d6a62a14aa581c0bcc4e28b"
        diff = "diff --git a/README.md b/README.md\n+# Just readme\n"
        self._setup_mock_web(head, [head], self.dev, diff)

        gl.set_sender(self.creator)
        req_paths = json.dumps(["src/", "tests/"])
        b_id = self.escrow.create_bounty("hypercybers99/ship-escrow-fixtures", 100, self.crit, req_paths)

        gl.set_sender(self.dev)
        sub_id = self.escrow.submit_work(b_id, "https://github.com/hypercybers99/ship-escrow-fixtures/pull/2", head)

        bounty = json.loads(self.escrow.get_bounty(b_id))
        self.assertEqual(bounty["status"], "OPEN")
        self.assertEqual(bounty["attempts"], "1")

        sub = json.loads(self.escrow.get_submission(sub_id))
        self.assertEqual(sub["verdict"], "REFUND")
        self.assertEqual(sub["gate"], "required_path_untouched")

        # Bond forfeited to creator: dev balance was 1000 - 50 bond = 950
        self.assertEqual(self.escrow.get_balance(self.dev), "950")
        # Creator received 50 forfeited bond (bounty reward remains in escrow): was (1000-100)=900 + 50 = 950
        self.assertEqual(self.escrow.get_balance(self.creator), "950")

    def test_pipeline_f3_test_deleted_review(self):
        head = "aa9a2af9ccb0fa6d13b030a8f176c5235d15a982"
        diff = (
            "diff --git a/src/slug.py b/src/slug.py\n+def slugify(t): pass\n"
            "diff --git a/tests/test_old.py b/tests/test_old.py\ndeleted file mode 100644\n--- a/tests/test_old.py\n"
        )
        self._setup_mock_web(head, [head], self.dev, diff)

        gl.set_sender(self.creator)
        b_id = self.escrow.create_bounty("hypercybers99/ship-escrow-fixtures", 100, self.crit)

        gl.set_sender(self.dev)
        sub_id = self.escrow.submit_work(b_id, "https://github.com/hypercybers99/ship-escrow-fixtures/pull/2", head)

        bounty = json.loads(self.escrow.get_bounty(b_id))
        self.assertEqual(bounty["status"], "OPEN")
        self.assertEqual(bounty["attempts"], "1")

        sub = json.loads(self.escrow.get_submission(sub_id))
        self.assertEqual(sub["verdict"], "REVIEW")
        self.assertEqual(sub["gate"], "test_deleted")

        # REVIEW returns bond to dev
        self.assertEqual(self.escrow.get_balance(self.dev), "1000")

    def test_pipeline_fork_rejection(self):
        head = "5db0441e76af93606fd82feebbe49c5a2f145326"
        fork_head = "ffffffffffffffffffffffffffffffffffffffff"
        diff = "diff --git a/src/slug.py b/src/slug.py\n+def slugify(t): pass\n"
        # branch_tips has head, but PR submitted is fork_head which is NOT in branch_tips
        self._setup_mock_web(fork_head, [head], self.dev, diff)

        gl.set_sender(self.creator)
        b_id = self.escrow.create_bounty("hypercybers99/ship-escrow-fixtures", 100, self.crit)

        gl.set_sender(self.dev)
        with self.assertRaises(gl.vm.UserError) as cm:
            self.escrow.submit_work(b_id, "https://github.com/hypercybers99/ship-escrow-fixtures/pull/2", fork_head)
        self.assertEqual(str(cm.exception), "Pull request must be same-repository")

    def test_pipeline_wrong_wallet_trailer_rejection(self):
        head = "5db0441e76af93606fd82feebbe49c5a2f145326"
        diff = "diff --git a/src/slug.py b/src/slug.py\n+def slugify(t): pass\n"
        # Trailer binds to attacker, but dev calls submit_work
        self._setup_mock_web(head, [head], self.attacker, diff)

        gl.set_sender(self.creator)
        b_id = self.escrow.create_bounty("hypercybers99/ship-escrow-fixtures", 100, self.crit)

        gl.set_sender(self.dev)
        with self.assertRaises(gl.vm.UserError) as cm:
            self.escrow.submit_work(b_id, "https://github.com/hypercybers99/ship-escrow-fixtures/pull/2", head)
        self.assertEqual(str(cm.exception), "Pull request is not bound to the submitting wallet")

    def test_pipeline_duplicate_submission_guard(self):
        head = "5db0441e76af93606fd82feebbe49c5a2f145326"
        diff = (
            "diff --git a/src/slug.py b/src/slug.py\n+def slugify(t): pass\n"
            "diff --git a/tests/test_old.py b/tests/test_old.py\ndeleted file mode 100644\n--- a/tests/test_old.py\n"
        )
        self._setup_mock_web(head, [head], self.dev, diff)

        gl.set_sender(self.creator)
        b_id = self.escrow.create_bounty("hypercybers99/ship-escrow-fixtures", 100, self.crit)

        gl.set_sender(self.dev)
        self.escrow.submit_work(b_id, "https://github.com/hypercybers99/ship-escrow-fixtures/pull/2", head)

        # Submit same head again
        with self.assertRaises(gl.vm.UserError) as cm:
            self.escrow.submit_work(b_id, "https://github.com/hypercybers99/ship-escrow-fixtures/pull/2", head)
        self.assertIn("Duplicate submission for head sha", str(cm.exception))


if __name__ == '__main__':
    unittest.main()

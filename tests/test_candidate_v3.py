import unittest
import json
import hashlib
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from contracts.candidates.ShipEscrowV3_labels_bound_not_adopted import (
    ShipEscrowV3 as CandidateShipEscrowV3,
    canonical_json,
    gl,
)
from contracts.ShipReputationV2 import ShipReputationV2


class TestCandidateV3ContractPipelines(unittest.TestCase):
    """Test suite targeting the V3 candidate contract (ShipEscrowV3_labels_bound_not_adopted.py)."""

    def setUp(self):
        gl.reset()
        self.escrow = CandidateShipEscrowV3()
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
            {"description": "Add unit tests in tests/test_slug.py", "importance": "MUST"}
        ])

    def _setup_mock_web(self, head_sha, branch_tips, wallet_addr, diff_text, is_multi=False, base_sha="05fedc3b516a90c1dd49f348db45c864a19d1148"):
        from genlayer import GlWebResponse

        branch_lines = "\n".join([f"{tip} refs/heads/branch_{i}" for i, tip in enumerate(branch_tips)])
        info_refs = (
            f"001e# service=git-upload-pack\n"
            f"00000159{base_sha} HEAD\x00multi_ack symref=HEAD:refs/heads/main\n"
            f"{base_sha} refs/heads/main\n"
            f"{branch_lines}\n"
            f"{head_sha} refs/pull/2/head\n"
            f"0000"
        )

        patch = (
            f"From {head_sha} Mon Sep 17 00:00:00 2001\n"
            f"Subject: [PATCH] feat: implement slugify\n\n"
            f"ship-escrow-wallet: {wallet_addr}\n---\n"
        )

        gl.nondet.web.pages["https://github.com/hypercybers99/ship-escrow-fixtures.git/info/refs?service=git-upload-pack"] = GlWebResponse(200, info_refs.encode("utf-8"))
        gl.nondet.web.pages["https://github.com/hypercybers99/ship-escrow-fixtures/pull/2.patch"] = GlWebResponse(200, patch.encode("utf-8"))
        gl.nondet.web.pages[f"https://github.com/hypercybers99/ship-escrow-fixtures/compare/{base_sha}...{head_sha}.diff"] = GlWebResponse(200, diff_text.encode("utf-8"))

    def test_candidate_v3_clean_release(self):
        head = "5db0441e76af93606fd82feebbe49c5a2f145326"
        diff = "diff --git a/src/slug.py b/src/slug.py\n+def slugify(t): return t.lower()\n"
        self._setup_mock_web(head, [head], self.dev, diff)
        gl.nondet.prompt_handler = lambda p: '{"results": ["YES", "YES"]}'

        gl.set_sender(self.creator)
        bid = self.escrow.create_bounty("hypercybers99/ship-escrow-fixtures", 100, self.crit, "")

        gl.set_sender(self.dev)
        sub_id = self.escrow.submit_work(bid, "https://github.com/hypercybers99/ship-escrow-fixtures/pull/2", head)

        sub = json.loads(self.escrow.get_submission(sub_id))
        self.assertEqual(sub["verdict"], "RELEASE_100")
        self.assertEqual(sub["payout_pct"], 100)
        self.assertEqual(sub["criterion_results"], ["YES", "YES"])


if __name__ == "__main__":
    unittest.main()

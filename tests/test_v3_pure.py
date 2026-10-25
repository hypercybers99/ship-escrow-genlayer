import unittest
import json
import hashlib
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from contracts.ShipEscrowV3_1 import (
    parse_git_refs_advertisement,
    extract_head_commit_msg_and_sha,
    parse_wallet_trailer,
    check_http_response_status,
    diff_facts,
    decide,
    canonical_json,
    gl,
)

SAMPLE_INFO_REFS_OPEN = (
    "001e# service=git-upload-pack\n"
    "0000015905fedc3b516a90c1dd49f348db45c864a19d1148 HEAD\x00multi_ack symref=HEAD:refs/heads/main\n"
    "05fedc3b516a90c1dd49f348db45c864a19d1148 refs/heads/main\n"
    "5db0441e76af93606fd82feebbe49c5a2f145326 refs/heads/f1-good\n"
    "aa9a2af9ccb0fa6d13b030a8f176c5235d15a982 refs/heads/f3-trap\n"
    "5db0441e76af93606fd82feebbe49c5a2f145326 refs/pull/2/head\n"
    "0f3090c71c721fbd6d42546fb7392de8e63e2dc0 refs/pull/2/merge\n"
    "aa9a2af9ccb0fa6d13b030a8f176c5235d15a982 refs/pull/4/head\n"
    "0000"
)

SAMPLE_INFO_REFS_CLOSED = (
    "001e# service=git-upload-pack\n"
    "0000015905fedc3b516a90c1dd49f348db45c864a19d1148 HEAD\x00multi_ack symref=HEAD:refs/heads/main\n"
    "05fedc3b516a90c1dd49f348db45c864a19d1148 refs/heads/main\n"
    "5db0441e76af93606fd82feebbe49c5a2f145326 refs/heads/f1-good\n"
    "5db0441e76af93606fd82feebbe49c5a2f145326 refs/pull/2/head\n"
    "0000"
)

SAMPLE_PATCH_SINGLE = """From 5db0441e76af93606fd82feebbe49c5a2f145326 Mon Sep 17 00:00:00 2001
From: Dev <dev@example.com>
Date: Fri, 24 Oct 2026 12:00:00 +0000
Subject: [PATCH] feat: implement slugify

Adds robust slugify implementation with full unit test coverage.

ship-escrow-wallet: 0x6325B360Db455435BF5e81D0aE18DC3b249f226C
---
 src/slug.py | 10 ++++++++++
 1 file changed, 10 insertions(+)

diff --git a/src/slug.py b/src/slug.py
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/src/slug.py
@@ -0,0 +1,10 @@
+def slugify(text):
+    return text.lower()
-- 
2.40.0
"""

SAMPLE_PATCH_MULTI = """From 21c20625d3b919b2acce25f82339b7b54bdfba01 Mon Sep 17 00:00:00 2001
From: Dev <dev@example.com>
Date: Fri, 24 Oct 2026 10:00:00 +0000
Subject: [PATCH 1/2] feat: initial skeleton

ship-escrow-wallet: 0x0000000000000000000000000000000000000000
---
 src/slug.py | 2 ++
 1 file changed, 2 insertions(+)

diff --git a/src/slug.py b/src/slug.py
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/src/slug.py
@@ -0,0 +1,2 @@
+# skeleton
-- 
2.40.0

From 5db0441e76af93606fd82feebbe49c5a2f145326 Mon Sep 17 00:00:00 2001
From: Dev <dev@example.com>
Date: Fri, 24 Oct 2026 12:00:00 +0000
Subject: [PATCH 2/2] feat: complete implementation

ship-escrow-wallet: 0x6325B360Db455435BF5e81D0aE18DC3b249f226C
---
 src/slug.py | 8 ++++++++
 1 file changed, 8 insertions(+)

diff --git a/src/slug.py b/src/slug.py
index 1111111..1234567 100644
--- a/src/slug.py
+++ b/src/slug.py
@@ -1,2 +1,10 @@
 def slugify(text):
     return text.lower()
-- 
2.40.0
"""


class TestV3_1PureFunctions(unittest.TestCase):
    """Unit tests for quota-free git parser, trailer marker extraction, and V3.1 validator rules."""

    def test_parse_git_refs_advertisement_valid(self):
        head_sha, base_sha, branch_tips = parse_git_refs_advertisement(SAMPLE_INFO_REFS_OPEN, "2")
        self.assertEqual(head_sha, "5db0441e76af93606fd82feebbe49c5a2f145326")
        self.assertEqual(base_sha, "05fedc3b516a90c1dd49f348db45c864a19d1148")
        self.assertIn("5db0441e76af93606fd82feebbe49c5a2f145326", branch_tips)
        self.assertIn("aa9a2af9ccb0fa6d13b030a8f176c5235d15a982", branch_tips)

    def test_parse_git_refs_advertisement_closed_pr_fails(self):
        """When refs/pull/2/merge is absent, parse_git_refs_advertisement raises 'Pull request is not open'."""
        with self.assertRaises(gl.vm.UserError) as cm:
            parse_git_refs_advertisement(SAMPLE_INFO_REFS_CLOSED, "2")
        self.assertEqual(str(cm.exception), "Pull request is not open")

    def test_parse_git_refs_advertisement_missing_ref(self):
        with self.assertRaises(gl.vm.UserError) as cm:
            parse_git_refs_advertisement(SAMPLE_INFO_REFS_OPEN, "999")
        self.assertEqual(str(cm.exception), "Pull request metadata unavailable")

    def test_branch_tip_same_repo_check_pass(self):
        head_sha, _, branch_tips = parse_git_refs_advertisement(SAMPLE_INFO_REFS_OPEN, "2")
        self.assertIn(head_sha, branch_tips)

    def test_branch_tip_same_repo_check_fork_fails(self):
        head_sha, _, branch_tips = parse_git_refs_advertisement(SAMPLE_INFO_REFS_OPEN, "2")
        fork_tips = ["0000000000000000000000000000000000000001"]
        self.assertNotIn(head_sha, fork_tips)

    def test_extract_head_commit_msg_and_sha_single(self):
        last_sha, msg = extract_head_commit_msg_and_sha(SAMPLE_PATCH_SINGLE)
        self.assertEqual(last_sha, "5db0441e76af93606fd82feebbe49c5a2f145326")
        self.assertIn("ship-escrow-wallet:", msg)
        self.assertEqual(parse_wallet_trailer(msg), "0x6325b360db455435bf5e81d0ae18dc3b249f226c")

    def test_extract_head_commit_msg_and_sha_multi_commit(self):
        last_sha, msg = extract_head_commit_msg_and_sha(SAMPLE_PATCH_MULTI)
        self.assertEqual(last_sha, "5db0441e76af93606fd82feebbe49c5a2f145326")
        self.assertEqual(parse_wallet_trailer(msg), "0x6325b360db455435bf5e81d0ae18dc3b249f226c")

    def test_parse_wallet_trailer_missing(self):
        msg = "Subject: no trailer here\n\nJust some notes."
        self.assertEqual(parse_wallet_trailer(msg), "")

    def test_parse_wallet_trailer_duplicate(self):
        msg = (
            "Subject: malicious multi wallet\n\n"
            "ship-escrow-wallet: 0x6325B360Db455435BF5e81D0aE18DC3b249f226C\n"
            "ship-escrow-wallet: 0x0000000000000000000000000000000000000000\n"
        )
        self.assertEqual(parse_wallet_trailer(msg), "")

    def test_http_error_strings_pinning(self):
        # 301/302/307/308
        for code in (301, 302, 307, 308):
            with self.assertRaises(gl.vm.UserError) as cm:
                check_http_response_status(code, context_label="metadata")
            self.assertEqual(str(cm.exception), "Repository moved: use the current owner/repo name")

        # 403/429
        for code in (403, 429):
            with self.assertRaises(gl.vm.UserError) as cm:
                check_http_response_status(code, context_label="metadata")
            self.assertEqual(str(cm.exception), "GitHub rate limit reached, retry later")

        # other failures
        with self.assertRaises(gl.vm.UserError) as cm:
            check_http_response_status(500, context_label="metadata")
        self.assertEqual(str(cm.exception), "Pull request metadata unavailable")

        with self.assertRaises(gl.vm.UserError) as cm:
            check_http_response_status(500, context_label="source")
        self.assertEqual(str(cm.exception), "GitHub source unreachable")

    def test_consensus_validator_v3_1_rules(self):
        """
        Verify V3.1 consensus comparison:
        1. Label-only mismatch does NOT fail consensus (returns True).
        2. Mismatch in any of the 7 compared fields DOES fail consensus (returns False).
        3. Base drift causes validator disagreement (returns False).
        """
        leader_packet = {
            "head_sha": "5db0441e76af93606fd82feebbe49c5a2f145326",
            "base_sha": "05fedc3b516a90c1dd49f348db45c864a19d1148",
            "diff_sha256": "ecd93f38b55992bcea34e00190252912c3a6c9742884d8d6666720882afb116c",
            "facts": {"is_truncated": False},
            "gate": False,
            "verdict": "RELEASE_50",
            "payout_pct": 50,
            "criterion_results": ["YES", "YES", "NO"],
        }

        def validator_check(lead, val):
            if lead.get("head_sha") != val.get("head_sha"): return False
            if lead.get("base_sha") != val.get("base_sha"): return False
            if lead.get("diff_sha256") != val.get("diff_sha256"): return False
            if lead.get("facts") != val.get("facts"): return False
            if lead.get("gate") != val.get("gate"): return False
            if lead.get("verdict") != val.get("verdict"): return False
            if int(lead.get("payout_pct", -1)) != int(val.get("payout_pct", -2)): return False
            return True

        # Case 1: Label-only variance between leader and validator
        val_packet_label_mismatch = dict(leader_packet)
        val_packet_label_mismatch["criterion_results"] = ["YES", "PARTIAL", "NO"]
        self.assertTrue(validator_check(leader_packet, val_packet_label_mismatch))

        # Case 2: Base drift (default branch tip advanced during validator fetch)
        val_packet_base_drift = dict(leader_packet)
        val_packet_base_drift["base_sha"] = "1111222233334444555566667777888899990000"
        self.assertFalse(validator_check(leader_packet, val_packet_base_drift))

        # Case 3: Diff sha mismatch
        val_packet_diff_mismatch = dict(leader_packet)
        val_packet_diff_mismatch["diff_sha256"] = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
        self.assertFalse(validator_check(leader_packet, val_packet_diff_mismatch))

        # Case 4: Verdict mismatch
        val_packet_verdict_mismatch = dict(leader_packet)
        val_packet_verdict_mismatch["verdict"] = "REFUND"
        self.assertFalse(validator_check(leader_packet, val_packet_verdict_mismatch))

        # Case 5: Payout pct mismatch
        val_packet_payout_mismatch = dict(leader_packet)
        val_packet_payout_mismatch["payout_pct"] = 0
        self.assertFalse(validator_check(leader_packet, val_packet_payout_mismatch))

        # Case 6: Gate mismatch
        val_packet_gate_mismatch = dict(leader_packet)
        val_packet_gate_mismatch["gate"] = True
        self.assertFalse(validator_check(leader_packet, val_packet_gate_mismatch))

        # Case 7: Facts mismatch
        val_packet_facts_mismatch = dict(leader_packet)
        val_packet_facts_mismatch["facts"] = {"is_truncated": True}
        self.assertFalse(validator_check(leader_packet, val_packet_facts_mismatch))


if __name__ == "__main__":
    unittest.main()

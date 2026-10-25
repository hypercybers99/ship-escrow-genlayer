import unittest
import json
import hashlib
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from contracts.ShipEscrowV3 import (
    parse_git_refs_advertisement,
    extract_head_commit_msg_and_sha,
    parse_wallet_trailer,
    check_http_response_status,
    diff_facts,
    decide,
    canonical_json,
    gl,
)

SAMPLE_INFO_REFS = (
    "001e# service=git-upload-pack\n"
    "0000015905fedc3b516a90c1dd49f348db45c864a19d1148 HEAD\x00multi_ack symref=HEAD:refs/heads/main\n"
    "05fedc3b516a90c1dd49f348db45c864a19d1148 refs/heads/main\n"
    "5db0441e76af93606fd82feebbe49c5a2f145326 refs/heads/f1-good\n"
    "aa9a2af9ccb0fa6d13b030a8f176c5235d15a982 refs/heads/f3-trap\n"
    "5db0441e76af93606fd82feebbe49c5a2f145326 refs/pull/2/head\n"
    "aa9a2af9ccb0fa6d13b030a8f176c5235d15a982 refs/pull/4/head\n"
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

From 960fbf1ac0e73a099f4251512b5c2d569252ac39 Mon Sep 17 00:00:00 2001
From: Dev <dev@example.com>
Date: Fri, 24 Oct 2026 11:00:00 +0000
Subject: [PATCH 2/2] feat: complete robust implementation

ship-escrow-wallet: 0x6325B360Db455435BF5e81D0aE18DC3b249f226C
---
 src/slug.py | 8 ++++++++
 1 file changed, 8 insertions(+)

diff --git a/src/slug.py b/src/slug.py
index 1111111..2222222 100644
--- a/src/slug.py
+++ b/src/slug.py
@@ -1,2 +1,10 @@
+def slugify(text):
+    return text.strip().lower()
-- 
2.40.0
"""


class TestShipEscrowV3Pure(unittest.TestCase):
    """Unit tests for pure helper functions in ShipEscrowV3."""

    def test_parse_git_refs_advertisement_valid(self):
        auth_head, base_sha, branches = parse_git_refs_advertisement(SAMPLE_INFO_REFS, "2")
        self.assertEqual(auth_head, "5db0441e76af93606fd82feebbe49c5a2f145326")
        self.assertEqual(base_sha, "05fedc3b516a90c1dd49f348db45c864a19d1148")
        self.assertIn("5db0441e76af93606fd82feebbe49c5a2f145326", branches)
        self.assertIn("05fedc3b516a90c1dd49f348db45c864a19d1148", branches)

    def test_parse_git_refs_advertisement_missing_ref(self):
        with self.assertRaises(gl.vm.UserError) as cm:
            parse_git_refs_advertisement(SAMPLE_INFO_REFS, "99")
        self.assertEqual(str(cm.exception), "Pull request metadata unavailable")

    def test_branch_tip_same_repo_check_pass(self):
        auth_head, base_sha, branches = parse_git_refs_advertisement(SAMPLE_INFO_REFS, "2")
        is_same_repo = (auth_head in branches)
        self.assertTrue(is_same_repo)

    def test_branch_tip_same_repo_check_fork_fails(self):
        # A fork commit is not a branch tip in the base repo
        fork_sha = "ffffffffffffffffffffffffffffffffffffffff"
        _, _, branches = parse_git_refs_advertisement(SAMPLE_INFO_REFS, "2")
        self.assertNotIn(fork_sha, branches)

    def test_extract_head_commit_msg_and_sha_single(self):
        last_sha, msg = extract_head_commit_msg_and_sha(SAMPLE_PATCH_SINGLE)
        self.assertEqual(last_sha, "5db0441e76af93606fd82feebbe49c5a2f145326")
        self.assertIn("ship-escrow-wallet:", msg)
        self.assertNotIn("diff --git", msg)

    def test_extract_head_commit_msg_and_sha_multi_commit(self):
        last_sha, msg = extract_head_commit_msg_and_sha(SAMPLE_PATCH_MULTI)
        self.assertEqual(last_sha, "960fbf1ac0e73a099f4251512b5c2d569252ac39")
        # Ensure it reads the trailer from the HEAD commit, not the earlier skeleton commit
        wallet = parse_wallet_trailer(msg)
        self.assertEqual(wallet, "0x6325b360db455435bf5e81d0ae18dc3b249f226c")

    def test_parse_wallet_trailer_missing(self):
        msg = "Subject: fix typo\n\nNo wallet specified here."
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

    def test_consensus_validator_label_mismatch_fails(self):
        """Verify that any mismatch in criterion_results causes validator disagreement."""
        leader_packet = {
            "head_sha": "5db0441e76af93606fd82feebbe49c5a2f145326",
            "base_sha": "05fedc3b516a90c1dd49f348db45c864a19d1148",
            "diff_sha256": "ecd93f38b55992bcea34e00190252912c3a6c9742884d8d6666720882afb116c",
            "facts": {"is_truncated": False},
            "gate": "",
            "verdict": "RELEASE_100",
            "payout_pct": 100,
            "criterion_results": ["YES", "YES", "YES"],
        }

        # Validator with different label vector
        val_packet = dict(leader_packet)
        val_packet["criterion_results"] = ["YES", "PARTIAL", "YES"]

        def check_val(l, v):
            if l.get("head_sha") != v.get("head_sha"): return False
            if l.get("base_sha") != v.get("base_sha"): return False
            if l.get("diff_sha256") != v.get("diff_sha256"): return False
            if l.get("facts") != v.get("facts"): return False
            if l.get("gate") != v.get("gate"): return False
            if l.get("verdict") != v.get("verdict"): return False
            if int(l.get("payout_pct", -1)) != int(v.get("payout_pct", -2)): return False
            if l.get("criterion_results") != v.get("criterion_results"): return False
            return True

        self.assertFalse(check_val(leader_packet, val_packet))
        # Matching returns True
        self.assertTrue(check_val(leader_packet, leader_packet))


if __name__ == '__main__':
    unittest.main()

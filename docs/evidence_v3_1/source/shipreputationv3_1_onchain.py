# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from genlayer import *


def canonical_json(obj) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"))


class ShipReputationV2(gl.Contract):
    __gl_contract__ = True
    escrow_address: Address
    processed: TreeMap[str, str]
    dev_scores: TreeMap[str, str]
    creator_scores: TreeMap[str, str]
    meta: TreeMap[str, str]

    def __init__(self, escrow_address_str: str):
        # Do not assign TreeMap() in __init__
        self.escrow_address = Address(escrow_address_str)

    @gl.public.view
    def get_escrow_address(self) -> str:
        return self.escrow_address.as_hex

    @gl.public.view
    def get_dev_score(self, addr: str) -> str:
        addr_lower = addr.lower()
        if addr_lower in self.dev_scores:
            return self.dev_scores[addr_lower]
        return canonical_json({
            "best_verdict_counts": {},
            "schema_version": "2",
            "settled_count": 0,
            "units_earned": "0",
        })

    @gl.public.view
    def get_creator_score(self, addr: str) -> str:
        addr_lower = addr.lower()
        if addr_lower in self.creator_scores:
            return self.creator_scores[addr_lower]
        return canonical_json({
            "bounties_settled": 0,
            "schema_version": "2",
            "units_paid": "0",
            "units_refunded": "0",
        })

    @gl.public.view
    def list_recent(self, limit: int = 10) -> list[str]:
        lim = min(max(1, limit), 20)
        recent_json = self.meta.get("recent_synced", "[]")
        try:
            items = json.loads(recent_json)
        except Exception:
            items = []
        return items[:lim]

    @gl.public.write
    def sync(self, bounty_id: str, min_payout_pct: int = 25) -> None:
        bid = str(bounty_id).strip()
        if not bid:
            raise gl.vm.UserError("Bounty id cannot be empty")

        if bid in self.processed:
            raise gl.vm.UserError("Bounty settlement already processed")

        escrow = gl.get_contract_at(self.escrow_address)
        raw_settlement = escrow.view().get_settlement(bid)

        if not raw_settlement:
            raise gl.vm.UserError("Settlement not found in escrow")

        try:
            settlement = json.loads(raw_settlement)
        except Exception:
            raise gl.vm.UserError("Failed to decode settlement JSON")

        dev = settlement.get("dev", "").strip().lower()
        creator = settlement.get("creator", "").strip().lower()
        criteria_hash = settlement.get("criteria_hash", "").strip()
        head_sha = settlement.get("head_sha", "").strip()
        verdict = settlement.get("verdict", "").strip()
        packet_sha256 = settlement.get("packet_sha256", "").strip()
        dev_amt_str = settlement.get("dev_amount", "0")
        creator_amt_str = settlement.get("creator_amount", "0")
        payout_pct_str = settlement.get("payout_pct", "0")

        if not dev or not criteria_hash or not head_sha or not packet_sha256:
            raise gl.vm.UserError("Invalid settlement record: missing required fields")

        try:
            dev_amt = int(dev_amt_str)
            creator_amt = int(creator_amt_str)
            payout_pct = int(payout_pct_str)
        except Exception:
            raise gl.vm.UserError("Invalid settlement amounts")

        # Refusal check: payout percentage below required threshold
        clamped_min = min(max(25, min_payout_pct), 100)
        if payout_pct < clamped_min:
            raise gl.vm.UserError("Settlement payout percentage below required threshold")

        # 1. Update Dev Score
        dev_score = {
            "best_verdict_counts": {},
            "schema_version": "2",
            "settled_count": 0,
            "units_earned": "0",
        }
        if dev in self.dev_scores:
            try:
                dev_score = json.loads(self.dev_scores[dev])
            except Exception:
                pass

        dev_score["settled_count"] = int(dev_score.get("settled_count", 0)) + 1
        curr_earned = int(dev_score.get("units_earned", "0"))
        dev_score["units_earned"] = str(curr_earned + dev_amt)

        counts = dev_score.get("best_verdict_counts", {})
        counts[verdict] = int(counts.get(verdict, 0)) + 1
        dev_score["best_verdict_counts"] = counts

        self.dev_scores[dev] = canonical_json(dev_score)

        # 2. Update Creator Score
        creator_score = {
            "bounties_settled": 0,
            "schema_version": "2",
            "units_paid": "0",
            "units_refunded": "0",
        }
        if creator in self.creator_scores:
            try:
                creator_score = json.loads(self.creator_scores[creator])
            except Exception:
                pass

        creator_score["bounties_settled"] = int(creator_score.get("bounties_settled", 0)) + 1
        curr_paid = int(creator_score.get("units_paid", "0"))
        curr_ref = int(creator_score.get("units_refunded", "0"))
        creator_score["units_paid"] = str(curr_paid + dev_amt)
        creator_score["units_refunded"] = str(curr_ref + creator_amt)

        self.creator_scores[creator] = canonical_json(creator_score)

        # 3. Mark Processed & Update Recent
        self.processed[bid] = "1"

        recent_json = self.meta.get("recent_synced", "[]")
        try:
            recents = json.loads(recent_json)
        except Exception:
            recents = []
        updated_recents = [bid] + [x for x in recents if x != bid][:49]
        self.meta["recent_synced"] = canonical_json(updated_recents)

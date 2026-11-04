"""Interop helper (0.6 operation approvals, spec 15.4), the Python side of scripts/interop.mjs.

    python py-operation.py make OUT.json      # issue a mandate, an operation approval and a status list
    python py-operation.py check IN.json      # check another implementation's objects; print the decisions

Fixed test seeds, shared with scripts/ts-operation.mjs: signer 01, agent 02, bank 03, other agent 04, status list
issuer 0d. Three scenarios: a valid approval, the wrong agent key, and a mandate revoked in its status list.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from gleipnir_verify import mandate as M


def key(n: int) -> Ed25519PrivateKey:
    return Ed25519PrivateKey.from_private_bytes(bytes([n]) * 32)


SIGNER, AGENT, BANK, OTHER, ISSUER = key(1), key(2), key(3), key(4), key(13)
NOW = "2026-10-23T09:14:02.000Z"
AT = datetime(2026, 10, 23, 9, 14, 2, tzinfo=timezone.utc)
SHOP = "shop.example.com"
URI = "https://status.nordhafen.example/lists/interop"
SIGNER_P = {"id": "kberger@nordhafen.at", "public_key": M.public_key_of(SIGNER)}
OP = {"operation_id": "exc_5Rt2", "revision": "1791487200-k3Jd9Qx2mW8v", "terms": {"refund": {"amount": "70.00",
      "currency": "USD"}}, "expires_at": "2026-10-23T09:30:00.000Z"}


def make() -> dict:
    t = int(AT.timestamp())
    token = M.status_list_token([0, 1], uri=URI, bits=1, sk=ISSUER, iat=t - 60, exp=t + 3600)
    out = {"operation": OP, "status_token": token, "scenarios": []}
    for idx in (0, 1):
        m = M.issue(id=f"m_interop_{idx}", company={"name": "Nordhafen Logistik GmbH", "country": "AT"},
                    agent={"id": "ap-agent", "jkt": M.jwk_thumbprint(M.public_key_jwk(M.public_key_of(AGENT)))},
                    signer=SIGNER_P, valid_until="2026-12-31T23:59:59.000Z", issued_at="2026-10-01T08:00:00.000Z",
                    scope={"currency": "EUR", "max_per_payment": "100.00", "counterparties": [SHOP],
                           "from_accounts": [{"scheme": "iban", "iban": "AT483200000012345864"}]},
                    extra={"status": {"status_list": {"idx": idx, "uri": URI}}})
        m = M.sign_mandate(m, SIGNER)
        a = M.approve_operation(m, counterparty=SHOP, operation=OP, approved_at="2026-10-23T09:10:00.000Z")
        a = M.sign_operation_approval(a, SIGNER, SIGNER_P)
        out["scenarios"].append({"mandate": m, "approval": a})
    return out


def check(objs: dict) -> list[dict]:
    rows = []
    agent_jwk, other_jwk = M.public_key_jwk(M.public_key_of(AGENT)), M.public_key_jwk(M.public_key_of(OTHER))
    for name, sc, jwk in (("valid", 0, agent_jwk), ("wrong_agent_key", 0, other_jwk), ("revoked", 1, agent_jwk)):
        s = objs["scenarios"][sc]
        checker = M.Checker(id="bank:INTEROP", sk=BANK, clock=lambda: AT,
                            authority=lambda c, pid: M.AuthorityResult("bank_kyb", (M.public_key_of(SIGNER),))
                            if pid == SIGNER_P["id"] else None,
                            status_list=lambda uri: objs["status_token"], status_list_keys=[M.public_key_of(ISSUER)])
        d = checker.check_operation(s["mandate"], s["approval"], objs["operation"],
                                    {"counterparty": SHOP, "agent_jwk": jwk})
        rows.append({"name": name, "decision": d})
    return rows


def verify(objs: dict, rows: list[dict]) -> list[dict]:
    """Verify the other implementation's decisions and receipts."""
    out = []
    for r, sc in zip(rows, (0, 0, 1), strict=True):
        s = objs["scenarios"][sc]
        rec = M.verify_operation_receipt(s["mandate"], s["approval"], r["decision"], [M.public_key_of(BANK)])
        out.append({"name": r["name"], "valid": rec["valid"], "problems": rec["problems"]})
    return out


if __name__ == "__main__":
    cmd, path = sys.argv[1], sys.argv[2]
    if cmd == "make":
        with open(path, "w", encoding="utf-8") as f:
            json.dump(make(), f)
    elif cmd == "check":
        with open(path, encoding="utf-8") as f:
            objs = json.load(f)
        print(json.dumps([{"name": r["name"], "outcome": r["decision"]["outcome"], "reasons": r["decision"]["reasons"],
                           "checks": r["decision"]["checks"], "decision": r["decision"]} for r in check(objs)]))
    elif cmd == "verify":
        with open(path, encoding="utf-8") as f:
            objs = json.load(f)
        with open(sys.argv[3], encoding="utf-8") as f:
            rows = json.load(f)
        print(json.dumps(verify(objs, rows)))

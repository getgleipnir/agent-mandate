"""0.6, the agent protocol profile (spec 15): the shared vectors (also run by the TypeScript port) and unit tests."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

import mandate_vectors as V
import pytest

from gleipnir_verify import mandate as M

DATA = json.loads(V.OUT_06.read_text(encoding="utf-8"))
AT = datetime(2026, 10, 23, 9, 14, 2, tzinfo=timezone.utc)


@pytest.mark.parametrize("c", DATA["cases"], ids=[c["name"] for c in DATA["cases"]])
def test_payment_vector(c):
    decisions = V.run(c)
    assert V.expected(decisions) == c["expect"]
    for d in decisions:
        assert M.verify_decision(d, [DATA["bank"]["public_key"]])
    receipt = M.verify_receipt(c["mandate"], c["payments"][0], decisions[0], [DATA["bank"]["public_key"]],
                               webauthn=c["webauthn"], payee_approvals=(c.get("approvals") or [[]])[0] or [])
    assert {k: v for k, v in receipt.items() if k != "checked_at"} == c["receipt"]


@pytest.mark.parametrize("c", DATA["operations"], ids=[c["name"] for c in DATA["operations"]])
def test_operation_vector(c):
    decisions = V.run_operations(c)
    assert V.expected(decisions) == c["expect"]
    for d in decisions:
        assert d["v"] == "gleipnir/decision/0.6"
        assert M.verify_decision(d, [DATA["bank"]["public_key"]])
    receipt = M.verify_operation_receipt(c["mandate"], c["steps"][0]["approval"], decisions[0],
                                         [DATA["bank"]["public_key"]], webauthn=c["webauthn"])
    assert {k: v for k, v in receipt.items() if k != "checked_at"} == c["receipt"]


def test_fixture_is_current():
    fresh = V.build_06()
    assert json.loads(json.dumps(fresh)) == {k: v for k, v in DATA.items()}


def test_problems():
    fns = {"mandate": M.mandate_problem, "operation_approval": M.operation_approval_problem,
           "operation": M.operation_problem, "domain": M.domain_problem,
           "jwk_thumbprint": lambda j: M.jwk_problem(j) or M.jwk_thumbprint(j), "public_key_jwk": M.public_key_jwk,
           "principal_commitment": lambda p: M.principal_commitment(p["id"], p["salt"])}
    n = 0
    for kind, obj, want in DATA["problems"]:
        if kind == "status_list":
            at = datetime.fromisoformat(obj["at"].replace("Z", "+00:00"))
            try:
                got = M.status_list_status(obj["token"], obj["uri"], obj["idx"], obj["keys"], at)
            except ValueError:
                got = "error"
        else:
            got = fns[kind](obj)
        assert got == want, (kind, obj)
        n += 1
    assert n > 60


def test_rfc8037_thumbprint():
    jwk = {"kty": "OKP", "crv": "Ed25519", "x": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo"}
    assert M.jwk_thumbprint(jwk) == "kPrK_qmxVWaYVA9wwBF6Iuo3vVzz7TxHCTwXBygrS4k"


def test_operation_keys():
    for cp, oid, key in DATA["operation_keys"]:
        assert M.operation_key(cp, oid) == key
    assert len({k for _, _, k in DATA["operation_keys"]}) == len(DATA["operation_keys"])


def test_issue_picks_the_draft():
    base = {"company": V.COMPANY, "scope": V.scope(), "valid_until": "2026-12-31T23:59:59.000Z", "id": "m",
            "signer": V.signer()}
    assert M.issue(agent={"id": "a"}, **base)["v"] == "gleipnir/mandate/0.4"
    assert M.issue(agent={"id": "a", "jkt": V.AGENT_JKT}, **base)["v"] == "gleipnir/mandate/0.6"
    m = M.issue(agent={"id": "a"}, extra={"status": V.listed(3)}, **base)
    assert m["v"] == "gleipnir/mandate/0.6" and m["status"] == V.listed(3)
    pw = {**base, "signer": {"id": V.PAIRWISE_ID, "public_key": M.public_key_of(V.SIGNER)}}
    assert M.issue(agent={"id": "a"}, **pw)["v"] == "gleipnir/mandate/0.6"
    with pytest.raises(ValueError):
        M.issue(agent={"id": "a", "jkt": "x"}, **base)
    with pytest.raises(ValueError):
        M.approve_operation(V.mandate(), counterparty=V.SHOP, operation=V.OP)
    with pytest.raises(ValueError):
        M.principal_commitment("x", "short")


@pytest.mark.parametrize("bits", [1, 2, 4, 8])
def test_status_list_packing(bits):
    sk = V.key(13)
    entries = [(i * 7 + 3) % (1 << bits) for i in range(37)]
    t = M.status_list_token(entries, uri="https://s.example/l", bits=bits, sk=sk, iat=int(AT.timestamp()) - 1,
                            exp=int(AT.timestamp()) + 60)
    keys = [M.public_key_of(sk)]
    assert [M.status_list_status(t, "https://s.example/l", i, keys, AT) for i in range(37)] == entries
    with pytest.raises(ValueError):
        M.status_list_status(t, "https://s.example/l", 37 * bits // 8 * 8 // bits + 8, keys, AT)
    with pytest.raises(ValueError):  # a tampered payload
        h, p, s = t.split(".")
        M.status_list_status(f"{h}.{p[:-2]}AA.{s}", "https://s.example/l", 0, keys, AT)
    with pytest.raises(ValueError):  # older than the checker's max age
        M.status_list_status(t, "https://s.example/l", 0, keys, AT + timedelta(seconds=58),
                             max_age=timedelta(seconds=30))


def test_never_raises_on_junk():
    checker = M.Checker(id="b", sk=V.BANK, authority=V.authority_fn(V.KYB), holds=V.holds_fn(V.HOLDS))
    m = V.m06()
    a = V.op_approval(m)
    for mandate, approval, op, ctx in ((None, a, V.OP, {}), (m, None, V.OP, {}), (m, a, None, None),
                                       (m, a, V.OP, "x"), (m, a, V.OP, {"agent_jwk": 7, "counterparty": [1]}),
                                       (m, {**a, "terms": {"x": 2.5}}, V.OP, {}), ([], [], [], [])):
        d = checker.check_operation(mandate, approval, op, ctx)
        assert d["outcome"] == "block"
        assert M.verify_decision(d, [checker.public_key])
    p = V.pay(m, "p_1", agent=None)
    for ctx in ("x", 1, [], {"agent_jwk": "x"}, {"agent_jwk": {"kty": "OKP"}}):
        assert checker.check(m, p, None, ctx)["reasons"] == ["agent_key_mismatch"]

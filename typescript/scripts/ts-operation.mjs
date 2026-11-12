#!/usr/bin/env node
/**
 * Interop helper (0.6 operation approvals, spec 15.4), the TypeScript side of scripts/interop.mjs. Same commands,
 * seeds and scenarios as scripts/py-operation.py:
 *
 *   node ts-operation.mjs make OUT.json
 *   node ts-operation.mjs check IN.json
 *   node ts-operation.mjs verify IN.json DECISIONS.json
 */

import { readFileSync, writeFileSync } from "node:fs";
import {
  Checker, approveOperation, issue, jwkThumbprint, publicKeyJwk, publicKeyOf, seedFromHex, signMandate,
  signOperationApproval, statusListToken, verifyOperationReceipt,
} from "../packages/verify/dist/mandate.js";

const seed = (n) => seedFromHex(n.toString(16).padStart(2, "0").repeat(32));
const SIGNER = seed(1), AGENT = seed(2), BANK = seed(3), OTHER = seed(4), ISSUER = seed(13);
const AT = new Date("2026-10-23T09:14:02.000Z");
const SHOP = "shop.example.com";
const URI = "https://status.nordhafen.example/lists/interop";
const SIGNER_P = { id: "kberger@nordhafen.at", public_key: publicKeyOf(SIGNER) };
const OP = { operation_id: "exc_5Rt2", revision: "1791487200-k3Jd9Qx2mW8v", terms: { refund: { amount: "70.00", currency: "USD" } },
  expires_at: "2026-10-23T09:30:00.000Z" };

function make() {
  const t = Math.floor(AT.getTime() / 1000);
  const out = { operation: OP, status_token: statusListToken([0, 1], { uri: URI, bits: 1, seed: ISSUER, iat: t - 60, exp: t + 3600 }),
    scenarios: [] };
  for (const idx of [0, 1]) {
    let m = issue({ id: `m_interop_${idx}`, company: { name: "Nordhafen Logistik GmbH", country: "AT" },
      agent: { id: "ap-agent", jkt: jwkThumbprint(publicKeyJwk(publicKeyOf(AGENT))) }, signer: SIGNER_P,
      validUntil: "2026-12-31T23:59:59.000Z", issuedAt: "2026-10-01T08:00:00.000Z",
      scope: { currency: "EUR", max_per_payment: "100.00", counterparties: [SHOP],
        from_accounts: [{ scheme: "iban", iban: "AT483200000012345864" }] },
      extra: { status: { status_list: { idx, uri: URI } } } });
    m = signMandate(m, SIGNER);
    let a = approveOperation(m, { counterparty: SHOP, operation: OP, approvedAt: "2026-10-23T09:10:00.000Z" });
    a = signOperationApproval(a, SIGNER, SIGNER_P);
    out.scenarios.push({ mandate: m, approval: a });
  }
  return out;
}

async function check(objs) {
  const rows = [];
  const agentJwk = publicKeyJwk(publicKeyOf(AGENT)), otherJwk = publicKeyJwk(publicKeyOf(OTHER));
  for (const [name, sc, jwk] of [["valid", 0, agentJwk], ["wrong_agent_key", 0, otherJwk], ["revoked", 1, agentJwk]]) {
    const s = objs.scenarios[sc];
    const checker = new Checker({ id: "bank:INTEROP", seed: BANK, clock: () => AT,
      authority: (_c, pid) => (pid === SIGNER_P.id ? { source: "bank_kyb", keys: [publicKeyOf(SIGNER)] } : null),
      statusList: () => objs.status_token, statusListKeys: [publicKeyOf(ISSUER)] });
    const d = await checker.checkOperation(s.mandate, s.approval, objs.operation, { counterparty: SHOP, agent_jwk: jwk });
    rows.push({ name, outcome: d.outcome, reasons: d.reasons, checks: d.checks, decision: d });
  }
  return rows;
}

const [cmd, path, extra] = process.argv.slice(2);
if (cmd === "make") writeFileSync(path, JSON.stringify(make()));
else if (cmd === "check") console.log(JSON.stringify(await check(JSON.parse(readFileSync(path, "utf8")))));
else if (cmd === "verify") {
  const objs = JSON.parse(readFileSync(path, "utf8"));
  const rows = JSON.parse(readFileSync(extra, "utf8"));
  console.log(JSON.stringify(rows.map((r, i) => {
    const s = objs.scenarios[[0, 0, 1][i]];
    const rec = verifyOperationReceipt(s.mandate, s.approval, r.decision, [publicKeyOf(BANK)]);
    return { name: r.name, valid: rec.valid, problems: rec.problems };
  })));
}

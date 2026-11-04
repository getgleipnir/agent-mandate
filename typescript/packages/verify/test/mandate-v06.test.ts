import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  Checker,
  InMemoryLedger,
  approveOperation,
  domainProblem,
  issue,
  jwkProblem,
  jwkThumbprint,
  makeOverride,
  mandateProblem,
  operationApprovalProblem,
  operationKey,
  operationProblem,
  principalCommitment,
  publicKeyJwk,
  publicKeyOf,
  seedFromHex,
  signOperationApproval,
  signMandate,
  signOverride,
  statusListStatus,
  statusListToken,
  verifyDecision,
  verifyOperationReceipt,
  verifyReceipt,
} from "@getgleipnir/verify/mandate";

type J = Record<string, unknown>;
type Row = { company: string; signer: string; source: string; keys: string[]; may_sign: boolean; joint?: number;
  retired?: Record<string, string>; person?: string };
interface PaymentCase {
  name: string; mandate: unknown; payments: unknown[]; now: string[]; authority: Row[]; revocations: unknown[];
  status: unknown; ledger: boolean; holds: { company: string; account: J }[]; policy: { require_payees?: boolean };
  officers: string[]; webauthn: { rp_id?: string; origins?: string[] }; approvals?: (unknown[] | null)[];
  contexts?: unknown[]; status_lists?: Record<string, string>; status_list_keys?: string[];
  ops?: ("check" | { resolve: { of: number; id: string; outcome: "allow" | "block"; decided_at: string; reason?: string;
    signers: { seed: string; id: string }[] } })[];
  expect: J[]; receipt: J;
}
interface OperationCase {
  name: string; mandate: unknown; steps: { approval: unknown; operation: unknown; context: unknown; now: string }[];
  authority: Row[]; revocations: unknown[]; status_lists: Record<string, string> | null; status_list_keys: string[];
  webauthn: { rp_id?: string; origins?: string[] }; expect: J[]; receipt: J;
}

const DATA = JSON.parse(
  readFileSync(fileURLToPath(new URL("./fixtures/mandate-vectors-06.json", import.meta.url)), "utf8"),
) as { bank: { id: string; seed_hex: string; public_key: string }; cases: PaymentCase[]; operations: OperationCase[];
  problems: [string, unknown, unknown][]; operation_keys: [string, string, string][] };

const sortKeys = (v: unknown): unknown => Array.isArray(v) ? v.map(sortKeys)
  : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys((v as J)[k])])) : v;

function checker(c: { authority: Row[]; revocations: unknown[]; status_lists?: Record<string, string> | null;
  status_list_keys?: string[]; webauthn: { rp_id?: string; origins?: string[] }; officers?: string[];
  holds?: { company: string; account: J }[]; status?: unknown; ledger?: boolean; policy?: { require_payees?: boolean } },
clock: () => Date): Checker {
  const holds = c.holds ?? [{ company: "Nordhafen Logistik GmbH", account: { scheme: "iban", iban: "AT483200000012345864" } }];
  return new Checker({
    id: DATA.bank.id,
    seed: seedFromHex(DATA.bank.seed_hex),
    authority: (company, signerId) => {
      const row = c.authority.find((r) => r.company === company.name && r.signer === signerId);
      return row ? { source: row.source, keys: row.keys, maySign: row.may_sign, joint: row.joint ?? 1,
        retired: row.retired ?? {}, person: row.person ?? null } : null;
    },
    holds: (company, account) => {
      const r = holds.find((x) => x.company === company.name && JSON.stringify(sortKeys(x.account)) === JSON.stringify(sortKeys(account)));
      return r ? `cust:${r.company}` : null;
    },
    ledger: c.ledger === false ? null : new InMemoryLedger(),
    revocations: c.revocations,
    officers: c.officers ?? [],
    requirePayees: c.policy?.require_payees ?? false,
    status: c.status === null || c.status === undefined ? null : async () => c.status,
    statusList: c.status_lists === null || c.status_lists === undefined ? null : async (uri) => {
      const t = c.status_lists![uri] ?? "error";
      if (t === "error") throw new Error(`unreachable ${uri}`);
      return t;
    },
    statusListKeys: c.status_list_keys ?? [],
    clock,
    webauthn: { rpId: c.webauthn.rp_id, origins: c.webauthn.origins },
  });
}

function expected(decisions: J[]): J[] {
  const first = new Map<unknown, number>();
  return decisions.map((d, i) => {
    let row: J = Object.fromEntries(Object.entries(d).filter(([k]) => k !== "id" && k !== "sig"));
    if (row.escalation) row.escalation = { step: first.get((row.escalation as J).id) ?? null };
    if (row.override) row.override = { id: (row.override as J).id };
    if (first.has(d.id)) row = { same_as: first.get(d.id) };
    if (!first.has(d.id)) first.set(d.id, i);
    return row;
  });
}

describe("0.6 conformance vectors: payments (shared with the Python reference)", () => {
  it.each(DATA.cases.map((c) => [c.name, c] as const))("%s", async (_n, c) => {
    let now = c.now[0]!;
    const bank = checker(c, () => new Date(now));
    const out: J[] = [];
    for (let i = 0; i < c.payments.length; i++) {
      now = c.now[i]!;
      const op = (c.ops ?? [])[i] ?? "check";
      const ap = (c.approvals ?? [])[i] ?? undefined;
      const cx = (c.contexts ?? [])[i] ?? undefined;
      if (op === "check") out.push(await bank.check(c.mandate, c.payments[i], ap, cx));
      else {
        const d = out[op.resolve.of]!;
        let o = makeOverride(d, { outcome: op.resolve.outcome, id: op.resolve.id, reason: op.resolve.reason ?? "",
          decidedAt: op.resolve.decided_at });
        for (const s of op.resolve.signers) o = signOverride(o, seedFromHex(s.seed), { id: s.id, public_key: publicKeyOf(seedFromHex(s.seed)) });
        out.push(await bank.resolve(c.mandate, c.payments[i], d, o, ap, cx));
      }
    }
    expect(expected(out)).toEqual(c.expect);
    for (const d of out) expect(verifyDecision(d, [DATA.bank.public_key])).toBe(true);
    const receipt: J = { ...verifyReceipt(c.mandate, c.payments[0], out[0], [DATA.bank.public_key], {
      webauthn: { rpId: c.webauthn.rp_id, origins: c.webauthn.origins }, payeeApprovals: (c.approvals ?? [])[0] ?? [],
    }) };
    delete receipt.checked_at;
    expect(receipt).toEqual(c.receipt);
  });
});

describe("0.6 conformance vectors: operation approvals (shared with the Python reference)", () => {
  it.each(DATA.operations.map((c) => [c.name, c] as const))("%s", async (_n, c) => {
    let now = c.steps[0]!.now;
    const bank = checker(c, () => new Date(now));
    const out: J[] = [];
    for (const s of c.steps) {
      now = s.now;
      out.push(await bank.checkOperation(c.mandate, s.approval, s.operation, s.context));
    }
    expect(expected(out)).toEqual(c.expect);
    for (const d of out) {
      expect(d.v).toBe("gleipnir/decision/0.6");
      expect(verifyDecision(d, [DATA.bank.public_key])).toBe(true);
    }
    const receipt: J = { ...verifyOperationReceipt(c.mandate, c.steps[0]!.approval, out[0], [DATA.bank.public_key], {
      webauthn: { rpId: c.webauthn.rp_id, origins: c.webauthn.origins } }) };
    delete receipt.checked_at;
    expect(receipt).toEqual(c.receipt);
  });

  it("problem messages, thumbprints and status list answers are the same as the Python reference", () => {
    const fns: Record<string, (v: unknown) => unknown> = {
      mandate: mandateProblem, operation_approval: operationApprovalProblem, operation: operationProblem,
      domain: domainProblem, jwk_thumbprint: (j) => jwkProblem(j) ?? jwkThumbprint(j),
      public_key_jwk: (k) => publicKeyJwk(k as string), principal_commitment: (p) => principalCommitment((p as J).id, (p as J).salt),
      status_list: (o) => {
        const x = o as { token: string; uri: string; idx: number; keys: string[]; at: string };
        try {
          return statusListStatus(x.token, x.uri, x.idx, x.keys, new Date(x.at));
        } catch {
          return "error";
        }
      },
    };
    expect(DATA.problems.length).toBeGreaterThan(60);
    for (const [kind, input, want] of DATA.problems) expect(fns[kind]!(input), `${kind} ${JSON.stringify(input)}`).toEqual(want);
  });

  it("operation keys are the same bytes as the Python reference", () => {
    for (const [cp, oid, key] of DATA.operation_keys) expect(operationKey(cp, oid)).toBe(key);
  });
});

describe("0.6 in TypeScript", () => {
  it("RFC 8037 appendix A.3 thumbprint", () => {
    expect(jwkThumbprint({ kty: "OKP", crv: "Ed25519", x: "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo" }))
      .toBe("kPrK_qmxVWaYVA9wwBF6Iuo3vVzz7TxHCTwXBygrS4k");
  });

  it.each([1, 2, 4, 8])("status lists with %i bits per entry round-trip", (bits) => {
    const seed = seedFromHex("0d".repeat(32));
    const at = new Date("2026-10-23T09:14:02.000Z");
    const t = Math.floor(at.getTime() / 1000);
    const entries = Array.from({ length: 37 }, (_, i) => (i * 7 + 3) % (1 << bits));
    const tok = statusListToken(entries, { uri: "https://s.example/l", bits, seed, iat: t - 1, exp: t + 60 });
    const keys = [publicKeyOf(seed)];
    expect(entries.map((_, i) => statusListStatus(tok, "https://s.example/l", i, keys, at))).toEqual(entries);
    expect(() => statusListStatus(tok, "https://s.example/l", 0, [publicKeyOf(seedFromHex("0e".repeat(32)))], at)).toThrow();
    expect(() => statusListStatus(tok, "https://s.example/other", 0, keys, at)).toThrow();
  });

  it("issue picks 0.6 for profile fields, and an operation approval round-trips", async () => {
    const signer = seedFromHex("01".repeat(32)), agent = seedFromHex("02".repeat(32)), bankSeed = seedFromHex("03".repeat(32));
    const jkt = jwkThumbprint(publicKeyJwk(publicKeyOf(agent)));
    const m0 = issue({ id: "m", company: { name: "C", country: "AT" }, agent: { id: "a", jkt },
      signer: { id: "s", public_key: publicKeyOf(signer) }, validUntil: "2099-01-01T00:00:00.000Z",
      issuedAt: "2025-01-01T00:00:00.000Z", scope: { currency: "EUR", max_per_payment: "10.00", from_accounts: [{ scheme: "iban", iban: "AT483200000012345864" }],
        counterparties: ["shop.example.com"] } });
    expect(m0.v).toBe("gleipnir/mandate/0.6");
    const m = signMandate(m0, signer);
    const op = { operation_id: "op1", revision: "r1", terms: { a: 1 }, expires_at: "2099-01-01T00:00:00.000Z" };
    const a = signOperationApproval(approveOperation(m, { counterparty: "shop.example.com", operation: op,
      approvedAt: "2026-01-01T00:00:00.000Z" }), signer, { id: "s", public_key: publicKeyOf(signer) });
    const bank = new Checker({ id: "b", seed: bankSeed, authority: () => ({ source: "kyb", keys: [publicKeyOf(signer)] }) });
    const ctx = { counterparty: "shop.example.com", agent_jwk: publicKeyJwk(publicKeyOf(agent)) };
    const d = await bank.checkOperation(m, a, op, ctx);
    expect(d.outcome).toBe("allow");
    expect(await bank.checkOperation(m, a, op, ctx)).toEqual(d);
    expect(verifyOperationReceipt(m, a, d, [publicKeyOf(bankSeed)]).valid).toBe(true);
    for (const junk of [undefined, null, 1, "x", [], { ...a, terms: { a: 1.5 } }]) {
      expect((await bank.checkOperation(m, junk, op, ctx)).outcome).toBe("block");
      expect((await bank.checkOperation(junk, a, op, ctx)).outcome).toBe("block");
    }
    expect(() => approveOperation({ ...m, v: "gleipnir/mandate/0.5" }, { counterparty: "shop.example.com", operation: op })).toThrow();
  });
});

/** Mandate links (experimental, docs/mandate-link.md): encode -> sign -> verify, tampering, expiry. */

import { p256 } from "@noble/curves/nist.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { describe, expect, it } from "vitest";
import { b64uDecode, b64uEncode, concatBytes, utf8 } from "../src/bytes.js";
import { encodeP256PublicKey, p256SpkiFromScalar } from "../src/crypto.js";
import {
  attachP256Signature, decodeLink, draftLink, encodeLink, linkCode, linkHash, linkMessage, linkPasskeyChallenge, MAX_ENCODED,
  readStatus, signLinkEd25519, statusUrlProblem, textWarning, validTimestamp, verifyLink,
} from "../src/link.js";
import type { JsonDict } from "../src/py.js";

const SEED = new Uint8Array(32).fill(7);
const NOW = new Date("2026-11-04T12:00:00Z");
const P256_N = p256.Point.CURVE().n;

function draft(extra: Partial<Parameters<typeof draftLink>[0]> = {}): JsonDict {
  return draftLink({
    id: "l_test",
    principal: { name: "Jane Doe", kind: "person" },
    agent: { id: "agent:acme-assistant", name: "Acme Assistant" },
    counterparty: "Any",
    actions: ["discuss my account", "agree to a payment plan up to $200/month"],
    maxAmount: { amount: "200.00", currency: "usd" },
    issuedAt: "2026-11-04T10:00:00Z",
    validUntil: "2026-12-31T23:59:59Z",
    signer: { public_key: "" },
    ...extra,
  });
}

describe("mandate link", () => {
  it("round-trips: sign, encode into the fragment, decode, verify", () => {
    const signed = signLinkEd25519(draft(), SEED);
    const frag = encodeLink(signed);
    expect(frag).toMatch(/^[A-Za-z0-9_-]+$/);
    const r = verifyLink(`https://getgleipnir.com/link/v/#${frag}`, NOW);
    expect(r.status).toBe("valid");
    expect(r.problem).toBeNull();
    expect(r.link).toEqual(signed);
    expect(r.code).toBe(linkCode(linkHash(signed)));
    expect(r.code).toMatch(/^[0-9A-F]{3} [0-9A-F]{3}$/);
    expect(r.keyId).toMatch(/^k_ed25519_[0-9a-f]{16}$/);
    expect((signed.max_amount as JsonDict).currency).toBe("USD");
  });

  it("the code and the signature do not depend on key order or whitespace", () => {
    const signed = signLinkEd25519(draft(), SEED);
    const reordered = JSON.stringify(Object.fromEntries(Object.entries(signed).reverse()), null, 2);
    const r = verifyLink(b64uEncode(utf8(reordered)), NOW);
    expect(r.status).toBe("valid");
    expect(r.hash).toBe(linkHash(signed));
  });

  it("detects tampering with any signed field", () => {
    const signed = signLinkEd25519(draft(), SEED);
    for (const change of [
      { actions: ["discuss my account", "agree to a payment plan up to $2000/month"] },
      { max_amount: { amount: "2000.00", currency: "USD" } },
      { valid_until: "2027-12-31T23:59:59Z" },
      { agent: { id: "agent:someone-else" } },
      { principal: { name: "John Doe", kind: "person" } },
      { counterparty: "Big Bank" },
    ]) {
      const r = verifyLink(encodeLink({ ...signed, ...change }), NOW);
      expect(r.status, JSON.stringify(change)).toBe("invalid_signature");
    }
    // Leaving out an optional field changes the hash too.
    const { counterparty: _c, ...noCounterparty } = signed;
    expect(verifyLink(encodeLink(noCounterparty), NOW).status).toBe("invalid_signature");
  });

  it("detects a signature by another key, and a corrupted fragment", () => {
    const signed = signLinkEd25519(draft(), SEED);
    const other = signLinkEd25519(draft(), new Uint8Array(32).fill(9));
    expect(verifyLink(encodeLink({ ...signed, sig: other.sig }), NOW).status).toBe("invalid_signature");
    const frag = encodeLink(signed);
    const flipped = frag.slice(0, 40) + (frag[40] === "A" ? "B" : "A") + frag.slice(41);
    expect(["malformed", "invalid_signature"]).toContain(verifyLink(flipped, NOW).status);
    expect(verifyLink("", NOW).status).toBe("malformed");
    expect(verifyLink("not base64!", NOW).status).toBe("malformed");
  });

  it("is expired after valid_until, and valid up to it", () => {
    const signed = signLinkEd25519(draft(), SEED);
    expect(verifyLink(signed, new Date("2026-12-31T23:59:59Z")).status).toBe("valid");
    const r = verifyLink(signed, new Date("2027-01-01T00:00:00Z"));
    expect(r.status).toBe("expired");
    expect(r.code).not.toBeNull();
  });

  it("refuses unknown fields, missing fields, floats, duplicate keys and non-https status URLs", () => {
    const signed = signLinkEd25519(draft(), SEED);
    expect(verifyLink({ ...signed, extra: 1 }, NOW).problem).toMatch(/unknown field/);
    const { agent: _a, ...noAgent } = signed;
    expect(verifyLink(noAgent, NOW).problem).toMatch(/missing agent/);
    expect(verifyLink(b64uEncode(utf8('{"v":1.5}')), NOW).status).toBe("malformed");
    expect(verifyLink(b64uEncode(utf8('{"v":"a","v":"b"}')), NOW).problem).toMatch(/duplicate/);
    const http = signLinkEd25519(draft({ statusUrl: "http://example.com/s" }), SEED);
    expect(verifyLink(http, NOW).problem).toMatch(/status_url/);
    const https = signLinkEd25519(draft({ statusUrl: "https://status.example.com/l_test" }), SEED);
    expect(verifyLink(https, NOW).status).toBe("valid");
  });

  /** A passkey-signed link, with knobs to break one thing at a time. */
  function passkeyLink(o: { flags?: number; rpHash?: string; origin?: string; rpId?: string; type?: string;
    crossOrigin?: boolean; highS?: boolean; extraSigField?: boolean } = {}): JsonDict {
    const scalar = new Uint8Array(32).fill(3);
    const rpId = o.rpId ?? "getgleipnir.com";
    const origin = o.origin ?? "https://getgleipnir.com";
    const l = draft({ signer: { public_key: encodeP256PublicKey(p256SpkiFromScalar(scalar)), rp_id: rpId, origin } });
    const cd: JsonDict = { type: o.type ?? "webauthn.get", challenge: b64uEncode(linkPasskeyChallenge(l)), origin };
    if (o.crossOrigin) cd.crossOrigin = true;
    const clientData = utf8(JSON.stringify(cd));
    const auth = concatBytes(sha256(utf8(o.rpHash ?? rpId)), new Uint8Array([o.flags ?? 0x05, 0, 0, 0, 1]));
    let sig = p256.sign(sha256(concatBytes(auth, sha256(clientData))), scalar, { format: "compact", prehash: false });
    let parsed = p256.Signature.fromBytes(sig, "compact");
    if (o.highS) parsed = new p256.Signature(parsed.r, P256_N - parsed.s);
    const out: JsonDict = { type: "webauthn", credential_id: "Y3JlZA", authenticator_data: b64uEncode(auth),
      client_data_json: b64uEncode(clientData), signature: b64uEncode(parsed.toBytes("der")) };
    if (o.extraSigField) out.note = "x";
    return { ...l, sig: out };
  }

  it("verifies a passkey (WebAuthn, P-256) signature over the link's challenge", () => {
    const signed = passkeyLink();
    const r = verifyLink(encodeLink(signed), NOW);
    expect(r.status, r.problem ?? "").toBe("valid");
    expect(r.keyId).toMatch(/^k_p256_/);
    expect(verifyLink({ ...signed, actions: ["anything"] }, NOW).status).toBe("invalid_signature");
  });

  it("refuses broken passkey signatures", () => {
    const cases: [string, Parameters<typeof passkeyLink>[0], RegExp][] = [
      ["no user verification", { flags: 0x01 }, /user verification/],
      ["no user presence", { flags: 0x04 }, /user presence/],
      ["wrong rpIdHash", { rpHash: "evil.example.com" }, /rpIdHash/],
      ["origin outside rp_id", { origin: "https://evil.example.com" }, /declared passkey domain/],
      ["cross-origin frame", { crossOrigin: true }, /cross-origin/],
      ["wrong clientData type", { type: "webauthn.create" }, /webauthn.get/],
      ["high S", { highS: true }, /low S/],
    ];
    for (const [name, opts, why] of cases) {
      const r = verifyLink(passkeyLink(opts), NOW);
      expect(r.status, name).toBe("invalid_signature");
      expect(r.problem, name).toMatch(why);
    }
    expect(verifyLink(passkeyLink({ extraSigField: true }), NOW).problem).toMatch(/sig: unknown field/);
    // rp_id and origin are declared by the signer: a software key claiming any domain still verifies (H1).
    const claimed = passkeyLink({ rpId: "bank.example.com", origin: "https://bank.example.com" });
    expect(verifyLink(claimed, NOW).status).toBe("valid");
  });

  it("verifies a P-256 key signature (the signing page's WebCrypto key), low S only", () => {
    const scalar = new Uint8Array(32).fill(5);
    const l = draft({ signer: { public_key: encodeP256PublicKey(p256SpkiFromScalar(scalar)) } });
    const raw = p256.sign(sha256(linkMessage(l)), scalar, { format: "compact", prehash: false });
    const parsed = p256.Signature.fromBytes(raw, "compact");
    const high = new p256.Signature(parsed.r, P256_N - parsed.s).toBytes("compact");
    const signed = attachP256Signature(l, high); // normalised to low S
    expect(verifyLink(signed, NOW).status).toBe("valid");
    const highDer = "ecdsa-p256:" + b64uEncode(new p256.Signature(parsed.r, P256_N - parsed.s).toBytes("der"));
    expect(verifyLink({ ...signed, sig: highDer }, NOW).problem).toMatch(/low S/);
    expect(verifyLink({ ...signed, actions: ["x"] }, NOW).status).toBe("invalid_signature");
  });

  it("is not yet valid when issued more than 5 minutes in the future", () => {
    const signed = signLinkEd25519(draft({ issuedAt: "2026-11-04T12:10:00Z" }), SEED);
    expect(verifyLink(signed, NOW).status).toBe("not_yet_valid");
    expect(verifyLink(signed, new Date("2026-11-04T12:06:00Z")).status).toBe("valid");
  });

  it("enforces the action count and the link length", () => {
    const twelve = Array.from({ length: 12 }, (_, i) => `action ${i}`);
    expect(verifyLink(signLinkEd25519(draft({ actions: twelve }), SEED), NOW).status).toBe("valid");
    expect(verifyLink(signLinkEd25519(draft({ actions: [...twelve, "13"] }), SEED), NOW).problem).toMatch(/1 to 12/);
    expect(verifyLink("A".repeat(MAX_ENCODED + 1), NOW).problem).toMatch(/too long/);
    // The largest ASCII link (12 actions of 300 characters) fits; the same in a 3-byte script does not.
    const ascii = encodeLink(signLinkEd25519(draft({ actions: Array.from({ length: 12 }, () => "x".repeat(300)) }), SEED));
    expect(ascii.length).toBeLessThan(MAX_ENCODED);
    expect(verifyLink(ascii, NOW).status).toBe("valid");
    const cjk = encodeLink(signLinkEd25519(draft({ actions: Array.from({ length: 12 }, () => "\u8a9e".repeat(300)) }), SEED));
    expect(cjk.length).toBeGreaterThan(MAX_ENCODED);
    expect(verifyLink(cjk, NOW).problem).toMatch(/too long/);
  });

  it("refuses control, invisible and bidi characters and line breaks in displayed text", () => {
    for (const bad of ["Jane\u202EeoD", "Jane\u200BDoe", "Jane\nDoe", "Ja\u0007ne", "Jane\u2028Doe", "Ja\uFEFFne", "Jane\u2066Doe\u2069"]) {
      expect(verifyLink(signLinkEd25519(draft({ principal: { name: bad } }), SEED), NOW).problem, JSON.stringify(bad)).toMatch(/principal/);
      expect(verifyLink(signLinkEd25519(draft({ actions: [bad] }), SEED), NOW).problem).toMatch(/action/);
      expect(verifyLink(signLinkEd25519(draft({ agent: { id: "a", name: bad } }), SEED), NOW).problem).toMatch(/agent/);
      expect(verifyLink(signLinkEd25519(draft({ counterparty: bad }), SEED), NOW).problem).toMatch(/counterparty/);
    }
    expect(verifyLink(signLinkEd25519(draft({ principal: { name: "Zoë Müller" } }), SEED), NOW).status).toBe("valid");
  });

  it("flags mixed-script and non-ASCII names", () => {
    expect(textWarning("Jane Doe")).toBeNull();
    expect(textWarning("J\u0430ne Doe")).toMatch(/Latin and Cyrillic/); // Cyrillic a
    expect(textWarning("Иван Волошин")).toMatch(/non-ASCII/);
    expect(textWarning("Zoë")).toMatch(/non-ASCII/);
  });

  it("refuses impossible dates and times", () => {
    for (const t of ["2026-02-30T12:00:00Z", "2026-12-31T24:00:00Z", "2026-12-31T23:60:00Z", "2026-12-31T23:59:60Z", "2026-13-01T00:00:00Z", "2026-12-31 23:59:59Z"]) {
      expect(validTimestamp(t), t).toBe(false);
      expect(verifyLink(signLinkEd25519(draft({ validUntil: t }), SEED), NOW).problem, t).toMatch(/valid_until/);
    }
    expect(validTimestamp("2028-02-29T00:00:00Z")).toBe(true);
  });

  it("accepts only public https status URLs on port 443", () => {
    for (const u of ["http://status.example.com/s", "https://127.0.0.1/s", "https://[::1]/s", "https://localhost/s",
      "https://printer.local/s", "https://status.example.com:8443/s", "https://user:pw@status.example.com/s", "https://intranet/s",
      "https://0x7f000001/s", "https://10.0.0.1/s"]) {
      expect(statusUrlProblem(u), u).not.toBeNull();
    }
    expect(statusUrlProblem("https://status.example.com/l/1")).toBeNull();
    expect(statusUrlProblem("https://status.example.com:443/l/1")).toBeNull();
  });

  it("reads status answers", () => {
    expect(readStatus({ status: "active" })).toBe("active");
    expect(readStatus({ status: "revoked" })).toBe("revoked");
    expect(readStatus({ status: "paused" })).toBeNull();
    expect(readStatus("revoked")).toBeNull();
  });

  it("decodeLink accepts a bare fragment or a whole URL", () => {
    const frag = encodeLink(signLinkEd25519(draft(), SEED));
    expect(decodeLink(frag)).toEqual(decodeLink(`http://localhost:8000/link/v/#${frag}`));
    expect(b64uDecode(frag).length).toBeGreaterThan(100);
  });
});

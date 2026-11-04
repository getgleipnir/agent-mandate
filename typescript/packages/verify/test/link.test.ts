/** Mandate links (experimental, docs/mandate-link.md): encode -> sign -> verify, tampering, expiry. */

import { p256 } from "@noble/curves/nist.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { describe, expect, it } from "vitest";
import { b64uDecode, b64uEncode, concatBytes, utf8 } from "../src/bytes.js";
import { encodeP256PublicKey, p256SpkiFromScalar } from "../src/crypto.js";
import {
  decodeLink, draftLink, encodeLink, linkCode, linkHash, linkPasskeyChallenge, readStatus, signLinkEd25519, verifyLink,
} from "../src/link.js";
import type { JsonDict } from "../src/py.js";

const SEED = new Uint8Array(32).fill(7);
const NOW = new Date("2026-11-04T12:00:00Z");

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

  it("verifies a passkey (WebAuthn, P-256) signature over the link's challenge", () => {
    const scalar = new Uint8Array(32).fill(3);
    const origin = "https://getgleipnir.com";
    const rpId = "getgleipnir.com";
    const l = draft({ signer: { public_key: encodeP256PublicKey(p256SpkiFromScalar(scalar)), rp_id: rpId, origin } });
    const clientData = utf8(JSON.stringify({ type: "webauthn.get", challenge: b64uEncode(linkPasskeyChallenge(l)), origin }));
    const auth = concatBytes(sha256(utf8(rpId)), new Uint8Array([0x05, 0, 0, 0, 1])); // UP | UV, counter 1
    const der = p256.sign(sha256(concatBytes(auth, sha256(clientData))), scalar, { format: "der", prehash: false });
    const sig = { type: "webauthn", credential_id: "Y3JlZA", authenticator_data: b64uEncode(auth),
      client_data_json: b64uEncode(clientData), signature: b64uEncode(der) };
    const signed: JsonDict = { ...l, sig };
    const r = verifyLink(encodeLink(signed), NOW);
    expect(r.status, r.problem ?? "").toBe("valid");
    expect(r.keyId).toMatch(/^k_p256_/);
    expect(verifyLink({ ...signed, actions: ["anything"] }, NOW).status).toBe("invalid_signature");
    expect(verifyLink({ ...signed, signer: { ...(signed.signer as JsonDict), origin: "https://evil.example" } }, NOW).status)
      .toBe("invalid_signature");
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

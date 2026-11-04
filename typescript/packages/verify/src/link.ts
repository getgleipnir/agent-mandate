/**
 * Mandate links (EXPERIMENTAL, docs/mandate-link.md): a person or company signs what an AI agent may do on
 * their behalf toward a third party (a debt collector, an insurer, a bank's call centre), and hands the agent
 * a link with the signed object in its fragment. The third party opens the link and sees, in the browser, who
 * signed, for which agent, what is allowed, until when, and whether the signature holds.
 *
 * Not part of spec/mandate.md and not exported from the package: the format may change without notice.
 *
 * - Hash: sha256 over the JCS (RFC 8785) encoding of the link without `sig`, "sha256:<hex>".
 * - Signed message: "gleipnir/link/v0.1\n" + hash.
 * - `signer.public_key` "ed25519:..." with `sig` "ed25519:<b64url>" over the message (a key kept on a device), or
 *   "ecdsa-p256:..." with `sig` a WebAuthn assertion (a passkey) whose challenge is SHA-256(message).
 * - Code to read out on a call: the first 6 hex characters of the hash, upper case, as "3F9 A21".
 */

import { b64uDecode, b64uEncode, bytesToHex, concatBytes, utf8 } from "./bytes.js";
import { canonicalize, hashToBytes, sha256Tagged } from "./canon.js";
import { decodePublicKey, ed25519PublicFromSeed, ed25519Sign, encodePublicKey, keyId, verifySignature } from "./crypto.js";
import { webauthnProblem } from "./approvals.js";
import { parseStrict } from "./mandate.js";
import { isDict, type JsonDict } from "./py.js";

export const LINK_VERSION = "gleipnir/link/0.1";
const DOMAIN = "gleipnir/link/v0.1\n";

const TOP = new Set(["v", "id", "principal", "agent", "counterparty", "actions", "max_amount", "issued_at", "valid_until", "status_url", "signer", "sig"]);
const REQUIRED = ["v", "id", "principal", "agent", "actions", "issued_at", "valid_until", "signer", "sig"];
const TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const AMOUNT = /^(0|[1-9]\d{0,14})(\.\d{1,4})?$/;
const CURRENCY = /^[A-Z]{3}$/;
export const MAX_ACTIONS = 12;
/** Longest accepted fragment (characters of base64url). Keeps links usable in SMS, chat and email. */
export const MAX_ENCODED = 8000;

export type LinkStatus = "valid" | "expired" | "not_yet_valid" | "invalid_signature" | "malformed";

export interface LinkResult {
  status: LinkStatus;
  /** Why, in plain words, when the status is not "valid". */
  problem: string | null;
  link: JsonDict | null;
  hash: string | null;
  code: string | null;
  /** Fingerprint of the signer's key (k_ed25519_... or k_p256_...). */
  keyId: string | null;
}

// ---------- shape ----------

function str(x: unknown, max: number): x is string {
  return typeof x === "string" && x.trim().length > 0 && x.length <= max;
}

function closed(o: JsonDict, keys: readonly string[]): string | null {
  for (const k of Object.keys(o)) if (!keys.includes(k)) return `unknown field ${JSON.stringify(k)}`;
  return null;
}

/** Why this is not a well-formed link (signature not checked), or null. */
export function linkProblem(l: unknown): string | null {
  if (!isDict(l)) return "not a JSON object";
  for (const k of Object.keys(l)) if (!TOP.has(k)) return `unknown field ${JSON.stringify(k)}`;
  for (const k of REQUIRED) if (!(k in l)) return `missing ${k}`;
  if (l.v !== LINK_VERSION) return `unknown version ${JSON.stringify(l.v)}`;
  if (!str(l.id, 64)) return "id must be a short string";
  const p = l.principal;
  if (!isDict(p) || closed(p, ["name", "kind"]) || !str(p.name, 200)) return "principal must have a name";
  if (p.kind !== undefined && p.kind !== "person" && p.kind !== "company") return 'principal.kind must be "person" or "company"';
  const a = l.agent;
  if (!isDict(a) || closed(a, ["id", "name"]) || !str(a.id, 200)) return "agent must have an id";
  if (a.name !== undefined && !str(a.name, 200)) return "agent.name must be a short string";
  if (l.counterparty !== undefined && !str(l.counterparty, 200)) return "counterparty must be a short string";
  if (!Array.isArray(l.actions) || l.actions.length < 1 || l.actions.length > MAX_ACTIONS) return `actions must list 1 to ${MAX_ACTIONS} items`;
  if (!l.actions.every((x) => str(x, 300))) return "every action must be a non-empty string of at most 300 characters";
  if (l.max_amount !== undefined) {
    const m = l.max_amount;
    if (!isDict(m) || closed(m, ["amount", "currency"])) return "max_amount must be {amount, currency}";
    if (typeof m.amount !== "string" || !AMOUNT.test(m.amount)) return 'max_amount.amount must be a decimal string such as "200.00"';
    if (typeof m.currency !== "string" || !CURRENCY.test(m.currency)) return "max_amount.currency must be three capital letters";
  }
  if (typeof l.issued_at !== "string" || !TS.test(l.issued_at) || Number.isNaN(Date.parse(l.issued_at))) return "issued_at must be YYYY-MM-DDTHH:MM:SSZ";
  if (typeof l.valid_until !== "string" || !TS.test(l.valid_until) || Number.isNaN(Date.parse(l.valid_until))) return "valid_until must be YYYY-MM-DDTHH:MM:SSZ";
  if (Date.parse(l.valid_until) <= Date.parse(l.issued_at)) return "valid_until must be after issued_at";
  if (l.status_url !== undefined) {
    if (typeof l.status_url !== "string" || l.status_url.length > 2048 || !/^https:\/\/[\x21-\x7e]+$/.test(l.status_url)) {
      return "status_url must be an https:// URL";
    }
  }
  const s = l.signer;
  if (!isDict(s) || closed(s, ["public_key", "rp_id", "origin"])) return "signer must be {public_key, rp_id?, origin?}";
  if (typeof s.public_key !== "string") return "signer.public_key missing";
  try {
    decodePublicKey(s.public_key);
  } catch {
    return "signer.public_key is not an ed25519 or ecdsa-p256 key";
  }
  if (s.public_key.startsWith("ecdsa-p256:")) {
    if (!str(s.rp_id, 253) || !str(s.origin, 300)) return "a passkey signer needs rp_id and origin";
    if (!isDict(l.sig)) return "a passkey signature must be a WebAuthn object";
  } else {
    if (s.rp_id !== undefined || s.origin !== undefined) return "rp_id and origin are only for passkey signers";
    if (typeof l.sig !== "string") return "an ed25519 signature must be a string";
  }
  return null;
}

// ---------- hashing and signing ----------

function withoutSig(l: JsonDict): JsonDict {
  const out: JsonDict = {};
  for (const k of Object.keys(l)) if (k !== "sig") out[k] = l[k];
  return out;
}

/** sha256 over the JCS encoding of the link without `sig`. */
export function linkHash(l: JsonDict): string {
  return sha256Tagged(canonicalize(withoutSig(l)));
}

/** The exact bytes an ed25519 link signature covers. */
export function linkMessage(l: JsonDict): Uint8Array {
  return concatBytes(utf8(DOMAIN), utf8(linkHash(l)));
}

/** What a passkey signs: SHA-256 of the link message, "sha256:<hex>". The WebAuthn challenge is its 32 bytes. */
export function linkPasskeyDigest(l: JsonDict): string {
  return sha256Tagged(linkMessage(l));
}

export function linkPasskeyChallenge(l: JsonDict): Uint8Array {
  return hashToBytes(linkPasskeyDigest(l));
}

/** "3F9 A21": the first 6 hex characters of the hash, to read out on a call. Not a security check. */
export function linkCode(hash: string): string {
  const hex = hash.slice("sha256:".length, "sha256:".length + 6).toUpperCase();
  return `${hex.slice(0, 3)} ${hex.slice(3)}`;
}

export interface DraftOptions {
  principal: { name: string; kind?: "person" | "company" };
  agent: { id: string; name?: string };
  counterparty?: string;
  actions: string[];
  maxAmount?: { amount: string; currency: string };
  validUntil: string;
  statusUrl?: string;
  issuedAt?: string;
  id?: string;
  signer: { public_key: string; rp_id?: string; origin?: string };
}

/** Seconds precision, "Z". */
export function isoSeconds(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** An unsigned link. Empty optional fields are left out. */
export function draftLink(o: DraftOptions): JsonDict {
  const l: JsonDict = {
    v: LINK_VERSION,
    id: o.id ?? "l_" + bytesToHex(globalThis.crypto.getRandomValues(new Uint8Array(10))),
    principal: o.principal.kind ? { name: o.principal.name.trim(), kind: o.principal.kind } : { name: o.principal.name.trim() },
    agent: o.agent.name?.trim() ? { id: o.agent.id.trim(), name: o.agent.name.trim() } : { id: o.agent.id.trim() },
  };
  if (o.counterparty?.trim()) l.counterparty = o.counterparty.trim();
  l.actions = o.actions.map((a) => a.trim()).filter(Boolean);
  if (o.maxAmount?.amount) l.max_amount = { amount: o.maxAmount.amount.trim(), currency: o.maxAmount.currency.trim().toUpperCase() };
  l.issued_at = o.issuedAt ?? isoSeconds(new Date());
  l.valid_until = o.validUntil;
  if (o.statusUrl?.trim()) l.status_url = o.statusUrl.trim();
  l.signer = o.signer;
  return l;
}

/** Sign a draft with an Ed25519 seed (32 bytes). Sets signer.public_key to match. */
export function signLinkEd25519(draft: JsonDict, seed: Uint8Array): JsonDict {
  const l = withoutSig({ ...draft, signer: { public_key: encodePublicKey(ed25519PublicFromSeed(seed)) } });
  l.sig = "ed25519:" + b64uEncode(ed25519Sign(seed, linkMessage(l)));
  return l;
}

// ---------- encoding ----------

/** The URL fragment: base64url of the JCS bytes of the signed link. */
export function encodeLink(l: JsonDict): string {
  return b64uEncode(canonicalize(l));
}

/** Parse a fragment (or a whole URL with one). Throws with a plain reason. */
export function decodeLink(text: string): unknown {
  let frag = text.trim();
  const hash = frag.indexOf("#");
  if (hash >= 0) frag = frag.slice(hash + 1);
  if (!frag) throw new Error("the link has no mandate in it (nothing after #)");
  if (frag.length > MAX_ENCODED) throw new Error("the link is too long");
  let bytes: Uint8Array;
  try {
    bytes = b64uDecode(frag);
  } catch {
    throw new Error("the link is damaged (not base64url)");
  }
  let text2: string;
  try {
    text2 = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("the link is damaged (not UTF-8)");
  }
  try {
    return parseStrict(text2);
  } catch (exc) {
    throw new Error(`the link is damaged (${exc instanceof Error ? exc.message : String(exc)})`);
  }
}

// ---------- verification ----------

/** Why the signature does not hold, or null when it does. The link must be well formed. */
export function signatureProblem(l: JsonDict): string | null {
  const s = l.signer as JsonDict;
  const pub = decodePublicKey(s.public_key);
  if (pub instanceof Uint8Array) {
    return verifySignature(pub, linkMessage(l), l.sig) ? null : "the signature does not match the content";
  }
  const origin = s.origin as string;
  const rpId = s.rp_id as string;
  let host: string;
  try {
    host = new URL(origin).hostname;
  } catch {
    return "signer.origin is not a URL";
  }
  if (host !== rpId && !host.endsWith("." + rpId)) return "signer.origin is not on the passkey's domain";
  const problem = webauthnProblem(l.sig as JsonDict, pub, linkPasskeyDigest(l), rpId, [origin], null);
  return problem ? `the passkey signature does not hold: ${problem}` : null;
}

/** Check a link (parsed, or the fragment text) at `now`. Never throws. Revocation is checked separately. */
export function verifyLink(input: unknown, now: Date = new Date()): LinkResult {
  const out: LinkResult = { status: "malformed", problem: null, link: null, hash: null, code: null, keyId: null };
  let l: unknown = input;
  if (typeof input === "string") {
    try {
      l = decodeLink(input);
    } catch (exc) {
      out.problem = exc instanceof Error ? exc.message : String(exc);
      return out;
    }
  }
  const shape = linkProblem(l);
  if (shape) {
    out.problem = `not a valid mandate link: ${shape}`;
    return out;
  }
  const link = l as JsonDict;
  out.link = link;
  try {
    out.hash = linkHash(link);
    out.code = linkCode(out.hash);
    out.keyId = keyId(decodePublicKey((link.signer as JsonDict).public_key));
    const bad = signatureProblem(link);
    if (bad) {
      out.status = "invalid_signature";
      out.problem = bad;
      return out;
    }
  } catch (exc) {
    out.status = "invalid_signature";
    out.problem = exc instanceof Error ? exc.message : String(exc);
    return out;
  }
  const t = now.getTime();
  if (t > Date.parse(link.valid_until as string)) {
    out.status = "expired";
    out.problem = "the validity period has ended";
  } else if (t + 5 * 60_000 < Date.parse(link.issued_at as string)) {
    out.status = "not_yet_valid";
    out.problem = "issued in the future: check the clock of the device that signed it";
  } else {
    out.status = "valid";
  }
  return out;
}

/** Reads a status_url answer: "active", "revoked", or null when it is not one of those. */
export function readStatus(body: unknown): "active" | "revoked" | null {
  if (!isDict(body)) return null;
  return body.status === "active" || body.status === "revoked" ? body.status : null;
}

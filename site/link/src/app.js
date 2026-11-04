// Mandate link, signing side (EXPERIMENTAL, docs/mandate-link.md): a person or company says what an AI agent may
// do on their behalf, signs it with a passkey or with a non-extractable key kept in this browser, and gets a link
// whose fragment carries the signed mandate. No backend: nothing is sent anywhere.
// Built into site/link/link.js by `npm run build:site` in typescript/ (an external script, so the page works
// under script-src 'self').

import { b64uDecode, b64uEncode } from "../../../typescript/packages/verify/src/bytes.js";
import { encodeP256PublicKey } from "../../../typescript/packages/verify/src/crypto.js";
import {
  attachP256Signature, draftLink, encodeLink, hasHiddenCharacters, linkCode, linkHash, linkMessage, linkPasskeyChallenge,
  lowSDer, MAX_ACTIONS, MAX_ENCODED, statusUrlProblem, verifyLink,
} from "../../../typescript/packages/verify/src/link.ts";

const $ = (id) => document.getElementById(id);
const els = {
  principal: $("principal"), agentId: $("agent-id"), agentName: $("agent-name"), counterparty: $("counterparty"),
  actions: $("actions"), amount: $("amount"), currency: $("currency"), until: $("until"), statusUrl: $("status-url"),
  signPasskey: $("sign-passkey"), signDevice: $("sign-device"), status: $("status"), done: $("done"), code: $("code"),
  link: $("link"), copy: $("copy"), open: $("open"), json: $("json"), keyNote: $("key-note"),
};

const PASSKEY = "gleipnir-link-passkey";
const load = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const save = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* per-device convenience only */
  }
};
// An earlier version kept an Ed25519 seed here in plain text: remove it.
try {
  localStorage.removeItem("gleipnir-link-device-key");
} catch {
  /* nothing stored */
}

function say(text, kind = "") {
  els.status.textContent = text;
  els.status.className = `status ${kind}`;
}

const AMOUNT = /^(0|[1-9]\d{0,14})(\.\d{1,4})?$/;

/** The unsigned mandate from the form, or null with the reason shown. */
function readForm(signer) {
  const principal = els.principal.value.trim();
  const agentId = els.agentId.value.trim();
  const actions = els.actions.value.split("\n").map((s) => s.trim()).filter(Boolean);
  const amount = els.amount.value.trim().replace(/,/g, "");
  const currency = els.currency.value.trim().toUpperCase();
  const until = els.until.value;
  const statusUrl = els.statusUrl.value.trim();
  const texts = [[principal, els.principal], [agentId, els.agentId], [els.agentName.value, els.agentName],
    [els.counterparty.value, els.counterparty], ...actions.map((a) => [a, els.actions])];
  const hidden = texts.find(([t]) => hasHiddenCharacters(t));
  const problem =
    !principal ? ["Fill in who the agent acts for.", els.principal]
    : !agentId ? ["Fill in the agent id.", els.agentId]
    : !actions.length ? ["List at least one allowed action.", els.actions]
    : actions.length > MAX_ACTIONS ? [`At most ${MAX_ACTIONS} actions.`, els.actions]
    : actions.some((a) => a.length > 300) ? ["Keep each action under 300 characters.", els.actions]
    : hidden ? ["Remove invisible or control characters (often pasted along with text).", hidden[1]]
    : amount && !AMOUNT.test(amount) ? ["Write the amount as digits, like 200 or 200.00.", els.amount]
    : amount && !/^[A-Z]{3}$/.test(currency) ? ["Give the currency as a three-letter code, like USD or EUR.", els.currency]
    : !/^\d{4}-\d{2}-\d{2}$/.test(until) ? ["Choose the date until which the mandate is valid.", els.until]
    : `${until}T23:59:59Z` < new Date().toISOString() ? ["The date is in the past.", els.until]
    : statusUrl && statusUrlProblem(statusUrl) ? [`Status URL: ${statusUrlProblem(statusUrl).replace(/^status_url /, "it ")}.`, els.statusUrl]
    : null;
  if (problem) {
    say(problem[0], "bad");
    problem[1].focus();
    return null;
  }
  return draftLink({
    principal: { name: principal, kind: document.querySelector('input[name="kind"]:checked')?.value || "person" },
    agent: { id: agentId, name: els.agentName.value },
    counterparty: els.counterparty.value,
    actions,
    maxAmount: amount ? { amount, currency } : undefined,
    validUntil: `${until}T23:59:59Z`,
    statusUrl,
    signer,
  });
}

/** Where the check page lives: site/link/v/ next to this page. */
function checkUrl(fragment) {
  const base = new URL(location.href);
  base.hash = "";
  base.search = "";
  if (!base.pathname.endsWith("/") && !base.pathname.endsWith(".html")) base.pathname += "/";
  const page = location.protocol === "file:" ? "v/index.html" : "v/";
  return new URL(page, base).href + "#" + fragment;
}

function finish(signed, note) {
  const check = verifyLink(signed);
  if (check.status !== "valid") return say(`Signing went wrong: ${check.problem}. Nothing was produced.`, "bad");
  const fragment = encodeLink(signed);
  if (fragment.length > MAX_ENCODED) return say("The mandate is too long for a link. Shorten the actions.", "bad");
  const url = checkUrl(fragment);
  els.code.textContent = linkCode(linkHash(signed));
  els.link.value = url;
  els.open.href = url;
  els.json.value = JSON.stringify(signed, null, 2);
  els.keyNote.textContent = `${note} Key fingerprint ${check.keyId}.`;
  els.copy.textContent = "Copy";
  els.done.hidden = false;
  say("Signed. Nothing was sent: copy the link below.", "ok");
  els.done.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- device key: non-extractable P-256 in IndexedDB ----------

function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("gleipnir-link", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("keys");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbDo(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("keys", mode);
    const req = fn(tx.objectStore("keys"));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
  });
}

/** This browser's signing key: {pair, saved}. The private key cannot be exported, even by this page. */
async function deviceKey() {
  let db = null;
  try {
    db = await idb();
    const pair = await idbDo(db, "readonly", (s) => s.get("device"));
    if (pair && pair.privateKey && pair.publicKey) return { pair, saved: true };
  } catch {
    db = null;
  }
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
  let saved = false;
  if (db) {
    try {
      await idbDo(db, "readwrite", (s) => s.put(pair, "device"));
      saved = true;
    } catch {
      saved = false;
    }
  }
  return { pair, saved };
}

async function signDevice() {
  if (!readForm({ public_key: "" })) return;
  els.signDevice.disabled = true;
  try {
    const { pair, saved } = await deviceKey();
    const spki = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));
    const draft = readForm({ public_key: encodeP256PublicKey(spki) });
    if (!draft) return;
    const raw = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, linkMessage(draft)));
    finish(attachP256Signature(draft, raw), saved
      ? "Signed with a P-256 key kept in this browser (it cannot be copied out). Clearing site data deletes it; links already signed stay valid."
      : "Signed with a one-time key: this browser does not let the page store keys, so the next link will show a different key.");
  } catch (exc) {
    say(`Not signed: ${exc && exc.message ? exc.message : exc}`, "bad");
  } finally {
    els.signDevice.disabled = false;
  }
}

// ---------- passkey ----------

async function passkey(rpId) {
  try {
    const p = JSON.parse(load(PASSKEY) || "null");
    if (p && p.rpId === rpId && p.publicKey && p.credentialId) return p;
  } catch {
    /* make a new one */
  }
  const id = crypto.getRandomValues(new Uint8Array(16));
  const name = els.principal.value.trim() || "Mandate link signer";
  const cred = await navigator.credentials.create({
    publicKey: {
      rp: { id: rpId, name: "Gleipnir mandate links" },
      user: { id, name, displayName: name },
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      pubKeyCredParams: [{ type: "public-key", alg: -7 }], // ES256 only
      authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
      attestation: "none",
    },
  });
  const spki = cred.response.getPublicKey && cred.response.getPublicKey();
  if (!spki) throw new Error("this browser does not expose the new passkey's public key. Try a current browser, or sign with a key on this device");
  const p = { rpId, publicKey: encodeP256PublicKey(new Uint8Array(spki)), credentialId: b64uEncode(new Uint8Array(cred.rawId)) };
  save(PASSKEY, JSON.stringify(p));
  return p;
}

async function signPasskey() {
  if (!readForm({ public_key: "" })) return;
  const rpId = location.hostname;
  els.signPasskey.disabled = true;
  try {
    const p = await passkey(rpId);
    const draft = readForm({ public_key: p.publicKey, rp_id: rpId, origin: location.origin });
    if (!draft) return;
    const cred = await navigator.credentials.get({
      publicKey: {
        challenge: linkPasskeyChallenge(draft), rpId, userVerification: "required", timeout: 120000,
        allowCredentials: [{ type: "public-key", id: b64uDecode(p.credentialId) }],
      },
    });
    const r = cred.response;
    const signed = {
      ...draft,
      sig: {
        type: "webauthn",
        credential_id: b64uEncode(new Uint8Array(cred.rawId)),
        authenticator_data: b64uEncode(new Uint8Array(r.authenticatorData)),
        client_data_json: b64uEncode(new Uint8Array(r.clientDataJSON)),
        // Links accept only low-S signatures; (r, n - s) is the same signature in that form.
        signature: b64uEncode(lowSDer(new Uint8Array(r.signature), "der")),
      },
    };
    finish(signed, `Signed with a passkey for ${rpId}.`);
  } catch (exc) {
    say(`Not signed: ${exc && exc.message ? exc.message : exc}`, "bad");
  } finally {
    els.signPasskey.disabled = false;
  }
}

els.signDevice.addEventListener("click", signDevice);
els.signPasskey.addEventListener("click", signPasskey);
els.copy.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(els.link.value);
    els.copy.textContent = "Copied";
  } catch {
    els.link.select();
    els.copy.textContent = "Select and copy";
  }
});
document.getElementById("form").addEventListener("submit", (e) => e.preventDefault());

const d = new Date(Date.now() + 30 * 86400_000);
els.until.value = d.toISOString().slice(0, 10);
els.until.min = new Date().toISOString().slice(0, 10);

if (!window.PublicKeyCredential || !window.isSecureContext || !location.hostname) {
  els.signPasskey.disabled = true;
  els.signPasskey.title = "Passkeys need https (or localhost) in a current browser";
  els.signDevice.classList.add("primary");
  els.signPasskey.classList.remove("primary");
}
if (!window.isSecureContext || !crypto.subtle) {
  els.signDevice.disabled = true;
  els.signDevice.title = "Signing needs https (or localhost)";
}

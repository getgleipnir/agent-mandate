// Mandate link, checking side (EXPERIMENTAL, docs/mandate-link.md): the third party an AI agent contacts opens the
// link and sees who signed, for which agent, what is allowed, until when, and whether the signature holds.
// Everything is checked in this browser. The only request it may make is to the mandate's own status_url.
// Built into index.html by `npm run build:site` in typescript/.

import { readStatus, verifyLink } from "../../../../typescript/packages/verify/src/link.ts";

const $ = (id) => document.getElementById(id);
const els = {
  paste: $("paste"), input: $("input"), check: $("check"), result: $("result"), verdict: $("verdict"), word: $("word"),
  why: $("why"), codebox: $("codebox"), code: $("code"), codeHint: $("code-hint"), untrusted: $("untrusted"),
  facts: $("facts"), wrap: $("facts-wrap"), raw: $("raw"),
};

/** "31 Dec 2026, 23:59 UTC" */
function when(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return `${date}, ${time} UTC`;
}

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const c of children) e.append(c);
  return e;
}

function row(label, value, cls = "") {
  return el("tr", {}, el("th", { scope: "row" }, label), el("td", cls ? { class: cls } : {}, value));
}

function sub(text) {
  return el("span", { class: "sub" }, text);
}

function tag(text, kind) {
  return el("span", { class: `tag ${kind}` }, text);
}

const VERDICTS = {
  valid: ["Valid", "valid", "The signature holds and the mandate is in date."],
  expired: ["Expired", "bad", ""],
  not_yet_valid: ["Not yet valid", "warn", ""],
  invalid_signature: ["Invalid signature", "bad", "The content was changed after signing, or the signature is not genuine. Do not act on it."],
  malformed: ["Not a valid link", "bad", ""],
  revoked: ["Revoked", "bad", "The signer has withdrawn this mandate. Do not act on it."],
};

function setVerdict(key, why) {
  const [word, cls, text] = VERDICTS[key];
  els.word.textContent = word;
  els.why.textContent = why || text;
  els.verdict.className = `verdict ${cls}`;
  els.verdict.dataset.status = key;
  document.title = `${word}: agent mandate check`;
}

let run = 0;

async function show(fragment) {
  const mine = ++run;
  els.paste.hidden = true;
  els.result.hidden = false;
  const r = verifyLink(fragment, new Date());
  els.raw.textContent = r.link ? JSON.stringify(r.link, null, 2) : r.problem || "";
  if (!r.link) {
    setVerdict("malformed", `This is not a mandate link: ${r.problem}.`);
    els.codebox.hidden = true;
    els.codeHint.hidden = true;
    els.untrusted.hidden = true;
    els.wrap.hidden = true;
    els.paste.hidden = false;
    return;
  }
  const l = r.link;
  // A code from content the signature does not cover must not be matched against what the agent says.
  els.codebox.hidden = r.status === "invalid_signature";
  els.codeHint.hidden = r.status === "invalid_signature";
  els.wrap.hidden = false;
  els.code.textContent = r.code;
  els.untrusted.hidden = r.status !== "invalid_signature";
  els.result.classList.toggle("untrusted", r.status === "invalid_signature");
  setVerdict(r.status,
    r.status === "expired" ? `Ended ${when(l.valid_until)}. Do not act on it.`
    : r.status === "not_yet_valid" ? `Issued ${when(l.issued_at)}, which is in the future. Do not act on it yet.`
    : "");

  const passkey = String(l.signer.public_key).startsWith("ecdsa-p256:");
  const revocation = el("td", {}, l.status_url ? tag("Checking…", "none") : tag("Not configured", "none"),
    sub(l.status_url ? l.status_url : "The signer cannot withdraw this link before it expires."));
  revocation.id = "revocation";
  els.facts.replaceChildren(
    row("On behalf of", el("span", {}, l.principal.name,
      sub(`${l.principal.kind === "company" ? "Company" : l.principal.kind === "person" ? "Person" : "Person or company"}, as named by the signer. Identity not verified by this check.`)), "big"),
    row("Agent", el("span", {}, l.agent.name || l.agent.id, l.agent.name ? sub(`id ${l.agent.id}`) : ""), "big"),
    row("Toward", l.counterparty || "Anyone"),
    row("May", el("ul", {}, ...l.actions.map((a) => el("li", {}, a)))),
    row("Amount limit", l.max_amount ? `Up to ${l.max_amount.amount} ${l.max_amount.currency}` : "None stated"),
    row("Valid until", el("span", {}, when(l.valid_until), sub(`Signed ${when(l.issued_at)}`))),
    el("tr", {}, el("th", { scope: "row" }, "Revocation"), revocation),
    row("Signing key", el("span", {}, el("span", { class: "mono" }, r.keyId),
      sub(passkey ? `Passkey for ${l.signer.rp_id}. Not enrolled with a bank or identity provider.`
        : "Key kept in the signer's browser. Not enrolled with a bank or identity provider."))),
  );

  if (!l.status_url || r.status === "invalid_signature") {
    if (l.status_url) revocation.replaceChildren(tag("Not checked", "none"), sub(l.status_url));
    return;
  }
  const s = await fetchStatus(l.status_url);
  if (mine !== run) return;
  if (s === "revoked") {
    revocation.replaceChildren(tag("Revoked", "bad"), sub(l.status_url));
    if (r.status === "valid") setVerdict("revoked");
  } else if (s === "active") {
    revocation.replaceChildren(tag("Not revoked", "ok"), sub(`${l.status_url}, checked ${when(new Date().toISOString())}`));
  } else {
    revocation.replaceChildren(tag("Could not check", "warn"), sub(`${l.status_url}: ${s}`));
    if (r.status === "valid") els.why.textContent = "The signature holds and the mandate is in date, but revocation could not be checked.";
  }
}

/** "active", "revoked", or why the status is unknown. https only, no cookies, no redirects, 5 s deadline, 4 KiB. */
async function fetchStatus(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 5000);
  try {
    const res = await fetch(url, {
      cache: "no-store", credentials: "omit", redirect: "error", referrerPolicy: "no-referrer", signal: ctl.signal,
    });
    if (!res.ok) return `the server answered ${res.status}`;
    const text = await res.text();
    if (text.length > 4096) return "the answer is too large";
    const s = readStatus(JSON.parse(text));
    return s ?? "the answer is not {\"status\": \"active\" | \"revoked\"}";
  } catch (exc) {
    return ctl.signal.aborted ? "no answer within 5 seconds" : "the request failed (offline, blocked, or the server does not allow it)";
  } finally {
    clearTimeout(timer);
  }
}

function fromLocation() {
  const frag = location.hash.slice(1);
  if (frag) show(frag);
  else {
    els.result.hidden = true;
    els.paste.hidden = false;
  }
}

els.check.addEventListener("click", () => {
  const text = els.input.value.trim();
  if (text) show(text);
});
window.addEventListener("hashchange", fromLocation);
fromLocation();

// Mandate link, checking side (EXPERIMENTAL, docs/mandate-link.md): the third party an AI agent contacts opens the
// link and sees what the signer allowed, whether the signature holds, and whether the mandate is in date and not
// revoked. Everything is checked in this browser. The only request it may make is to the mandate's own status_url.
// Built into site/link/v/check.js by `npm run build:site` in typescript/ (an external script, so the page works
// under script-src 'self').

import { readStatus, statusUrlProblem, textWarning, verifyLink } from "../../../../typescript/packages/verify/src/link.ts";

const $ = (id) => document.getElementById(id);
const els = {
  paste: $("paste"), input: $("input"), check: $("check"), result: $("result"), verdict: $("verdict"), word: $("word"),
  second: $("second"), why: $("why"), codebox: $("codebox"), code: $("code"), codeHint: $("code-hint"),
  untrusted: $("untrusted"), showAnyway: $("show-anyway"), facts: $("facts"), wrap: $("facts-wrap"), raw: $("raw"),
};

/** "31 Dec 2026, 23:59 UTC" */
function utc(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return `${date}, ${time} UTC`;
}

/** The same instant in this viewer's time zone. */
function local(ts) {
  const d = new Date(ts);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "local time";
  return `${d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} your time (${zone})`;
}

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const c of children) if (c !== null && c !== undefined && c !== "") e.append(c);
  return e;
}

/** Text the signer typed: isolated from the page's text direction, with a warning when it can deceive. */
function typed(text, warn = true) {
  const w = warn ? textWarning(text) : null;
  return el("span", {}, el("span", { dir: "auto" }, text), w ? el("span", { class: "warnline" }, `Check this: it ${w}.`) : null);
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

const SIGNED_BY_ANYONE = "The mandate is unchanged since signing and in date. The name was typed by the signer: confirm the person's identity as you normally would.";

const VERDICTS = {
  checking: ["Checking…", "checking", "Signature valid. Asking the status server whether the mandate was revoked."],
  valid: ["Signature valid", "neutral", SIGNED_BY_ANYONE],
  unconfirmed: ["Could not confirm revocation", "warn", ""],
  expired: ["Expired", "grey", ""],
  not_yet_valid: ["Not yet valid", "warn", ""],
  invalid_signature: ["Invalid signature", "bad", "The content was changed after signing, or the signature is not genuine. Do not act on it."],
  malformed: ["Not a valid link", "bad", ""],
  revoked: ["Revoked", "revoked", "The signer has withdrawn this mandate. Do not act on it."],
};

function setVerdict(key, why) {
  const [word, cls, text] = VERDICTS[key];
  els.word.textContent = word;
  els.why.textContent = why || text;
  els.verdict.className = `verdict ${cls}`;
  els.verdict.dataset.status = key;
  // Every signature that holds comes from a key nobody has vouched for yet: say so next to the verdict.
  els.second.hidden = !["valid", "checking", "unconfirmed"].includes(key);
  document.title = `${word}: agent mandate check`;
}

let run = 0;

function reset() {
  els.result.classList.remove("untrusted");
  els.untrusted.hidden = true;
  els.showAnyway.hidden = true;
  els.showAnyway.setAttribute("aria-expanded", "false");
  els.showAnyway.textContent = "Show contents anyway";
  els.wrap.hidden = false;
  els.codebox.hidden = false;
  els.codeHint.hidden = false;
  els.facts.replaceChildren();
}

async function show(fragment) {
  const mine = ++run;
  reset();
  els.paste.hidden = true;
  els.result.hidden = false;
  const r = verifyLink(fragment, new Date());
  els.raw.textContent = r.link ? JSON.stringify(r.link, null, 2) : r.problem || "";
  if (!r.link) {
    setVerdict("malformed", `This is not a mandate link: ${r.problem}.`);
    els.codebox.hidden = true;
    els.codeHint.hidden = true;
    els.wrap.hidden = true;
    els.paste.hidden = false;
    return;
  }
  const l = r.link;
  const invalid = r.status === "invalid_signature";
  // A code from content the signature does not cover must not be matched against what the agent says.
  els.codebox.hidden = invalid;
  els.codeHint.hidden = invalid;
  els.code.textContent = r.code;
  if (invalid) {
    els.result.classList.add("untrusted");
    els.untrusted.hidden = false;
    els.showAnyway.hidden = false;
    els.wrap.hidden = true;
  }
  const pending = r.status === "valid" && l.status_url;
  setVerdict(pending ? "checking" : r.status,
    r.status === "expired" ? `Ended ${utc(l.valid_until)}. Do not act on it.`
    : r.status === "not_yet_valid" ? `Issued ${utc(l.issued_at)}, which is in the future. Do not act on it yet.`
    : "");

  const passkey = typeof l.sig === "object";
  const revocation = el("td", {}, l.status_url ? tag("Checking…", "none") : tag("Not configured", "none"),
    sub(l.status_url ? l.status_url : "The signer cannot withdraw this link before it expires."));
  revocation.id = "revocation";
  const kind = l.principal.kind === "company" ? "Company" : l.principal.kind === "person" ? "Person" : "Person or company";
  els.facts.replaceChildren(
    row("On behalf of", el("span", {}, typed(l.principal.name), sub(`${kind}, as typed by the signer. Not verified.`)), "big"),
    row("Agent", el("span", {}, typed(l.agent.name || l.agent.id), l.agent.name ? el("span", { class: "sub" }, "id ", typed(l.agent.id)) : null), "big"),
    row("Toward", l.counterparty ? typed(l.counterparty) : "Anyone"),
    row("May", el("ul", {}, ...l.actions.map((a) => el("li", { dir: "auto" }, a)))),
    row("Amount limit", l.max_amount ? `Up to ${l.max_amount.amount} ${l.max_amount.currency}` : "None stated"),
    row("Valid until", el("span", {}, utc(l.valid_until), sub(local(l.valid_until)), sub(`Signed ${utc(l.issued_at)}`))),
    el("tr", {}, el("th", { scope: "row" }, "Revocation"), revocation),
    row("Signing key", el("span", {}, el("span", { class: "mono" }, r.keyId),
      sub(passkey ? "Passkey (not enrolled)." : "Device key (not enrolled)."),
      passkey ? el("span", { class: "sub" }, "Domain declared by the signer, not verified: ", typed(l.signer.rp_id, false)) : null)),
  );

  if (!l.status_url) return;
  if (r.status !== "valid") {
    revocation.replaceChildren(tag("Not checked", "none"), sub(l.status_url));
    return;
  }
  const s = await fetchStatus(l.status_url);
  if (mine !== run) return;
  if (s === "revoked") {
    revocation.replaceChildren(tag("Revoked", "bad"), sub(l.status_url));
    setVerdict("revoked");
  } else if (s === "active") {
    revocation.replaceChildren(tag("Not revoked", "ok"), sub(`${l.status_url}, checked ${utc(new Date().toISOString())}`));
    setVerdict("valid");
  } else {
    revocation.replaceChildren(tag("Could not check", "warn"), sub(`${l.status_url}: ${s}`));
    setVerdict("unconfirmed", `The signature is valid and in date, but the status server gave no usable answer (${s}). The mandate may have been withdrawn. Do not rely on it.`);
  }
}

const MAX_STATUS = 4096;

/** At most `max` bytes of the body; throws when there are more. */
async function readCapped(res, max) {
  const reader = res.body.getReader();
  const chunks = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.length;
    if (n > max) {
      reader.cancel().catch(() => {});
      throw new Error("too large");
    }
    chunks.push(value);
  }
  const all = new Uint8Array(n);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.length;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(all);
}

/** "active", "revoked", or why the status is unknown. Public https only, no cookies, no redirects, 5 s, 4 KiB. */
async function fetchStatus(url) {
  const bad = statusUrlProblem(url);
  if (bad) return bad;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 5000);
  try {
    const res = await fetch(url, {
      cache: "no-store", credentials: "omit", redirect: "error", referrerPolicy: "no-referrer", signal: ctl.signal,
    });
    if (!res.ok) return `the server answered ${res.status}`;
    let text;
    try {
      text = await readCapped(res, MAX_STATUS);
    } catch (exc) {
      if (ctl.signal.aborted) throw exc;
      return "the answer is too large or not UTF-8";
    }
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return "the answer is not JSON";
    }
    return readStatus(body) ?? "the answer is not {\"status\": \"active\" | \"revoked\"}";
  } catch {
    return ctl.signal.aborted ? "no answer within 5 seconds" : "the request failed: offline, blocked, or the server does not allow it";
  } finally {
    clearTimeout(timer);
  }
}

function fromLocation() {
  const frag = location.hash.slice(1);
  if (frag) show(frag);
  else {
    run++;
    els.result.hidden = true;
    els.paste.hidden = false;
  }
}

els.check.addEventListener("click", () => {
  const text = els.input.value.trim();
  if (text) show(text);
});
els.showAnyway.addEventListener("click", () => {
  const open = els.wrap.hidden;
  els.wrap.hidden = !open;
  els.showAnyway.setAttribute("aria-expanded", String(open));
  els.showAnyway.textContent = open ? "Hide contents" : "Show contents anyway";
});
window.addEventListener("hashchange", fromLocation);
fromLocation();

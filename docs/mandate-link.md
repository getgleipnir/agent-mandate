# Mandate links (EXPERIMENTAL)

> **Experimental.** `gleipnir/link/0.1` is a prototype format. It may change or be dropped without notice, it is
> not part of the payment mandate spec ([spec/mandate.md](../spec/mandate.md)), and no checker conformance applies
> to it. Do not build production systems on it yet.

An AI agent acts for a person or a company toward a third party: it calls a debt collector, an insurer, a bank's
call centre. The third party needs to know, in seconds, who sent the agent and what it may do. A mandate link is
a signed statement of that scope, carried whole in a URL:

```
https://getgleipnir.com/link/v/#eyJhY3Rpb25zIjpbIkRpc2N1c3MgbXkgYWNjb3VudCIsIC4uLl0sIC4uLn0
```

The person signs on [site/link](../site/link/index.html) and gives the link to the agent. The agent passes the link
(by message, email or a tool call) and reads out the short code. The third party opens the link; the page
([site/link/v](../site/link/v/index.html)) checks the signature in the browser and shows the verdict (see
[Status shown](#status-shown)), with the code to match.

There is no server. The fragment (after `#`) is not sent to the web server that serves the check page.

## Fields

```json
{
  "v": "gleipnir/link/0.1",
  "id": "l_4f1c0a9e2b7d3c18e5a6",
  "principal": { "name": "Jane Doe", "kind": "person" },
  "agent": { "id": "+1 555 0100 / acme-assistant", "name": "Acme Assistant" },
  "counterparty": "Midwest Recovery Services",
  "actions": ["Discuss my account", "Agree to a payment plan up to $200/month"],
  "max_amount": { "amount": "200.00", "currency": "USD" },
  "issued_at": "2026-11-04T10:00:00Z",
  "valid_until": "2026-12-31T23:59:59Z",
  "status_url": "https://status.example.com/links/l_4f1c0a9e2b7d3c18e5a6",
  "signer": { "public_key": "ecdsa-p256:…" },
  "sig": "ecdsa-p256:…"
}
```

| Field | Required | Meaning |
|---|---|---|
| `v` | yes | `"gleipnir/link/0.1"` |
| `id` | yes | Random id chosen by the signer: 1 to 64 of `A-Z a-z 0-9 _ . -`. Also what a status service keys on. |
| `principal.name` | yes | Who the agent acts for, as the signer typed it. At most 200 characters. |
| `principal.kind` | no | `"person"` or `"company"` |
| `agent.id` | yes | How the agent identifies itself (account, phone number, client id). At most 200 characters. |
| `agent.name` | no | Display name. At most 200 characters. |
| `counterparty` | no | Toward whom. Absent means anyone. At most 200 characters. |
| `actions` | yes | 1 to 12 free-text lines, each at most 300 characters. Not machine-checked: a person reads them. |
| `max_amount` | no | `{amount, currency}`: decimal string (`"200.00"`, never a JSON number) and ISO 4217 code. |
| `issued_at`, `valid_until` | yes | `YYYY-MM-DDTHH:MM:SSZ`, a real calendar date and time (no `2026-02-30`, no `24:00:00`, no leap second); `valid_until` after `issued_at`. The signing page sets `valid_until` to 23:59:59 UTC of the chosen day. |
| `status_url` | no | See [Revocation](#revocation). |
| `signer.public_key` | yes | `ed25519:<b64url 32 bytes>` or `ecdsa-p256:<b64url DER SPKI>` (same encoding as the rest of Gleipnir). |
| `signer.rp_id`, `signer.origin` | passkeys only | The passkey's relying party id and the origin of the page that signed. **Declared by the signer, not verified:** see [Signature](#signature). |
| `sig` | yes | See [Signature](#signature). |

All text fields (`principal`, `agent`, `counterparty`, `actions`) must be a single line without control or format
characters (Unicode categories Cc and Cf: bidi overrides and isolates, zero-width characters, the byte order mark)
and without U+2028/U+2029. Unknown fields at any level (including inside a WebAuthn `sig`), missing required
fields, duplicate JSON keys and non-integer numbers are refused (the strict parsing of spec section 13, via
`parseStrict`). The whole fragment is at most 8000 base64url characters: 12 actions of 300 ASCII characters fit, the
same in a script that takes 3 bytes per character in UTF-8 does not.

## Canonicalisation and hash

`hash = "sha256:" + hex(SHA-256(JCS(link without "sig")))`, JCS being RFC 8785, the same canonical JSON the rest of
Gleipnir uses. Key order and whitespace in the link do not matter; leaving out or adding any field does.

The URL fragment is `base64url(JCS(signed link))`, without padding. Verifiers decode it as UTF-8 and parse it
strictly; they recompute the hash, so they do not depend on the fragment's exact bytes.

## Signature

The signed message is the bytes `"gleipnir/link/v0.1\n" + hash`. The domain prefix keeps a link signature from
being valid as a payment mandate, an approval or a record signature, and the reverse.

- **Key signature.** `sig` is a string: `"ed25519:" + base64url(Ed25519(message))`, or
  `"ecdsa-p256:" + base64url(DER ECDSA-SHA256(message))` with **low S** (s ≤ n/2; high-S signatures are refused, so a
  signature has exactly one valid encoding). The prefix must match `signer.public_key`.
- **Passkey (WebAuthn, ES256).** The challenge is the 32 bytes of `SHA-256(message)`. `sig` is exactly
  `{type: "webauthn", credential_id, authenticator_data, client_data_json, signature}` (base64url strings), as for
  passkey-signed mandates. It is checked as in spec 4.3: type `webauthn.get`, challenge, origin equal to
  `signer.origin`, `signer.origin` on `signer.rp_id`'s domain, no cross-origin frame, rpIdHash, user presence and user
  verification, and the ECDSA signature (low S, strict DER) over `authenticator_data || SHA-256(client_data_json)`.

**`rp_id` and `origin` are self-asserted.** They are part of the signed content, so they cannot be changed after
signing, but whoever signs chooses them: a P-256 key generated in software can produce a "passkey" assertion that
claims `rp_id: "yourbank.com"` and verifies. A passkey link therefore proves nothing more about the signer than a
device-key link. The check page treats both alike ("Passkey (not enrolled)" / "Device key (not enrolled)") and shows
the domain as "declared by the signer, not verified". Trusting a domain would need the verifier to know that the key
was registered there (enrollment), which this MVP does not have.

### How the signing page keeps keys

- **Device key:** a WebCrypto ECDSA P-256 key pair generated with `extractable: false` and stored as a `CryptoKey` in
  IndexedDB (database `gleipnir-link`). Script on the page can use it to sign but cannot read the private key out;
  clearing site data deletes it. P-256 rather than Ed25519 because non-extractable P-256 works in every current
  browser, while WebCrypto Ed25519 is recent. When IndexedDB is unavailable (some private windows), the page signs
  with a one-time key and says so. An earlier version of this page stored an Ed25519 seed in `localStorage`; the page
  deletes it on load. Ed25519 links (for example from tools) are still verified.
- **Passkey:** created on first use (one prompt), then used to sign (a second prompt); later signatures need only the
  second. Authenticators may return high-S signatures; the page converts them to the equivalent low-S form, which
  verifies the same.

## The code

`code = upper(first 6 hex characters of the hash)`, shown as `3F9 A21`. The agent reads it out; the person on
the call checks it against the page. It ties the link they opened to the agent they are talking to.

It is a convenience, not a security check: 24 bits can be matched by someone who tries about 16 million variants
of a link. What protects the content is the signature. The check page hides the code when the signature is invalid,
so it cannot be matched against content the signature does not cover.

## Status shown

| Verdict | Colour | When |
|---|---|---|
| **Not a valid link** | red | Cannot be decoded, parsed or is not a well-formed link. |
| **Invalid signature** | red | The content or the signature was changed. The code is hidden and the details are collapsed behind "Show contents anyway", greyed out and marked untrustworthy. |
| **Expired** | grey | Now is after `valid_until`. |
| **Not yet valid** | amber | `issued_at` is more than 5 minutes in the future. |
| **Checking…** | grey, dashed | Signature valid and in date, `status_url` set, answer pending. Nothing positive is shown before the answer. |
| **Revoked** | solid red | The status server answered `revoked`. |
| **Could not confirm revocation** | amber | `status_url` set, but no usable answer (network error, CORS refused, timeout, HTTP error, over 4 KiB, not the expected JSON). Fails closed: the page says not to rely on the link. |
| **Signature valid** | neutral blue, with **Signer not verified** | Signature holds, in date, and not revoked (or no `status_url`). |

"Signature valid" is deliberately not green: every key is unenrolled for now, so the verdict always carries
"Signer not verified".

Text typed by the signer is shown with `dir="auto"` and `unicode-bidi: isolate`, so it cannot reorder the text
around it. Names (principal, agent, counterparty) that mix scripts (for example Latin with one Cyrillic letter) or
contain any non-ASCII character get a visible "Check this" warning; they are not refused, because real names are
often not ASCII. `valid_until` is shown in UTC and in the viewer's time zone.

## Revocation

Without `status_url` the page shows "Revocation: not configured": the link stays valid until `valid_until`, so
signers should keep validity short.

`status_url` must be `https://`, at most 2048 characters, on port 443, with a host name (no IP literals, no
user name or password) that is not local (`localhost`, `.local`, `.internal`, `.lan`, `.home`, `.arpa`, `.test`,
`.invalid`, `.example`, or a name without a dot). The check page fetches it each time it opens the link (no cookies,
no referrer, no redirects, 5 second deadline, reading at most 4 KiB from the stream) and expects
`{"status": "active"}` or `{"status": "revoked"}`. The status server must allow cross-origin `GET`
(`Access-Control-Allow-Origin`).

**Privacy:** opening a link with a `status_url` tells whoever runs that server the viewer's IP address and the time
the link was checked (and, through the URL, which link). The pages say so.

The host checks run in the browser and cannot see DNS: a public name that resolves to a private address is not
caught. The browser's own protections against requests to private networks apply.

The signing page at getgleipnir.com sets `status_url` to its own status service and creates a separate P-256
revocation key in the browser. The slot in the URL is a random id plus the RFC 7638 thumbprint of that key, and it is
covered by the link's signature, so one link cannot take over another link's slot. `POST /api/link-revoke` accepts a
signature by that key over `"gleipnir/link-revoke/v0.1\n" + slot`. Revoking therefore works only from the browser that
signed, also for passkey links.

The answer is not signed: whoever controls the URL decides it, and an attacker who controls the network path or the
status host can make a revoked link look active. Follow-up for stronger revocation: a service that

1. answers with a signed, timed statement bound to the link hash, as `status_url` does for payment mandates
   (spec 9.1), which the check page verifies.

## What it proves, and what it does not

**Proves:** that whoever holds the signing key approved exactly this scope (principal name, agent, counterparty,
actions, amount, validity), unchanged since signing; and, with a working status service, that the signer has not
withdrawn it.

**Does not prove:**

- **Who the signer is.** `principal.name` is what the signer typed, and so are a passkey's `rp_id` and `origin`.
  Anyone can create a key and sign "Jane Doe". The link only identifies the signer once the key is enrolled with
  someone who knows the person: a bank, a KYC or identity provider, or the counterparty itself (for example the key
  registered at account opening). Until then, the third party confirms identity as it normally would, and the page
  says so.
- **That the agent on the line holds the link legitimately.** A link is a bearer statement: anyone who has it can
  show it. The code ties a call to a link, not to an agent. Binding the agent (its own key signing a challenge
  from the counterparty, as agents sign payments in the payment mandate spec) is a follow-up.
- **That the actions are interpreted the same way by both sides.** They are free text, read by a person.
- **That the agent's decisions are correct** or in the principal's interest. The link limits what the agent may
  agree to; it does not check what it says.

## Code and hosting

- Format: [typescript/packages/verify/src/link.ts](../typescript/packages/verify/src/link.ts) (not exported from the
  package), tests in [link.test.ts](../typescript/packages/verify/test/link.test.ts).
- Pages: hand-written `site/link/index.html` + `link.css` and `site/link/v/index.html` + `check.css`; the scripts
  `site/link/link.js` and `site/link/v/check.js` are built from `site/link/src` and `site/link/v/src` by
  `npm run build:site` in `typescript/` (classic scripts, so they also load from disk).
- **Content Security Policy.** The pages have no inline script, inline style or style attribute, so they work under
  getgleipnir.com's `script-src 'self'; style-src 'self'`. Their own meta CSP is `default-src 'none'; script-src
  'self'; style-src 'self'`; the signing page has `connect-src 'none'`, the check page `connect-src https:` (for
  `status_url` only). A server CSP for `/link/v/` must allow `connect-src https:` too, or revocation checks fail
  (closed: "Could not confirm revocation"). The server must serve `/link/v/` as `/link/v/index.html`.

Run locally:

```bash
cd typescript && npm ci && npm run build:site && npx vitest run packages/verify/test/link.test.ts
cd .. && python3 -m http.server 8000   # then open http://localhost:8000/site/link/
```

Signing needs https or `localhost` (WebCrypto and passkeys need a secure context).

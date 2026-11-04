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
([site/link/v](../site/link/v/index.html)) checks the signature in the browser and shows **Valid**, **Expired**,
**Invalid signature**, **Revoked** or **Not a valid link**, with the code to match.

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
  "signer": { "public_key": "ed25519:…" },
  "sig": "ed25519:…"
}
```

| Field | Required | Meaning |
|---|---|---|
| `v` | yes | `"gleipnir/link/0.1"` |
| `id` | yes | Random id chosen by the signer, at most 64 characters. Also what a status service keys on. |
| `principal.name` | yes | Who the agent acts for, as the signer typed it. At most 200 characters. |
| `principal.kind` | no | `"person"` or `"company"` |
| `agent.id` | yes | How the agent identifies itself (account, phone number, client id). At most 200 characters. |
| `agent.name` | no | Display name. |
| `counterparty` | no | Toward whom. Absent means anyone. |
| `actions` | yes | 1 to 12 free-text lines, each at most 300 characters. Not machine-checked: a person reads them. |
| `max_amount` | no | `{amount, currency}`: decimal string (`"200.00"`, never a JSON number) and ISO 4217 code. |
| `issued_at`, `valid_until` | yes | `YYYY-MM-DDTHH:MM:SSZ`; `valid_until` after `issued_at`. The signing page sets `valid_until` to 23:59:59 UTC of the chosen day. |
| `status_url` | no | `https://` URL, at most 2048 characters. See Revocation. |
| `signer.public_key` | yes | `ed25519:<b64url 32 bytes>` or `ecdsa-p256:<b64url DER SPKI>` (same encoding as the rest of Gleipnir). |
| `signer.rp_id`, `signer.origin` | passkeys only | The passkey's relying party id and the origin of the page that signed. |
| `sig` | yes | See Signature. |

Unknown fields, missing required fields, duplicate JSON keys and non-integer numbers are refused (the strict
parsing of spec section 13, via `parseStrict`).

## Canonicalisation and hash

`hash = "sha256:" + hex(SHA-256(JCS(link without "sig")))`, JCS being RFC 8785, the same canonical JSON the rest of
Gleipnir uses. Key order and whitespace in the link do not matter; leaving out or adding any field does.

The URL fragment is `base64url(JCS(signed link))`, without padding. Verifiers decode it as UTF-8 and parse it
strictly; they recompute the hash, so they do not depend on the fragment's exact bytes.

## Signature

The signed message is the bytes `"gleipnir/link/v0.1\n" + hash`. The domain prefix keeps a link signature from
being valid as a payment mandate, an approval or a record signature, and the reverse.

- **Device key (Ed25519).** `sig = "ed25519:" + base64url(Ed25519(message))`. The signing page keeps the private
  key in the browser's `localStorage`, so the same browser signs with the same key next time.
- **Passkey (WebAuthn, ES256).** The challenge is the 32 bytes of `SHA-256(message)`. `sig` is
  `{type: "webauthn", credential_id, authenticator_data, client_data_json, signature}` (base64url), as for
  passkey-signed mandates. It is checked as in spec 4.3: type `webauthn.get`, challenge, the origin equal to
  `signer.origin`, `signer.origin` on `signer.rp_id`'s domain, the rpIdHash, user presence and user verification,
  and the ECDSA signature over `authenticator_data || SHA-256(client_data_json)`.

The page creates a passkey on first use (one prompt) and signs with it (a second prompt); later signatures need
only the second.

## The code

`code = upper(first 6 hex characters of the hash)`, shown as `3F9 A21`. The agent reads it out; the person on
the call checks it against the page. It ties the link they opened to the agent they are talking to.

It is a convenience, not a security check: 24 bits can be matched by someone who tries about 16 million variants
of a link. What protects the content is the signature. The check page hides the code when the signature is invalid.

## Status shown

In this order: **Not a valid link** (cannot be decoded or parsed), **Invalid signature** (the content or the
signature was changed; the details are shown greyed out and marked untrustworthy), **Expired** (now is after
`valid_until`), **Not yet valid** (`issued_at` more than 5 minutes in the future), **Revoked** (see below),
**Valid**.

## Revocation

Without `status_url` the page shows "Revocation: not configured": the link stays valid until `valid_until`, so
signers should keep validity short.

With `status_url` the check page fetches it each time it opens the link (https only, no cookies, no referrer, no
redirects, 5 second deadline, 4 KiB limit) and expects `{"status": "active"}` or `{"status": "revoked"}`.
`revoked` turns the verdict into **Revoked**. Any other answer, or no answer, shows "Could not check" next to an
otherwise valid result. The status server must allow cross-origin `GET` (`Access-Control-Allow-Origin`).

This MVP has no status service, and the answer is not signed: whoever controls the URL decides it, and an attacker
who controls the network path can make a revoked link look active. Follow-up for real revocation: a small service
(for example a Cloudflare Worker with a key-value store) that

1. accepts a revocation signed by the link's own key (`"gleipnir/link-revoke/v0.1\n" + hash`), so only the signer
   can revoke, and
2. answers with a signed, timed statement bound to the link hash, as `status_url` does for payment mandates
   (spec 9.1), which the check page verifies.

## What it proves, and what it does not

**Proves:** that whoever holds the signing key approved exactly this scope (principal name, agent, counterparty,
actions, amount, validity), unchanged since signing; and, with a working status service, that the signer has not
withdrawn it.

**Does not prove:**

- **Who the signer is.** `principal.name` is what the signer typed. Anyone can create a key and sign "Jane Doe".
  The link only identifies the signer once the key is enrolled with someone who knows the person: a bank, a KYC
  or identity provider, or the counterparty itself (for example the key registered at account opening). Until
  then, the third party confirms identity as it normally would, and the page says so.
- **That the agent on the line holds the link legitimately.** A link is a bearer statement: anyone who has it can
  show it. The code ties a call to a link, not to an agent. Binding the agent (its own key signing a challenge
  from the counterparty, as agents sign payments in the payment mandate spec) is a follow-up.
- **That the actions are interpreted the same way by both sides.** They are free text, read by a person.
- **That the agent's decisions are correct** or in the principal's interest. The link limits what the agent may
  agree to; it does not check what it says.

## Code

- Format: [typescript/packages/verify/src/link.ts](../typescript/packages/verify/src/link.ts) (not exported from the
  package), tests in [link.test.ts](../typescript/packages/verify/test/link.test.ts): round trip, key order, tampering
  with each field, another key, corrupted fragments, expiry, strict parsing, a passkey signature.
- Pages: `site/link/src`, `site/link/v/src`, built into self-contained `index.html` files by `npm run build:site` in
  `typescript/`. The signing page has `connect-src 'none'`; the check page has `connect-src https:` for
  `status_url` only.

Run locally:

```bash
cd typescript && npm ci && npm run build:site && npx vitest run packages/verify/test/link.test.ts
cd .. && python3 -m http.server 8000   # then open http://localhost:8000/site/link/
```

Passkeys need https or `localhost`.

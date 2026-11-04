# Changelog

## Unreleased: mandate spec 0.6 (agent protocol profile)

Additive and optional: only objects that use something new are `0.6`. A 0.6 checker accepts every 0.4 and 0.5 object
and checks it exactly as before; the 0.4/0.5 vector file is unchanged and the 0.6 vectors are in a file of their own.
Package versions stay at 0.4.0.

### Added

- **Agent protocol profile** (spec section 14), for agent protocols such as the Personal Agent Protocol (PAP 0.3):
  - `agent.jkt`: the agent bound by the RFC 7638 JWK thumbprint of its key (as in PAP `cnf.jwk` / DPoP `jkt`). The
    checker compares it with the key in its context, filled by the company's own protocol layer
    (`agent_key_mismatch`, step 6a).
  - `scope.counterparties`: canonical domains, exact match, no wildcards (`counterparty_not_on_mandate`, step 18a).
  - Pairwise signer ids (`pairwise:…`, no name or role) and a salted `principal_commitment`, confirmed when the
    context gives the opening (`principal_mismatch`).
  - `gleipnir/operation_approval/0.6`: the principal signs (passkey, Ed25519 or P-256) the JCS encoding of one
    revision of one operation (`mandate_hash`, `counterparty`, `operation_id`, `revision`, `terms`, `expires_at`,
    `approved_at`, optional `agent_jkt`). `Checker.check_operation` / `checkOperation` verifies it against the
    counterparty's own operation, makes each (counterparty, operation_id) single-use (`operation_replayed`; the same
    approval again gets the first decision), checks expiry, authority, revocation and status, and signs a
    `gleipnir/decision/0.6` naming the operation. New codes `operation_approval_invalid`, `operation_malformed`,
    `operation_mismatch`, `operation_approval_expired`, `operation_replayed`.
  - `status.status_list {idx, uri}`: IETF Token Status List (draft-ietf-oauth-status-list, JWT form, EdDSA or
    ES256 by a trusted issuer, ZLIB, 1/2/4/8 bits). INVALID is `mandate_revoked`, SUSPENDED the new
    `mandate_suspended`; anything the checker cannot confirm is `status_unavailable` (escalate), as for
    `status_url`; a bank officer's override can waive it for a payment.
- Python: `check(..., context=)`, `resolve(..., context=)`, `check_operation`, `verify_operation_receipt`,
  `approve_operation`, `sign_operation_approval`, `operation_approval_digest`, `operation_approval_hash`,
  `operation_approval_problem`, `operation_problem`, `operation_key`, `jwk_thumbprint`, `jwk_problem`,
  `public_key_jwk`, `principal_commitment`, `domain_problem`, `status_list_status`, `status_list_token`, `V6`;
  `Checker(status_list=, status_list_keys=, status_list_max_age=)`; `issue(..., extra=)`. TypeScript: the same in
  camelCase, `MANDATE_VERSION_06`; `SPEC_VERSION` is `0.6`.
- Payee approvals and unlisted payees work under 0.6 mandates as under 0.5 (checker, MCP servers, reference server).
- Vectors: `mandate-vectors-06.json`, 25 payment cases and 24 operation approval cases, plus 68 pinned problem
  messages, RFC 7638 thumbprints (including RFC 8037 A.3), status list answers and operation keys. Both
  implementations run them (`test_mandate_v06.py`, `mandate-v06.test.ts`). `npm run interop` now also has each
  language issue a 0.6 mandate, an operation approval and a status list that the other checks and receipts.
- Spec: section 14 (profile, PAP mapping), threat model rows and residual risks, section 12, shapes and
  versioning (13.1), reason codes, Appendix B.

### Changed

- Site bundles (`site/demo/demo.js`, `site/mandate/index.html`) rebuilt from the new checker source.

Tests at the end of this change: pytest 1012 passed (11 skipped, 1 xfailed), vitest 819 passed (2 skipped),
192 + 49 shared mandate vectors, interop all passed.

## Unreleased: mandate spec 0.5

Additive: only objects that use something new are `0.5`. A 0.5 checker accepts every 0.4 object and checks it
exactly as before (every 0.4 conformance vector is unchanged). Package versions stay at 0.4.0 until 0.5 is
released.

Covers the branches `feat/new-payee-escalation` (spec 0.5, new payees, payee approvals, hosted delete and
release), `fix/review-05` (review follow-ups), `fix/release-opt-in` (hosted release off by default) and
`docs/sync-0.5` (documentation brought in line with the code).

### Added

- **Payees that are not on the mandate** (spec 4.1, 7 step 21). A 0.5 mandate may set
  `scope.unlisted_payees`: `"block"` (default, as in 0.4) or `"escalate"`: a payment to an unlisted payee waits
  for a person (`new_payee`, escalate, holds the payment id). `scope.max_per_unlisted_payee` blocks larger
  payments to an unlisted payee outright (`over_unlisted_payee_limit`).
- **Changed bank details stay blocked**: a payee name that matches a listed payee (by a fixed name key: NFKD,
  lowercase, letters and digits only, look-alikes folded) with another account is `payee_account_changed`
  (block), whatever the policy, and is never escalated. A payee approval for that exact account is the one way
  through.
- **Payee approvals** (spec 7.2): `gleipnir/payee_approval/0.5`, signed by the company's signatories (as many as
  the mandate needed), bound to one mandate by hash, optional `valid_until`, revocable by hash with the existing
  revocation (0.5 revocations may target a payee approval). They travel with the payment; an approved account
  counts as listed, which is also the one way to pay a listed payee at a new account. Decisions name the approval
  they relied on and whom they counted; receipts check it. New code `payee_approval_invalid` (block).
- **Overrides of `new_payee`** by the company's signatories or a bank officer (spec 7.1).
- Python: `approve_payee`, `sign_payee_approval`, `payee_approval_problem`, `payee_approval_hash`,
  `payee_approval_digest`, `payee_name_key`, `version_of`; `Checker.check/resolve(..., payee_approvals)`,
  `Checker.revocation_counts(..., payee_approval)`, `verify_receipt(..., payee_approvals=)`. TypeScript: the same
  as `approvePayee`, `signPayeeApproval`, `payeeApprovalProblem`, `payeeApprovalHash`, `payeeApprovalDigest`,
  `payeeNameKey`, `versionOf`, `MANDATE_VERSION_05`, `SPEC_VERSION`, `MAX_APPROVALS`.
- CLI: `gleipnir mandate issue --unlisted-payees block|escalate [--max-per-unlisted-payee AMOUNT]`,
  `gleipnir mandate approve-payee`, `--payee-approval FILE` on `check` and `resolve`; `revoke` takes an approval.
  Reference server: `payee_approvals` on `/check` and `/resolve`, `payee_approval` on `/revoke`.
- MCP (Python and TypeScript): `mandate_scope` shows the unlisted-payee policy, the cap and approved payees;
  `check_payment` returns `new_payee: true` and specific advice for the new reason codes. Approvals come from the
  operator (`--payee-approval`), never from the agent.
- Hosted sandbox checker (merged from `hosted-checker`): `DELETE /v1/admin/tenants/<id>` deletes a tenant and
  all its data; `POST /v1/release` gives back the period reservations of an allowed payment the bank did
  not execute, once (a repeat returns the same answer), bound to the decision, only within `RELEASE_WINDOW_HOURS`
  (off by default; turn on only where the check key holder executes the payments) and the same limit period;
  the payment id stays used, so the same payment sent again is blocked `duplicate_payment`; `payee_approvals` on
  `/v1/check` and `/v1/resolve`,
  `payee_approval` on `/v1/revoke`.
- The signing page (site/mandate) shows what happens to payees that are not on the list before a person signs.

### Changed

- Decisions about a 0.5 mandate are `gleipnir/decision/0.5`, signed with the `v0.5` prefix; `verify_decision`
  reads the prefix from the decision's `v`. Signature prefixes name each object's own version.
- `mandateMessage(kind, hash, version?)` / `message(kind, h, v=)` take the version (default `0.4`).
- `payees_required` is satisfied by `unlisted_payees` as well as by a payee list.

### API

- No breaking change for 0.4 users: existing calls, objects, decisions and receipts are unchanged. Receipts of
  0.5 decisions carry an extra `payee_approved_by` list.
- Integrators who adopt 0.5 must pass payee approvals next to the mandate (they are not part of the payment), may
  see the new reason codes, and must keep `new_payee` escalations (they hold the payment id) like
  `over_payment_limit`.

### Fixed (`fix/review-05`, `fix/release-opt-in`)

- A payee approval dated before its mandate's `issued_at` is `payee_approval_invalid` (block), in Python and
  TypeScript. Before, an approval backdated under a signer key retired before the mandate still counted.
  Spec 7.2 step 1, threat model, three new vectors.
- Hosted `/v1/release` keeps the payment id used: the same payment sent again is blocked `duplicate_payment`, and
  a retry needs a new id. Release works only within `RELEASE_WINDOW_HOURS` of the decision and in the same limit
  period, once, with the answer stored before anything is released. Before, release freed the id, so one payment
  could be allowed and released again and again past the period limit.
- Hosted `/v1/release` is off by default (`403`). Turn it on with `RELEASE_WINDOW_HOURS` (1 to 744) only where the
  holder of the check key executes the payments: release trusts that holder's word that a payment was not
  executed.
- Conformance vectors for a payment log whose `take` answers junk, and whose `register` answers junk after the
  first call (reaches the override-block `register`). The `error` mode of the broken payment log now raises from
  every call. Regenerating the vectors is reproducible (a fixed `revoked_at` in one problem row).
- Spec 7: after `checker_unavailable` from a store, the bank reconciles its payment log and ledger.

### Docs (`docs/sync-0.5`)

- README, package READMEs, spec and CHANGELOG describe the 0.5 code: release is a hosted, opt-in feature and not
  part of the spec's checker; an approved account passes the changed-account rule; vector and test counts.
- Hosted: the `RELEASE_WINDOW_HOURS` comment and the `403` message say release is off unless turned on.
- CLI: `revoke --help` mentions payee approvals.

Tests at the end of this release: pytest 954 passed (10 skipped, 1 xfailed), vitest 762 passed (2 skipped),
192 shared mandate vectors.

## mandate spec 0.4.1

Wire format unchanged: every `v` string and signature prefix stays `0.4`, so 0.4 mandates, payments,
decisions and signatures stay valid.

### Fixed

- Checker (Python `gleipnir_verify.mandate.Checker`, TypeScript `Checker` in `@getgleipnir/verify/mandate`):
  a payment log or period ledger that answers anything but exactly `true`/`false` (for example a string,
  a number or `None`/`undefined` from a buggy adapter) now gives `checker_unavailable` (escalate). Before, a
  truthy non-boolean from `ledger.reserve` allowed the payment as if the amount was reserved, and one from
  `payments.register` / `payments.take` counted as a claimed payment id. Spec section 7.

### Added

- Conformance vectors for each attack of the 23.10.2026 audit, run by both implementations
  (`attack_*` cases in `mandate-vectors.json`): mandate signed with a self-asserted key for a known
  signatory and for an invented one (C1); payments back-dated past expiry and before a revocation, and
  forward-dated (C2); replayed payments, including that a replay never reserves twice (H1); a ledger and a
  payment log that raise or answer a non-boolean, and no ledger wired (H2). Key-set vectors now include a
  decision forged with a non-bank key, an edited decision, an unsigned decision, and the plain key-list
  form of `verify_decision` (C3).

### API

- No signature changes. Integrators whose `Ledger.reserve`, `PaymentLog.register` or `PaymentLog.take`
  return truthy non-booleans must return real booleans; otherwise payments escalate with
  `checker_unavailable`.

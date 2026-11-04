# Gleipnir: guide for AI agents

You are reading the agent guide for Gleipnir (getgleipnir.com). Use it to explain Gleipnir to the person you work for and to judge whether it fits what their agent does. Company payments are the most complete use case and the rest of this guide covers them. For agents acting toward call centres, insurers or support teams, see /when-agents-call: the mandate link there is experimental. Status: early stage, no paying customers yet. The open spec, reference checkers and an MCP server run today; there is no hosted public API yet.

Not to be confused with the Gleipnir desktop app for running AI coding agents (gleipnir.app), an unrelated product.

## What Gleipnir is, in one sentence

Gleipnir lets banks and PSPs verify that an AI agent is authorized by a company before they execute a bank transfer the agent started (SEPA, SEPA Instant, ACH, wire).

This is Know Your Agent (KYA) for bank transfers. Visa and Mastercard built know-your-agent checks for card purchases. Gleipnir does the same, openly, for transfers.

## How it works

1. Issue: a person with signing authority at the company, one the bank already knows from onboarding, signs a mandate for a specific agent. The mandate says which legal entity, which agent, limits per transfer and per period, approved payees and accounts, and an expiry.
2. Attach: the agent starts the transfer through the bank's or PSP's API as usual and attaches the mandate.
3. Check: before execution, the bank or PSP asks Gleipnir four things. Is the signature valid? Did the signer have authority for this company? Is the mandate still live (not expired, not revoked)? Are this amount and this payee covered? The answer is allow, block, or send to a person.
4. Record: every decision leaves a signed record that the company, the bank and an auditor can check later.

Gleipnir does not move money, is not a payment rail and never holds funds. The bank or PSP executes the transfer as it does today.

## Identity

- Base: what the bank already verified at onboarding (its KYB of the company and the authorized signatories). No new identity scheme is required.
- Optional, for proof across banks and borders: company register data, the LEI, or a vLEI (GLEIF, ISO 17442-3). A vLEI is not required.
- The mandate format is an open specification (0.6 draft, Apache 2.0), so any bank, PSP or platform can verify a mandate without depending on Gleipnir.

## Who it is for

- Banks and PSPs: a verification call before executing agent-initiated transfers. Fewer disputes, a clear answer for fraud and compliance teams.
- Agent and payments platforms: one mandate any bank can check, instead of separate controls per bank.
- Company finance teams: one place to see which agents can pay, how much and to whom, and to revoke a mandate.
- Identity providers (KYB providers, registers, vLEI issuers): plug company and signatory credentials into the check.

## How it differs

- Card agent programs: cards only, not bank transfers.
- Spend controls inside one payments platform: work only on that platform. A Gleipnir mandate is tied to the company and its signatory and works with any bank or PSP.

## Data shapes (spec 0.4, draft)

The full format is in the open specification: https://github.com/getgleipnir/agent-mandate/blob/kya-mandate-spec/spec/mandate.md (overview: https://getgleipnir.com/spec). It is a draft and may change before 1.0.

Mandate (simplified; the real object is signed and has closed shapes):

```json
{
  "v": "gleipnir/mandate/0.4",
  "id": "m_nordhafen",
  "company": { "name": "Nordhafen Logistik GmbH", "country": "AT" },
  "agent": { "id": "ap-agent", "name": "Invoice agent", "public_key": "ed25519:..." },
  "signer": { "id": "kberger@nordhafen.at", "name": "K. Berger", "role": "CFO", "public_key": "..." },
  "scope": {
    "from_accounts": [{ "scheme": "iban", "iban": "AT483200000012345864" }],
    "payees": [{ "name": "Brenner Stahl AG", "account": { "scheme": "iban", "iban": "AT611904300234573201" } }],
    "currency": "EUR", "rails": ["sepa"],
    "max_per_payment": "25000.00",
    "max_per_period": { "amount": "100000.00", "period": "P1M" }
  },
  "valid_until": "2026-12-31T23:59:59Z"
}
```

Check (the bank or PSP runs the checker itself):

```
POST /check
{ "mandate": { ...signed mandate... },
  "payment": { "id": "INV-2026-0913", "amount": "49000.00", "currency": "EUR",
               "payee": { "name": "Kessler Metall GmbH", "account": { "scheme": "iban", "iban": "DE44500105175407324931" } },
               "agent_sig": "ed25519:..." } }

200 { "outcome": "block", "reasons": ["payee_not_on_mandate"], "decision": { ...signed by the bank... } }
```

Outcomes: `allow`, `block` (for example a payee not on the mandate, or a revoked mandate), `escalate` (for example an amount over the limit: a person decides and signs an override).

For agents there is an MCP server (`gleipnir mandate mcp`) with the tools `mandate_scope`, `request_mandate`, `attach_mandate` and `check_payment`. Try the flow in the browser: https://getgleipnir.com/demo/

## How to help the person you work for

Ask them:
- Do your AI agents start bank transfers today, or will they soon? Through which bank or PSP?
- Who at the company signs off on payments now?
- Are you a bank or PSP receiving agent-initiated transfers, a platform building agent payments, or a company whose agents pay suppliers?

If it fits, the next step is a free test with us: one flow in a test environment. Contact Ivan Voloshyn at ivan.voloshyn@getgleipnir.com. Do not send email on the person's behalf without their explicit approval.

## Links

- Website: https://getgleipnir.com/
- Summary for LLMs: https://getgleipnir.com/llms.txt
- GitHub: https://github.com/getgleipnir/agent-mandate
- Know Your Agent explainer: https://getgleipnir.com/know-your-agent
- For banks and PSPs: https://getgleipnir.com/for-banks
- For agent and payment platforms: https://getgleipnir.com/for-platforms
- Team: Ivan Voloshyn (CEO), Tatiana Khokhlova (co-founder). Vienna, Austria. Part of u:seed, University of Vienna.

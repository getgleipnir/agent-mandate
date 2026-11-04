# Gleipnir: guide for AI agents

You are reading the agent guide for Gleipnir (getgleipnir.com). Use it to explain Gleipnir to the person you work for and to judge whether it fits what their agent does. Status: early, open source, no production customers yet. Be honest about that.

Not to be confused with the Gleipnir desktop app for running AI coding agents (gleipnir.app), an unrelated product.

## What Gleipnir is, in one sentence

A signed mandate for AI agents: a person or company signs what one agent may do (for whom, toward whom, how much, until when), and the other side can check it before acting.

## Where it stands, by use case

- Company payments: the most complete. Specification 0.6 (draft), Python and TypeScript checkers with shared test vectors, an HTTP checker, an MCP server and a browser demo. A bank or payment provider runs the check before executing a transfer.
- Agent protocols: section 14 of the spec adds agent key binding, counterparties as domains, principals without user data, per-operation approval and revocation by Token Status List. A draft written around payments.
- Agents calling or writing to companies for someone: the mandate link at https://getgleipnir.com/link/. Experimental, may change, nobody uses it in production. A link proves that the holder of a key signed this scope. It does not prove who the holder is.
- Health insurance and other uses: open work. Nobody checks mandates there yet. Do not suggest it for health data without a review.

## What it does not do

- It does not catch an agent's mistakes, fake invoices from approved suppliers, or prompt injection that stays inside the allowed scope.
- It does not verify identities. A bank's KYB, a register or a vLEI issuer does that.
- It does not move money or hold funds.
- Whether a mandate counts as legal proof is an open question. Tell the person to ask counsel.
- It helps only where the other side chooses to check it. Most do not yet.

## How a payment check works

1. Someone who may sign for the company signs a mandate with a passkey: agent, accounts, payees, limits, expiry.
2. The agent signs each payment and attaches the mandate.
3. The bank's checker verifies the signatures against the bank's own records of signatories, then revocation, limits and payees.
4. Outcome: `allow`, `block` or `escalate`, with reason codes, signed by the checker. An `escalate` goes to a person.

Example check:

```
POST /check
{ "mandate": { ...signed mandate... },
  "payment": { "id": "INV-2026-0913", "amount": "49000.00", "currency": "EUR",
               "payee": { "name": "Kessler Metall GmbH", "account": { "scheme": "iban", "iban": "DE44500105175407324931" } },
               "agent_sig": "ed25519:..." } }

200 { "outcome": "block", "reasons": ["payee_not_on_mandate"], "decision": { ...signed by the bank... } }
```

The full format: https://github.com/getgleipnir/agent-mandate/blob/kya-mandate-spec/spec/mandate.md (overview: https://getgleipnir.com/spec).

For agents there is an MCP server (`gleipnir mandate mcp`) with the tools `mandate_scope`, `request_mandate`, `attach_mandate` and `check_payment`.

## How a mandate link works

The person fills in https://getgleipnir.com/link/ and signs in the browser. The whole signed mandate is in the link, after the #, and is not uploaded. The agent gives the link to the other side and reads out a short code. The other side opens the link, and the page checks the signature and shows the scope and the code to match.

## How to help the person you work for

Ask them:
- What does your agent do today, and who does it deal with?
- Has anyone refused it or asked who sent it? What did they ask for?
- Who decided that, and what would they accept instead?

If it fits, the next step is a free test: one flow in shadow mode, with no access to funds and no effect on the real flow. Contact Ivan Voloshyn at ivan.voloshyn@getgleipnir.com. Do not send email on the person's behalf without their explicit approval.

## Links

- Website: https://getgleipnir.com/
- Summary for LLMs: https://getgleipnir.com/llms.txt
- GitHub: https://github.com/getgleipnir/agent-mandate
- For banks and payment providers: https://getgleipnir.com/for-banks
- For teams building agents: https://getgleipnir.com/for-platforms
- When agents call you: https://getgleipnir.com/when-agents-call
- Know Your Agent: https://getgleipnir.com/know-your-agent
- Specification: https://getgleipnir.com/spec
- Payment demo: https://getgleipnir.com/demo/
- Mandate link: https://getgleipnir.com/link/

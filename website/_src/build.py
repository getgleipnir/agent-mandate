import os,shutil,re,json,sys
SRC=sys.argv[1]; OUT=sys.argv[2]
if os.path.exists(OUT): shutil.rmtree(OUT)
shutil.copytree(SRC,OUT)
for f in ['assets/site.css','assets/site.js']: os.remove(f'{OUT}/{f}')
HERE=os.path.dirname(os.path.abspath(__file__))
shutil.copy(f'{HERE}/site.css',f'{OUT}/assets/site.css'); shutil.copy(f'{HERE}/site.js',f'{OUT}/assets/site.js')
GH='https://github.com/getgleipnir/agent-mandate'
SPEC=GH+'/blob/kya-mandate-spec/spec/mandate.md'
MAIL='mailto:ivan.voloshyn@getgleipnir.com'
MARK='<svg viewBox="0 0 34 36" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round"><path d="M3 23 C 9 5, 16 30, 21 13 S 31 8, 31 8" stroke-width="3"/><path d="M3 27 C 9 11, 16 34, 21 18 S 31 13, 31 13" stroke-opacity=".5" stroke-width="1.8"/></svg>'
NAV=[('/#how','How it works'),('/#uses','Use cases'),('/demo/','Payment demo'),('/link/','Mandate link'),('/spec','Spec')]
def page(path,title,desc,body,dark=False):
    url='https://getgleipnir.com/'+path.replace('index.html','').replace('.html','')
    nav=''.join(f'<a href="{h}">{t}</a>' for h,t in NAV)
    ld=json.dumps({"@context":"https://schema.org","@type":"Organization","name":"Gleipnir","url":"https://getgleipnir.com/","logo":"https://getgleipnir.com/assets/icons/icon-512.png","email":"ivan.voloshyn@getgleipnir.com","description":"Signed mandates for AI agents: a person or company signs what one agent may do, and the other side can check it before acting.","disambiguatingDescription":"Gleipnir (getgleipnir.com) is a Vienna-based startup. It is not the Gleipnir desktop app for running AI coding agents (gleipnir.app).","sameAs":["https://github.com/getgleipnir"]})
    html=f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#0C0E13">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Gleipnir">
<meta property="og:url" content="{url}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="https://getgleipnir.com/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="alternate" type="text/plain" href="/llms.txt" title="LLM summary">
<link rel="alternate" type="text/markdown" href="/skills.md" title="Agent guide">
<link rel="preload" href="/assets/fonts/schibsted-grotesk-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/site.css">
<script type="application/ld+json">{ld}</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="bar{' on-ink' if dark else ''}"><div class="wrap bar-in">
<a class="brand" href="/" aria-label="Gleipnir home">{MARK}<span>Gleipnir</span></a>
<nav class="nav" aria-label="Main">{nav}</nav>
<a class="btn small gold" href="{MAIL}">Talk to us</a>
</div></header>
<main id="main">
{body}
</main>
<footer class="foot"><div class="wrap foot-in">
<div><a class="brand" href="/" aria-label="Gleipnir home">{MARK}<span>Gleipnir</span></a><p>Vienna, Austria. Part of u:seed at the University of Vienna.</p></div>
<nav aria-label="Use cases"><h2>Who it helps</h2><a href="/for-banks">Banks and payment providers</a><a href="/for-platforms">Teams building agents</a><a href="/when-agents-call">Teams agents call</a></nav>
<nav aria-label="Build"><h2>Build</h2><a href="/know-your-agent">Know Your Agent</a><a href="/spec">Specification</a><a href="/link/">Mandate link</a><a href="/demo/">Payment demo</a><a href="/skills.md">Agent guide</a><a href="{GH}">GitHub</a></nav>
<nav aria-label="Company"><h2>Company</h2><a href="/#team">Team</a><a href="{MAIL}">Email</a><a href="/imprint">Imprint</a><a href="/privacy">Privacy</a></nav>
</div></footer>
<script src="/assets/site.js" defer></script>
</body>
</html>
'''
    open(f'{OUT}/{path}','w').write(html)


V_BANK='''<div class="term"><p class="c">Before executing the transfer</p><pre>POST /check
{
  "mandate": { … signed by K. Berger },
  "payment": { "amount": "18400.00",
               "payee": "Brenner Stahl AG" }
}</pre><p class="c">Answer</p><pre class="good">200 { "outcome": "allow",
      "decision": { … signed by the bank } }</pre></div>'''
V_OUT='<div class="outs"><div class="out ok"><b>Allow</b><span>€18,400 to an approved supplier</span></div><div class="out warn"><b>Escalate</b><span>A new payee goes to a person</span><code>new_payee</code></div><div class="out stop"><b>Block</b><span>A known name with a new account</span><code>payee_account_changed</code></div></div>'
V_PLAT='<svg class="hub" viewBox="0 0 520 300" role="img" aria-label="One signed mandate, carried by the agent, checked by a bank, a supplier and a support line"><g fill="none" stroke="#C9A45C" stroke-width="2" stroke-linecap="round"><path d="M180 150 C 260 150, 260 50, 340 50"/><path d="M180 150 H340"/><path d="M180 150 C 260 150, 260 250, 340 250"/></g><rect x="10" y="90" width="170" height="120" rx="3" fill="#FBF8F1"/><text x="28" y="124" class="t1">Mandate</text><text x="28" y="150" class="t2">Signed once by</text><text x="28" y="170" class="t2">your customer</text><path d="M28 188 C 50 170, 66 200, 90 182 S 130 176, 160 186" fill="none" stroke="#7A5B22" stroke-width="2" stroke-linecap="round"/><g fill="#171A22" stroke="#2A2F3B"><rect x="340" y="20" width="170" height="60" rx="3"/><rect x="340" y="120" width="170" height="60" rx="3"/><rect x="340" y="220" width="170" height="60" rx="3"/></g><g class="t3"><text x="358" y="46">A bank</text><text x="358" y="146">A supplier</text><text x="358" y="246">A support line</text></g><g class="t4"><text x="358" y="66">checks before paying</text><text x="358" y="166">checks before ordering</text><text x="358" y="266">checks before talking</text></g></svg>'
V_CALL='<div class="call"><p class="c">Example call</p><p class="say them">Hi, I’m an AI assistant calling for Jane Doe about her account.</p><p class="say us">How do I know she sent you?</p><p class="say them">I’ve sent you a link. The code is 4821.</p><div class="mini"><p class="ok-l">Signature valid</p><dl><div><dt>For</dt><dd>Jane Doe, as typed by the signer</dd></div><div><dt>May</dt><dd>Agree to a plan up to $200 a month</dd></div><div><dt>Code</dt><dd>4821</dd></div></dl></div></div>'
V_KYA='<ol class="layers"><li><h3>Who is this agent?</h3><p>Agent identity, bot detection</p></li><li class="ours"><h3>Who sent it, and what may it do?</h3><p>The signed mandate</p></li><li class="ours"><h3>Can you prove it later?</h3><p>The signed decision</p></li></ol>'
V_SPEC="""<div class="term"><p class="c">A mandate, shortened</p><pre>{
  "v": "gleipnir/mandate/0.6",
  "company": { "name": "Nordhafen Logistik GmbH" },
  "agent": { "id": "ap-agent", "jkt": "aVBtapLd…" },
  "signer": { "public_key": "ecdsa-p256:…" },
  "scope": { "currency": "EUR",
             "max_per_payment": "500.00",
             "counterparties": ["shop.example.com"] },
  "valid_until": "2026-12-31T23:59:59.000Z",
  "sig": { "type": "webauthn", … }
}</pre></div>"""
V_CHAIN='<div class="chain"><div>Mandate<small>signed by a person</small></div><div>Payment<small>signed by the agent</small></div><div>Decision<small>signed by the checker</small></div></div>'
V_GAP='<div class="incoming"><p class="inc-h">Incoming call</p><dl><div><dt>Is it a bot?</dt><dd class="y">Likely yes</dd></div><div><dt>Who sent it?</dt><dd class="n">Unknown</dd></div><div><dt>What may it do?</dt><dd class="n">Unknown</dd></div></dl></div>'

BOOK=None  # Ivan's own booking link, when he has one
def cta(h='We test one of your flows with you, free',p='Shadow mode: the check runs next to your flow, with no access to funds and no effect on what you do today. We are early and want to learn from real cases.'):
    book=f'<a class="btn ghost" href="{BOOK}">Book 20 minutes</a>' if BOOK else ''
    return f'<section class="cta"><div class="wrap"><h2>{h}</h2><p>{p}</p><div class="btns"><a class="btn gold" href="{MAIL}?subject=Test%20one%20flow">Email Ivan</a>{book}<a class="btn ghost" href="/link/">Create a mandate link</a></div></div></section>'

CASES=[
 ('pay','Pay a supplier','Nordhafen Logistik GmbH','K. Berger, may sign for the company','ap-agent','Brenner Stahl AG and other approved suppliers',['Pay approved suppliers','Up to €25,000 per payment'],'31 Dec 2026',
  ('Pay €18,400 to Brenner Stahl AG','Allowed','Signed by someone who may sign, supplier approved, within the limit.'),
  ('Pay €18,400 to a new bank account','Blocked','This account is not on the mandate. A new payee needs a new signature.'),
  'The bank checks with the open-source checker. Works today in test setups.'),
 ('debt','Settle a debt','Jane Doe','Jane Doe, the customer','Acme Assistant','Midwest Recovery Services',['Discuss my account','Agree to a payment plan up to $200 a month'],'31 Dec 2026',
  ('Agree to a plan of $150 a month','Allowed','Within what Jane signed, toward this company.'),
  ('Agree to settle for $2,000 today','Goes to Jane','Not in the mandate. The agent has to ask her.'),
  'The agent passes a mandate link and the agent on the phone reads a code. Experimental.'),
 ('claim','Check an insurance claim','Harbor Family Clinic','M. Okafor, practice manager','Billing Assistant','Northline Health Plan',['Ask about claim status for this clinic'],'30 Jun 2027',
  ('What is the status of this claim?','Allowed','The clinic signed this question for this plan.'),
  ('Change the clinic’s payment details','Refused','Not in the mandate. The plan should not act on this request.'),
  'Open work: no insurer checks these yet, and health data needs its own review.'),
 ('book','Change a booking','Mara Novak','Mara Novak, the traveller','Trip Assistant','Example Airlines',['Change flight dates','Pay up to $70 in fare difference'],'20 Dec 2026',
  ('Move the flight, $45 difference','Allowed','Within the limit Mara signed.'),
  ('Upgrade to business, $900','Goes to Mara','Over the limit. She can approve this one change with her passkey.'),
  'Spec 0.6 covers this for agent protocols: domains, agent keys and per-operation approval. A draft.'),
]
tabs=''.join(f'<button type="button" role="tab" id="t-{c[0]}" aria-controls="p-{c[0]}" aria-selected="{"true" if i==0 else "false"}"{"" if i==0 else " tabindex=\"-1\""}>{c[1]}</button>' for i,c in enumerate(CASES))
panels=''
for i,c in enumerate(CASES):
    k,_,who,signer,agent,toward,acts,until,ok,no,status=c
    li=''.join(f'<li>{a}</li>' for a in acts)
    panels+=f'''<div class="deed" role="tabpanel" id="p-{k}" aria-labelledby="t-{k}"{"" if i==0 else " hidden"}>
<p class="deed-h">Mandate</p>
<dl><div><dt>On behalf of</dt><dd>{who}</dd></div><div><dt>Agent</dt><dd>{agent}</dd></div><div><dt>Toward</dt><dd>{toward}</dd></div><div><dt>May</dt><dd><ul>{li}</ul></dd></div><div><dt>Until</dt><dd>{until}, unless revoked</dd></div></dl>
<div class="sign"><svg viewBox="0 0 240 44" aria-hidden="true" fill="none" stroke-linecap="round"><path class="ink" pathLength="1" d="M4 30 C 34 2, 56 44, 84 20 S 130 6, 150 24 S 200 34, 236 10"/><path class="ink two" pathLength="1" d="M4 37 C 34 9, 56 51, 84 27 S 130 13, 150 31 S 200 41, 236 17"/></svg><p>Signed by {signer}</p></div>
<div class="ask" aria-label="Try a request"><p>The agent asks:</p>
<button type="button" class="req on" data-v="{ok[1]}" data-w="{ok[2]}" data-tone="ok">{ok[0]}</button>
<button type="button" class="req" data-v="{no[1]}" data-w="{no[2]}" data-tone="stop">{no[0]}</button>
<p class="verdict ok" aria-live="polite"><b>{ok[1]}</b> <span>{ok[2]}</span></p></div>
<p class="deed-note">{status}</p>
</div>'''

STEPS=[('Someone signs','A person, or someone who may sign for a company, says what one agent may do: for whom, toward whom, how much, until when. They sign with a passkey.'),
('The agent carries it','The mandate travels with the agent as a link, a code or a protocol field. It works outside the app that issued it.'),
('The other side checks','Before acting, the bank or call centre checks the signature, the scope and whether it was revoked. It uses its own records to decide if the signer counts.'),
('Everyone keeps the proof','A wrong request stops or goes back to the person. When a dispute comes months later, the signed record answers it.')]
SV=['<div class="sv"><svg viewBox="0 0 150 40" aria-hidden="true" fill="none" stroke="#7A5B22" stroke-width="2.2" stroke-linecap="round"><path d="M4 26 C 24 4, 40 38, 62 18 S 100 8, 146 22"/></svg><small>Signed with a passkey</small></div>','<div class="sv"><code>getgleipnir.com/link/v/#eyJh…</code><small>Code 4821</small></div>','<div class="sv"><ul class="tick"><li>Signature</li><li>Scope</li><li>Not revoked</li></ul></div>','<div class="sv"><b class="okt">Allowed</b><code>sha256:4b7d…e91a</code></div>']
steps=''.join(f'<li>{SV[i]}<h3>{a}</h3><p>{b}</p></li>' for i,(a,b) in enumerate(STEPS))

USES=[('Company payments','An agent pays invoices by SEPA, ACH or wire','The bank or payment provider','Spec and checkers, test setups','/for-banks','now'),
('Agent products','Your agent acts for many customers across many companies','Whoever your agent deals with','Spec 0.6 draft, MCP server','/for-platforms','now'),
('Calls and account requests','An agent calls a collector, a bank line or a support team for a customer','The person or system taking the call','Mandate link, experimental','/when-agents-call','exp'),
('Health insurance','An agent asks a health plan about claims for a clinic','The plan','Open work, no plan checks it yet','/when-agents-call','open')]
rows=''.join(f'<tr><th scope="row"><a href="{l}">{a}</a></th><td>{b}</td><td>{c}</td><td><span class="st {s}">{d}</span></td></tr>' for a,b,c,d,l,s in USES)

FAQ=[('What is Gleipnir?','A signed mandate for AI agents. A person or company states what one agent may do, and the other side can check that before acting.'),
('Do you move money or see our data?','No. Your bank sends payments as usual. The checks can run on your own systems, and the mandate link page runs in the browser.'),
('Does it stop an agent from making mistakes?','No. It proves who allowed what. A fake invoice from an approved supplier, or a bad decision inside the allowed scope, is not something a mandate can catch.'),
('Does it prove who the signer is?','Only if the checker knows the key. A bank uses its own records of who may sign for a company. A mandate link on its own proves that the holder of a key signed this scope, nothing more.'),
('Is it legally binding?','We don’t know yet, and it will differ by country and by what the agent does. Ask your counsel before relying on it.'),
('Don’t Visa and Mastercard do this?','For card payments, yes. Limits inside one app also exist. A mandate is meant to be checked by anyone, across providers and outside payments.'),
('Can I use it today?','The specification, the Python and TypeScript checkers, the MCP server and the demos are open source under Apache 2.0. We have no production customers yet.')]
faq=''.join(f'<details><summary>{q}</summary><p>{a}</p></details>' for q,a in FAQ)

home=f'''<section class="hero"><div class="wrap hero-in">
<div class="hero-t"><h1>A power of attorney for AI agents</h1>
<p class="lede">Your agent acts for you. Now the bank, insurer or call centre on the other side can check who sent it and what it may do.</p>
<div class="btns"><a class="btn gold" href="/link/">Create a mandate link</a><a class="btn ghost" href="/demo/">See a payment checked</a></div>
<p class="fine">Open source. We never touch your money.</p></div>
<div class="hero-d"><div class="tabs" role="tablist" aria-label="Example use cases">{tabs}</div>{panels}<p class="made-up">Examples with made-up names. Nothing is sent.</p></div>
</div></section>
<section class="gap"><div class="wrap gap-in"><div><p class="big">The other side can often tell it’s a bot. It still can’t tell who sent it, or what it’s allowed to do.</p>
<p class="gap-s">So banks, insurers and call centres block agents, or fall back on a person at each step. Some health plans <a href="https://www.infinitus.ai/blog/payors-are-blocking-ai-agent-calls-what-does-that-mean-for-infinitus/">already refuse AI agent calls</a>. <a href="https://www.federalreserve.gov/newsevents/speech/files/waller20260929a.pdf">Federal Reserve Governor Waller</a> named proving an agent’s authority as a new question for payments.</p></div>{V_GAP}</div></section>
<section class="how" id="how"><div class="wrap"><h2>How it works</h2><ol class="steps">{steps}</ol></div></section>
<section class="uses" id="uses"><div class="wrap"><h2>Where it applies</h2><p class="sub">The same signed mandate, at different stages. We say plainly how far each one is.</p>
<div class="tbl"><table><thead><tr><th scope="col">Use case</th><th scope="col">What the agent does</th><th scope="col">Who checks</th><th scope="col">Where it stands</th></tr></thead><tbody>{rows}</tbody></table></div></div></section>
<section class="team" id="team"><div class="wrap team-in"><h2>Two founders in Vienna</h2><div class="ppl">
<div class="per"><span class="mono" aria-hidden="true">IV</span><div><h3><a href="https://www.linkedin.com/in/ivan-voloshyn-096715225/">Ivan Voloshyn</a></h3><p>Co-founder and CEO. Writes the code, including the cryptography. Built Planara and ran online shops before this.</p></div></div>
<div class="per"><span class="mono" aria-hidden="true">TK</span><div><h3><a href="https://www.linkedin.com/in/tatiana-khokhlova-1691693a7/">Tatiana Khokhlova</a></h3><p>Co-founder. Turns law into rules software can check. Wrote the full legal rule set behind Planara.</p></div></div></div></div></section>
<section class="faq" id="questions"><div class="wrap faq-in"><h2>Questions</h2><div>{faq}<p class="more">More questions? Point your AI at our <a href="/skills.md">agent guide</a>.</p></div></div></section>
{cta()}'''
page('index.html','Gleipnir: a power of attorney for AI agents','A person or company signs what one AI agent may do. The bank, insurer or call centre on the other side can check it before acting.',home,True)

def sub(h,lede,sections,close=None,vis=''):
    s=''.join(f'<section class="block"><div class="wrap two"><h2>{a}</h2><div class="prose">{b}</div></div></section>' for a,b in sections)
    return f'<section class="head"><div class="wrap head-in"><div><h1>{h}</h1><p class="lede">{lede}</p></div><div class="vis">{vis}</div></div></section>{s}{close if close is not None else cta()}'

page('for-banks.html','For banks and payment providers | Gleipnir','Check before an AI agent’s transfer goes out: who signed off, how much, to whom. Signed proof for disputes and audits.',sub('For banks and payment providers','An AI agent starts a transfer. Your API sees a valid call. One check tells you whether someone who may sign for the company allowed it.',[
('What the check does','<p>The mandate says which agent, from which accounts, to which payees, how much and until when. It is signed by a signatory, alone or jointly.</p><p>Before you execute, the checker verifies the signatures against your own KYB records, checks revocation and limits, and signs its answer. That record works as proof later.</p>'+V_OUT),
('Why the bank’s records','<p>Trust comes from what you already know: your KYB and the keys you enrolled for each signatory. An LEI or vLEI is optional, for cross-bank cases. The mandate alone never makes someone a signatory.</p><p>A changed bank account on a known payee is blocked. That is the scam agents fall for first.</p>'),
('Why now','<blockquote>“…proving that an agent has the authority to pay on the buyer’s behalf.”<cite><a href="https://www.federalreserve.gov/newsevents/speech/files/waller20260929a.pdf">Governor Christopher Waller, Federal Reserve, Sibos 2026</a></cite></blockquote><p>€2.2bn was lost to credit transfer fraud in the EEA in 2024 (<a href="https://www.banque-france.fr/en/press-release/joint-eba-ecb-report-payment-fraud-strong-authentication-remains-effective-fraudsters-are-adapting">EBA and ECB</a>). Businesses reported $3.05bn in email payment fraud to the FBI for 2025 (IC3). A mandate does not catch all of that. It does stop an agent paying someone the company never approved.</p>'),
('How you try it','<p>Shadow mode: the check runs next to your flow, on test data or copies. It has no access to funds and no effect on your payments. You run the open-source checker yourself, or use a hosted test setup.</p><p>It maps to ISO 20022 pain.001, and Python and TypeScript checkers pass the same test vectors. Nobody runs it in production yet.</p><div class="btns"><a class="btn line" href="/demo/">See a payment checked</a><a class="btn line" href="/spec">Read the spec</a></div>')],vis=V_BANK))

page('for-platforms.html','For teams building AI agents | Gleipnir','Give your agent a permission the other side can check, across banks, companies and protocols. Open spec, checkers and MCP server.',sub('For teams building agents','Your agent gets stopped because nobody can tell who sent it. Limits inside your own product don’t help once the agent leaves it.',[
('What you get','<p>Your customer signs one mandate for one agent with a passkey. The agent carries it to the bank, supplier or company it deals with, and that side can check it without calling you.</p><p>Your customer can revoke it, and you stop writing separate rules for every counterparty.</p>'),
('For payments','<p>The agent signs each payment with its own key and attaches the mandate. The bank’s checker decides. There are worked examples for Stripe Treasury and Increase on GitHub, and an MCP server so an agent can use it as a tool.</p>'),
('For agent protocols','<p>Spec 0.6 adds a profile for protocols where an agent proves its own key on each request:</p><ul><li>the agent is bound by key thumbprint</li><li>counterparties are named as domains</li><li>no personal data in what the operator relays</li><li>the person approves a single operation with a passkey</li><li>revocation through a Token Status List</li></ul><p>It is a draft written around payments. Other actions are open work, and we want to do them with real teams.</p>'),
('What it does not do','<p>It proves who allowed what. It does not catch a bad decision inside the allowed scope, or a prompt injection that stays within it. And a counterparty has to choose to check it, which most don’t do yet.</p><div class="btns"><a class="btn line" href="/spec">Read the spec</a><a class="btn line" href="/skills.md">Agent guide</a></div>')],vis=V_PLAT))

page('when-agents-call.html','When AI agents call you | Gleipnir','AI agents call collectors, insurers and support lines for customers. A mandate link lets your team see who sent the agent and what it may do.',sub('When AI agents call you','A voice says it’s calling for your customer. Detection tells you it’s a bot. It doesn’t tell you the customer sent it, or what it may agree to.',[
('What a mandate link shows','<p>The customer signs a short statement: which agent, toward which company, what it may do, up to how much, until when. The agent gives your team the link and reads out a short code.</p><p>Your team opens the link. The page checks the signature in the browser and shows the scope and the code to match. No account and no integration.</p><div class="btns"><a class="btn line" href="/link/">Create one and try it</a></div>'),
('What it doesn’t prove','<p>On its own, a link proves that the holder of a key signed this scope. It doesn’t prove that the holder is your customer. For that you still tie the key to someone you know, for example during your normal verification.</p><p>Whether it satisfies your rules is a question for your compliance team and counsel. We make no claim that it does.</p>'),
('Where it stands','<p>The link format is an experiment and may change. Nobody uses it in production. It is not for health data as it stands: a plan or clinic would need its own review first.</p>'),
('What we’d like to learn','<p>If agents already reach you:</p><ul><li>how many calls a month, and what you do with them</li><li>who decided that, and what they would accept instead</li><li>what one wrong call costs you</li></ul><p>Even a short answer helps.</p>')],cta('Do AI agents reach your team?','Tell us what happens today. A short reply is plenty.'),vis=V_CALL))

page('know-your-agent.html','Know Your Agent (KYA): what it means | Gleipnir','Know Your Agent means knowing who an AI agent acts for and what it may do. What exists today, and where signed mandates fit.',sub('Know Your Agent','Know Your Customer asks who you are dealing with. Know Your Agent asks who an AI agent acts for and what it may do.',[
('What exists today','<p>Card networks are building agent checks for card purchases. Payment apps have limits that work inside the app. Agent protocols are starting to define how an agent proves its key.</p><p>Bank transfers, phone calls and portals have no shared way to check who sent an agent. Protocols such as PAP and PACT leave signed approvals and revocation open.</p>'),
('Where we fit','<p>We work on the second and third questions: one signed mandate the other side can check, usable next to whatever identifies the agent. We don’t verify identities: a bank’s KYB, a register or a vLEI issuer does that.</p><p>The format is an <a href="/spec">open specification (version 0.6, draft)</a> with Python and TypeScript checkers. We also work in the open with the Decentralized Identity Foundation’s groups on agent authority.</p>')],vis=V_KYA))

page('spec.html','Mandate specification 0.6 (draft) | Gleipnir','The open Gleipnir mandate format: mandate, payment, decision, revocation, delegation and an agent protocol profile. Apache 2.0.',sub('The mandate specification',f'Version 0.6, a draft. A person who may sign states what one agent may do, and the other side checks it and records a signed decision.',[
('Objects',V_CHAIN+'<dl class="defs"><dt>Mandate</dt><dd>Company, agent, signers, accounts, payees, rails, limits and validity. Signed with a passkey (WebAuthn), Ed25519 or ECDSA P-256, alone or jointly.</dd><dt>Payment</dt><dd>The transfer the agent wants to make, bound to the mandate by hash and signed by the agent.</dd><dt>Decision</dt><dd>Allow, block or escalate, with reason codes, signed by the checker.</dd><dt>Revocation</dt><dd>Withdrawing a mandate, effective from the next check. Signed status lists and Token Status List.</dd><dt>Override</dt><dd>A person signs a decision on an escalated payment.</dd><dt>Delegation</dt><dd>Authority passed down a chain, never wider than its source.</dd><dt>Operation approval</dt><dd>A person’s signature over one revision of one operation, for agent protocols (0.6).</dd></dl>'),
('Where trust comes from','<p>Only from the checker’s own records, such as a bank’s KYB and enrolled keys, or a vLEI credential. Never from the mandate itself. After that, every link is a signature.</p>'),
('Scope of this version','<p>0.6 is written for company payments, with a profile for agent protocols in section 14. Use by consumers and for actions other than payments is open work. The experimental <a href="/link/">mandate link</a> is a separate prototype, outside this spec.</p>'),
('Encoding and interoperability','<p>RFC 8785 canonical JSON, SHA-256, base64url without padding, strict RFC 3339 timestamps, closed object shapes. ISO 20022 pain.001 mapping. RFC 7638 key thumbprints in the agent profile.</p><p>A Python reference and a TypeScript port pass the same published test vectors and verify each other’s decisions. Licence: Apache 2.0.</p>'+f'<div class="btns"><a class="btn line" href="{SPEC}">Read the full spec on GitHub</a><a class="btn line" href="/demo/">Payment demo</a></div>')],vis=V_SPEC))

imp=open(f'{SRC}/imprint.html').read(); pri=open(f'{SRC}/privacy.html').read()
get=lambda t:re.search(r'<main[^>]*>(.*)</main>',t,re.S).group(1)
i=get(imp).replace('Gleipnir is an early-stage project building Know Your Agent (KYA) checks for bank payments: banks and payment service providers verify that an AI agent is authorized by a company before executing its transfer.','Gleipnir is an early-stage project building signed mandates for AI agents: the other side can check who sent an agent and what it may do.')
p=get(pri).replace('Last updated: 14 October 2026','Last updated: 4 November 2026').replace('The example on the homepage runs entirely in your browser and sends nothing.','The examples on the homepage and the demo run entirely in your browser and send nothing. A mandate link keeps its contents after the # in the address, which browsers do not send to our server. If a link names a status address, the check page asks that address whether the link was revoked.')
page('imprint.html','Imprint | Gleipnir','Imprint of getgleipnir.com.',f'<section class="legal"><div class="wrap">{i}</div></section>')
page('privacy.html','Privacy | Gleipnir','Privacy notice of getgleipnir.com.',f'<section class="legal"><div class="wrap">{p}</div></section>')
page('404.html','Page not found | Gleipnir','This page does not exist.','<section class="head"><div class="wrap"><h1>This page doesn’t exist</h1><p class="lede">Go back to the <a href="/">home page</a> or read the <a href="/spec">spec</a>.</p></div></section>')
# demo: drop netlify-injected og image
d=open(f'{OUT}/demo/index.html').read(); d=re.sub(r'<meta property="og:image[^>]*>\n?','',d); open(f'{OUT}/demo/index.html','w').write(d)
# sitemap
locs=['','know-your-agent','for-banks','for-platforms','when-agents-call','spec','demo/','link/','imprint','privacy']
open(f'{OUT}/sitemap.xml','w').write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+''.join(f'  <url><loc>https://getgleipnir.com/{l}</loc><lastmod>2026-11-04</lastmod></url>\n' for l in locs)+'</urlset>\n')
# headers: pretty URLs need their own CSP lines
h=open(f'{OUT}/_headers').read()
csp=re.search(r'^/\n  (Content-Security-Policy: .*)$',h,re.M).group(1)
for p in ['/for-banks','/for-platforms','/when-agents-call','/know-your-agent','/spec','/imprint','/privacy']:
    h+=f'{p}\n  {csp}\n'
open(f'{OUT}/_headers','w').write(h)
# llms / skills: lead with the broader mandate
top="""# Gleipnir

> Gleipnir (getgleipnir.com) makes signed mandates for AI agents, a power of attorney the other side can check. A person or company signs what one agent may do: for whom, toward whom, how much, until when. A bank, payment provider, insurer or call centre can check the signature, the scope and revocation before acting. Company payments are the first and most complete profile (spec 0.6, draft). The mandate link for agents acting for people is experimental. Other uses are open work. No production customers yet.

Pages: /for-banks, /for-platforms, /when-agents-call, /know-your-agent, /spec, /link/, /demo/.
"""
l=open(f'{OUT}/llms.txt').read()
l=top+l[l.index('\nNot to be confused'):]
l=l.replace('- Company finance teams: one console for which agents can pay, how much and to whom, with revocation.\n','')
open(f'{OUT}/llms.txt','w').write(l)
l=open(f'{OUT}/llms.txt').read().replace('specification 0.4','specification 0.6');open(f'{OUT}/llms.txt','w').write(l)
k=open(f'{OUT}/skills.md').read().replace("judge whether it fits their payment flow.","judge whether it fits what their agent does. Company payments are the most complete use case and the rest of this guide covers them. For agents acting toward call centres, insurers or support teams, see /when-agents-call: the mandate link there is experimental.").replace('the next step is a free design-partner pilot: one payment flow in a sandbox','the next step is a free test with us: one flow in a test environment')
open(f'{OUT}/skills.md','w').write(k)
open(f'{OUT}/netlify.toml','w').write('[build]\n  publish = "."\n')

# og, indexnow, skills
shutil.copy(f'{HERE}/og-image.png',f'{OUT}/og-image.png')
key=open(f'{HERE}/indexnow.key').read().strip(); open(f'{OUT}/{key}.txt','w').write(key)
shutil.copy(f'{HERE}/skills_body.md',f'{OUT}/skills.md')
# demo: old styles kept for its widgets, new header
leg=open(f'{SRC}/assets/site.css').read().replace('url("fonts/','url("/assets/fonts/'); open(f'{OUT}/demo/legacy.css','w').write(leg)
d=open(f'{OUT}/demo/index.html').read()
d=d.replace('href="/assets/site.css"','href="/demo/legacy.css"')
nav=''.join(f'<a href="{h}">{t}</a>' for h,t in NAV)
d=re.sub(r'<nav class="nav".*?</nav>',f'<nav class="nav" aria-label="Main">{nav}</nav>',d,flags=re.S)
d=d.replace('GLEIPNIR','Gleipnir').replace(' <span aria-hidden="true">→</span>','').replace('Start the demo →','Start the demo').replace('<p class="eyebrow" id="eyebrow">Live demo</p>','<p class="eyebrow" id="eyebrow">Payment demo</p>').replace('?subject=Gleipnir%20pilot','?subject=Test%20one%20flow').replace('© 2026 Gleipnir · Vienna, Austria · <a href="/imprint">Imprint</a> · <a href="/privacy">Privacy</a>','Vienna, Austria. <a href="/imprint">Imprint</a>. <a href="/privacy">Privacy</a>.').replace('<title>Live demo · Gleipnir</title>','<title>Payment demo | Gleipnir</title>')
open(f'{OUT}/demo/index.html','w').write(d)
open(f'{OUT}/demo/demo.css','a').write("""
/* align with the new site */
.brand{letter-spacing:0;font-size:1.25rem}.btn{border-radius:6px}.btn:hover{transform:none}.demo-steps li{border-radius:4px}.demo-bank,.card{border-radius:3px}.eyebrow{text-transform:none;letter-spacing:0;font-size:.95rem;color:var(--soft)}.demo-bank-h{text-transform:none;letter-spacing:0;font-size:.95rem}
@media(max-width:900px){.top{flex-wrap:wrap}.nav{display:flex;order:3;flex-basis:100%;overflow-x:auto;white-space:nowrap;gap:18px}}
""")
# link pages
THEME="""
/* brand */
@font-face{font-family:"Newsreader";src:url("/assets/fonts/newsreader-latin-wght-normal.woff2") format("woff2");font-weight:200 800;font-display:swap}
@font-face{font-family:"Schibsted Grotesk";src:url("/assets/fonts/schibsted-grotesk-latin-wght-normal.woff2") format("woff2");font-weight:400 900;font-display:swap}
:root:root:root{color-scheme:light;--paper:#F4F2EE;--sheet:#FBF8F1;--ink:#14161C;--muted:#4A4D56;--rule:#DFDBD3;--steel:#7A5B22;--ok:#176B41;--bad:#A93A25;--warn:#7E5412;--focus:#C9A45C}
body{font-family:"Schibsted Grotesk",system-ui,sans-serif}
h1{font-family:"Newsreader",Georgia,serif;font-weight:400;font-size:2.6rem;line-height:1.08;letter-spacing:-.012em}
.gbar{background:#0C0E13;color:#F2EDE3;padding:16px}.gbar div{max-width:42rem;margin:0 auto;display:flex;justify-content:space-between;align-items:center;gap:16px}
.gbar a{color:inherit;text-decoration:none}.gbar .g{display:inline-flex;gap:10px;align-items:center;font:500 1.25rem "Newsreader",Georgia,serif}.gbar svg{width:24px;height:26px;color:#C9A45C}.gbar small{font-size:.9rem;opacity:.8}
.verdict{background:var(--sheet)!important}
.exbtn{appearance:none;background:none;border:1px solid var(--ink);color:var(--ink);border-radius:6px;padding:9px 15px;font:600 .92rem inherit;cursor:pointer;margin:0 0 1rem}
"""
BAR=f'<header class="gbar"><div><a class="g" href="/" aria-label="Gleipnir home">{MARK}<span>Gleipnir</span></a><small><a href="/when-agents-call">How this works</a></small></div></header>'
for f,c in [('link/index.html','link/link.css'),('link/v/index.html','link/v/check.css')]:
    h=open(f'{OUT}/{f}').read().replace("img-src 'self' data:;","img-src 'self' data:; font-src 'self';").replace('<body>','<body>\n'+BAR)
    if f=='link/index.html':
        h=h.replace('<form id="form" novalidate>','<button type="button" class="exbtn" id="example">Fill in an example</button>\n  <form id="form" novalidate>').replace('<script src="link.js" defer></script>','<script src="link.js" defer></script>\n<script src="example.js" defer></script>')
        shutil.copy(f'{HERE}/example.js',f'{OUT}/link/example.js')
    open(f'{OUT}/{f}','w').write(h); open(f'{OUT}/{c}','a').write(THEME)
sm=open(f'{OUT}/sitemap.xml').read(); open(f'{OUT}/sitemap.xml','w').write(sm)

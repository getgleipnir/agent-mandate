import os,shutil,re,sys,json,urllib.parse
SRC,OUT=sys.argv[1],sys.argv[2]; HERE=os.path.dirname(os.path.abspath(__file__))
if os.path.exists(OUT): shutil.rmtree(OUT)
PUB=f'{OUT}/public'; shutil.copytree(SRC,PUB)
for f in ['_headers']:
    pass
os.makedirs(f'{OUT}/netlify/functions')
for f in ['handler.mjs','link-status.mjs']: shutil.copy(f'{HERE}/fn/{f}',f'{OUT}/netlify/functions/{f}')
open(f'{OUT}/package.json','w').write(json.dumps({"name":"gleipnir-site","private":True,"type":"module","dependencies":{"@netlify/blobs":"^8.1.0"}},indent=2))
open(f'{OUT}/netlify.toml','w').write('[build]\n  publish = "public"\n  functions = "netlify/functions"\n')
GH='https://github.com/getgleipnir/agent-mandate'; SPEC=GH+'/blob/kya-mandate-spec/spec/mandate.md'
MAIL='mailto:ivan.voloshyn@getgleipnir.com?subject=Test%20one%20flow'; BOOK='https://cal.com/ivan-voloshyn-hfzit4/30min'
AR=' <span aria-hidden="true">→</span>'
CLAUDE='https://claude.ai/new?q='+urllib.parse.quote('I want to understand Gleipnir (signed mandates for AI agents) and whether it fits what our agent does, or the agents that reach us. Read https://getgleipnir.com/skills.md and https://getgleipnir.com/llms.txt, explain it in plain words, say honestly what it does not do, and ask me what our agent does today.')
BRAND='<svg viewBox="0 0 34 30" aria-hidden="true"><g fill="none" stroke="#C9A45C" stroke-linecap="round"><path d="M3 23 C 9 5, 16 30, 21 13 S 31 8, 31 8" stroke-width="3"/><path d="M3 27 C 9 11, 16 34, 21 18 S 31 13, 31 13" stroke-opacity=".5" stroke-width="1.8"/></g></svg>'
open(f'{PUB}/assets/site.css','a').write(open(f'{HERE}/site_add.css').read())
shutil.copy(f'{HERE}/site_tabs.js',f'{PUB}/assets/site.js')
shutil.copy(f'{HERE}/og-image.png',f'{PUB}/og-image.png')
key=open(f'{HERE}/indexnow.key').read().strip(); open(f'{PUB}/{key}.txt','w').write(key)
shutil.copy(f'{HERE}/skills_body.md',f'{PUB}/skills.md')

def head(path,title,desc,extra=''):
    url='https://getgleipnir.com/'+path.replace('index.html','').replace('.html','')
    ld=json.dumps({"@context":"https://schema.org","@type":"Organization","name":"Gleipnir","url":"https://getgleipnir.com/","logo":"https://getgleipnir.com/assets/icons/icon-512.png","email":"ivan.voloshyn@getgleipnir.com","description":"A power of attorney for AI agents: a person or company signs what one agent may do, and the other side can check it before acting.","disambiguatingDescription":"Gleipnir (getgleipnir.com) is a Vienna-based startup. It is not the Gleipnir desktop app for running AI coding agents (gleipnir.app).","sameAs":["https://github.com/getgleipnir"]})
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#0C0E13">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Gleipnir"><meta property="og:url" content="{url}"><meta property="og:title" content="{title}"><meta property="og:description" content="{desc}"><meta property="og:image" content="https://getgleipnir.com/og-image.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{title}"><meta name="twitter:description" content="{desc}"><meta name="twitter:image" content="https://getgleipnir.com/og-image.png">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/favicon.ico" sizes="any"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest">
<link rel="alternate" type="text/plain" href="/llms.txt" title="LLM summary"><link rel="alternate" type="text/markdown" href="/skills.md" title="Agent guide">
<link rel="preload" href="/assets/fonts/schibsted-grotesk-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/site.css">
<script type="application/ld+json">{ld}</script>
{extra}</head>
<body>
<a class="skip" href="#main">Skip to content</a>
'''
HDR=f'''<header class="wrap top">
  <a class="brand" href="/" aria-label="Gleipnir home">{BRAND}GLEIPNIR</a>
  <nav class="nav" aria-label="Main"><a href="/#how">How it works</a><a href="/#who">Who it’s for</a><a href="/know-your-agent">Know Your Agent</a><a href="/demo/">Live demo</a><a href="/link/">Mandate link</a><a href="/spec">Spec</a></nav>
  <a class="btn primary sm" href="{BOOK}">Book a call{AR}</a>
</header>
'''
FOOT=f'''<footer class="foot-d">
  <div class="wrap foot-cols">
    <div><h4>Product</h4><a href="/#how">How it works</a><a href="/demo/">Live demo</a><a href="/link/">Mandate link</a><a href="/limits">What it doesn’t do</a></div>
    <div><h4>Who it’s for</h4><a href="/for-banks">Banks and PSPs</a><a href="/for-platforms">Teams building agents</a><a href="/when-agents-call">Teams agents call</a></div>
    <div><h4>Developers</h4><a href="/know-your-agent">Know Your Agent</a><a href="/spec">Mandate spec</a><a href="/skills.md">Agent guide</a><a href="{GH}" rel="noopener">GitHub</a></div>
    <div><h4>Company</h4><a href="/#team">Team</a><a href="{BOOK}">Book a call</a><a href="mailto:ivan.voloshyn@getgleipnir.com">Email</a><a href="/imprint">Imprint</a><a href="/privacy">Privacy</a></div>
  </div>
  <div class="wrap foot-base"><a class="brand" href="/" aria-label="Gleipnir home">{BRAND}GLEIPNIR</a><span>© 2026 Gleipnir · Vienna, Austria</span></div>
</footer>
<script src="/assets/site.js" defer></script>
</body>
</html>
'''
CARD_FAN='''<div class="ui fan"><div class="ui-row head"><span class="ui-label">One mandate · signed once</span></div><div class="ui-row"><span>A bank<small>before it pays</small></span><span class="ui-pill ok">can check</span></div><div class="ui-row"><span>A supplier<small>before it ships</small></span><span class="ui-pill ok">can check</span></div><div class="ui-row"><span>A support line<small>before it talks</small></span><span class="ui-pill ok">can check</span></div><p class="ui-cap">Example. They have to choose to check it.</p></div>'''
CARD_CODE='''<div class="code"><p><span class="c-m">POST</span> /check</p><p class="c-d">{ "mandate": { … signed by K. Berger },</p><p class="c-d">&nbsp;&nbsp;"payment": { "amount": "18400.00",</p><p class="c-d">&nbsp;&nbsp;&nbsp;&nbsp;"payee": "Brenner Stahl AG" } }</p><p class="c-gap"></p><p><span class="c-ok">200</span> { "outcome": <span class="c-ok">"allow"</span>,</p><p class="c-d">&nbsp;&nbsp;"decision": { … signed by the bank } }</p><p class="c-cap">Open-source reference checker. You can run it today.</p></div>'''
CARD_CALL='''<div class="callui"><p class="say a">Hi, I’m an AI assistant calling for Jane Doe about her account.</p><p class="say b">How do I know she sent you?</p><p class="say a">I’ve sent you a link. The code is 3F9 A21.</p><div class="ui"><div class="ui-row head"><span class="ui-label">Mandate link</span><span class="ui-pill ok">signature valid</span></div><div class="ui-row"><span>May</span><b>Plan up to $200 a month</b></div><div class="ui-row"><span>Code</span><b class="mono">3F9 A21</b></div></div></div>'''
CTA=f'''<section id="pilot" class="cta-band"><div class="wrap cta-in"><h2>Test one flow with us, free</h2><p>The check runs next to what you do today, with no access to funds and no effect on your flow. We are early, and we want real cases.</p><div class="btns center"><a class="btn primary" href="{BOOK}">Book a call</a><a class="btn line" href="{MAIL}">Email Ivan</a></div></div></section>
'''
FAQ=[('What is Gleipnir?','A power of attorney for AI agents. A person or company signs what one agent may do: for whom, toward whom, how much, until when. The other side can check it before acting.'),
('What does “Know Your Agent” mean?','Banks already know their customers (KYC). Know Your Agent means also knowing who an AI agent acts for and what it is allowed to do. <a href="/know-your-agent">More on Know Your Agent</a>.'),
('Do you touch the money?','No. The bank sends the payment as usual. The check can run on its own systems without calling us.'),
('Don’t Visa and Mastercard already do this?','For card payments, yes. Most business money moves by bank transfer, and phone lines and portals have nothing like it either.'),
('We already set limits in our app. Why this?','Those limits only work inside that app. A mandate is signed by the person it comes from, and anyone can check it.'),
('Does it stop an agent making mistakes?','No. It proves who allowed what. A fake invoice from an approved supplier, or a bad call inside the allowed scope, isn’t something a mandate can catch. <a href="/limits">What it doesn’t do</a>.'),
('Does it prove who signed?','Only if the checker knows the key. A bank uses its own records of who may sign. A mandate link alone proves that the holder of a key signed this, nothing more.'),
('Is it legally binding?','We don’t know yet. It will differ by country and by what the agent does, so ask your counsel.'),
('Can I use it today?','The specification, the checkers, an MCP server and the demos are open source under Apache 2.0. We have no production customers yet.')]
faq=''.join(f'<details><summary>{q}</summary><p>{a}</p></details>' for q,a in FAQ)
home=head('index.html','Gleipnir: a power of attorney for AI agents','Your AI agent pays, calls and files for you. Gleipnir lets the bank, insurer or call centre on the other side check who sent it and what it may do.')+HDR+f'''<main id="main">
<section class="hero"><div class="hero-panel"><div class="glow" aria-hidden="true"></div><div class="hero-grid">
<div class="hero-copy"><a class="pill" href="#agents"><span class="pill-tag">New</span>Let Claude explain Gleipnir to you{AR}</a>
<h1>A power of attorney for AI agents</h1>
<p class="lede">Your AI agent pays, calls and files for you. Gleipnir lets the bank, insurer or call centre on the other side check it was actually allowed to: who signed off, what for, how much.</p>
<div class="btns"><a class="btn primary" href="#pilot">Test one flow, free</a><a class="btn ghost" href="/link/">Create a mandate link</a></div>
<p class="fine">Know Your Agent (KYA), starting with bank transfers. Open source. We never touch your money.</p></div>
<div class="hero-demo"><div class="scen-tabs" id="scen-tabs" role="tablist" aria-label="Example use cases"></div>
<figure class="card" aria-label="Example: the other side checks what an AI agent asks for">
<div class="card-top"><span id="card-top-t">payment 7Q-20418 · before it is sent</span><span class="badge" id="badge">not checked</span></div>
<dl class="rec" id="rec"><dt>company</dt><dd>Nordhafen Logistik GmbH</dd><dt>AI agent</dt><dd>ap-agent v2 · pays suppliers</dd><dt>signed by</dt><dd>K. Berger · may sign for the company</dd><dt>limit</dt><dd>€25,000 per payment</dd><dt>payment</dt><dd>€18,400.00 · SEPA</dd><dt>to</dt><dd>Brenner Stahl AG</dd></dl>
<div class="card-actions" id="card-actions"></div><ol class="checks" id="checks" aria-live="polite"></ol><p class="verdict" id="verdict"></p><p class="card-note" id="card-note">Example with made-up data. Nothing is sent.</p></figure></div>
</div>
<div class="strip" aria-label="Where agents act"><span class="mark-w dim">Where agents act</span><span class="mark-w">Bank transfers</span><span class="mark-w">Phone calls</span><span class="mark-w">Portals</span><span class="mark-w">Agent protocols</span></div>
</div></section>
<section id="agents" class="sec"><div class="wrap split"><div class="split-copy rv"><h2>Not sure it fits? Ask your AI.</h2>
<p class="intro">One click and Claude reads our docs, explains Gleipnir in plain words and asks what your agent does today. Works with ChatGPT and other AI tools too.</p>
<div class="btns"><a class="btn primary" href="{CLAUDE}" rel="noopener">Ask Claude about Gleipnir</a><a class="btn line" href="/skills.md">Read the agent guide{AR}</a></div>
<ul class="tags" aria-label="What the other side checks"><li>Who signed off</li><li>What for</li><li>How much</li><li>Until when</li><li>Switch off anytime</li><li>Proof for later</li></ul></div>
<div class="tile tall rv" aria-hidden="true"><div class="chat"><div class="bubble you">Explain getgleipnir.com in one minute. Would it help our AI agent that calls insurers for clinics?</div><div class="bubble ai"><p>Maybe. Today the insurer can’t tell who sent it:</p><ol class="flow"><li><b>1</b>The clinic signs what the agent may ask, and of whom</li><li><b>2</b>The agent passes on a link and reads out a code</li><li><b>3</b>The insurer checks the signature and the scope</li></ol><p class="mutedish">The hard part: the insurer has to agree to check it.</p></div></div></div></div></section>
<section id="how" class="sec"><div class="wrap"><h2 class="sec-title">How it works</h2><div class="grid3">
<article class="feat rv"><h3>1. Someone signs off</h3><p>A person, or someone who may sign for a company, decides what the agent can do: how much, toward whom, until when.</p><div class="tile" aria-hidden="true"><div class="ui mandate"><div class="ui-row head"><span class="ui-label">Power of attorney</span><span class="ui-pill ok">signed</span></div><div class="ui-big">ap-agent v2</div><div class="ui-row"><span>Signed by</span><b>K. Berger</b></div><div class="ui-row"><span>Up to</span><b>€25,000 per payment</b></div><div class="ui-row"><span>Pays</span><b>approved suppliers</b></div></div></div></article>
<article class="feat rv"><h3>2. The signer has to count</h3><p>A bank checks the signer against who it verified when the account opened. Elsewhere, the key has to be tied to someone you know.</p><div class="tile" aria-hidden="true"><div class="ui"><div class="ui-row head"><span class="ui-label">May sign · known to the bank</span></div><div class="person-row"><span class="av a1">KB</span><span><b>K. Berger</b><small>Authorized signatory</small></span><span class="tick">✓</span></div><div class="person-row"><span class="av a2">MH</span><span><b>M. Hofer</b><small>Managing director</small></span><span class="tick">✓</span></div></div></div></article>
<article class="feat rv"><h3>3. Only what was allowed</h3><p>If the agent is tricked or asks for more, it stops there. Anything new needs a new signature.</p><div class="tile" aria-hidden="true"><div class="ui"><div class="ui-row head"><span class="ui-label">What the agent may do</span></div><div class="ui-row"><span>Pay Brenner Stahl AG<small class="mono">AT61 …3201</small></span><span class="ui-pill ok">allowed</span></div><div class="ui-row"><span>Pay Kessler Metall GmbH<small class="mono">DE44 …2931</small></span><span class="ui-pill stop">not allowed</span></div></div></div></article>
<article class="feat rv"><h3>4. One clear answer</h3><p>Allowed, blocked or sent to a person. Always with the reason.</p><div class="tile" aria-hidden="true"><div class="stack-ui"><div class="ui slim"><span class="dot ok"></span><span><b>Allowed</b><small>€18,400 · approved supplier</small></span></div><div class="ui slim"><span class="dot warn"></span><span><b>Sent to a person</b><small>a new payee, up to €5,000</small></span></div><div class="ui slim"><span class="dot stop"></span><span><b>Blocked</b><small>a known name, a new account</small></span></div></div></div></article>
<article class="feat rv"><h3>5. Switch it off anytime</h3><p>Revoke it and the agent stops counting from the very next check.</p><div class="tile" aria-hidden="true"><div class="ui"><div class="ui-row head"><span class="ui-label">ap-agent v2</span><span class="switch off"><i></i></span></div><div class="ui-big stop-t">Switched off</div><div class="ui-row"><span>by</span><b>M. Hofer</b></div><div class="ui-row"><span>next request</span><b class="stop-t">refused</b></div></div></div></article>
<article class="feat rv"><h3>6. Proof for later</h3><p>The decision is signed, so a dispute months later has an answer: who allowed what.</p><div class="tile" aria-hidden="true"><div class="ui"><div class="ui-row head"><span class="ui-label">Payment 7Q-20418</span><span class="ui-pill ok">paid</span></div><div class="ui-row"><span>allowed by</span><b>K. Berger</b></div><div class="ui-row"><span>checked</span><b>before sending</b></div><div class="ui-row"><span>signature</span><b class="mono">4b7d…e91a</b></div></div></div></article>
</div></div></section>
<section class="band"><div class="wrap quote-grid"><figure class="quote"><p class="q-src">Federal Reserve · Sibos 2026</p><blockquote>“…proving that an agent has the authority to pay on the buyer’s behalf.”</blockquote><figcaption><a href="https://www.federalreserve.gov/newsevents/speech/files/waller20260929a.pdf" rel="noopener">Governor Christopher Waller</a>, on what changes for payments with AI agents</figcaption></figure>
<div class="gap-card" aria-label="Who checks AI agents today"><p class="gap-h">Who checks AI agents today</p><div class="gap-row"><span>Card payments</span><b class="ok-t">Visa, Mastercard</b></div><div class="gap-row"><span>Inside one app</span><b class="muted-t">that app only</b></div><div class="gap-row"><span>Bank transfers</span><b class="stop-t">no shared check</b></div><div class="gap-row"><span>Phone lines, portals</span><b class="stop-t">bot or not, at best</b></div><div class="gap-row us"><span>With a signed mandate</span><b>anyone who opens it</b></div></div></div></section>
<section id="numbers" class="sec"><div class="wrap"><h2 class="sec-title">Why it matters</h2><div class="bento"><div class="b-big rv"><span class="b-num">€2.2bn</span><span class="b-rule"></span><p>lost to bank transfer fraud in Europe in 2024, up 16%.</p></div><div class="b-sm rv"><span class="b-num">$3.05bn</span><span class="b-rule"></span><p>lost by businesses to fake payment emails in 2025, reported to the FBI.</p></div><div class="b-sm rv"><span class="b-num">48%</span><span class="b-rule"></span><p>of companies let AI agents through by default and check later.</p></div></div>
<p class="fine-l">Sources: <a href="https://www.banque-france.fr/en/press-release/joint-eba-ecb-report-payment-fraud-strong-authentication-remains-effective-fraudsters-are-adapting" rel="noopener">EBA and ECB report</a> (data for 2024). FBI IC3 annual report 2025. Darwinium, Navigating Agentic Commerce 2026 (vendor survey). A mandate does not stop all of this. It stops an agent acting for someone who never allowed it.</p></div></section>
<section id="who" class="sec tight"><div class="wrap"><h2 class="sec-title">Who it’s for</h2>
<div class="row rv" id="banks"><div class="row-copy"><h3>Banks and PSPs: know before you send</h3><p>One quick check before an AI agent’s payment leaves. Your fraud team gets a clear answer, and proof if there is ever a dispute.</p><ul class="dots"><li>Yes, no or ask a person, with the reason</li><li>Runs on your systems, against your own records</li></ul><a class="more" href="/for-banks">For banks and PSPs{AR}</a></div><div class="tile wide" aria-hidden="true">{CARD_CODE}</div></div>
<div class="row flip rv" id="platforms"><div class="row-copy"><h3>Teams building agents: stop getting hung up on</h3><p>Your agent gets refused because nobody can tell who sent it. Give it a permission that works outside your product.</p><ul class="dots"><li>Signed by your customer with a passkey, revocable</li><li>Open spec, checkers and an MCP server</li></ul><a class="more" href="/for-platforms">For teams building agents{AR}</a></div><div class="tile wide" aria-hidden="true">{CARD_FAN}</div></div>
<div class="row rv" id="receivers"><div class="row-copy"><h3>Teams agents call: see who sent it</h3><p>Collectors, insurers and support lines already get AI callers. Detection tells you it’s a bot, not whether your customer sent it.</p><ul class="dots"><li>Open a link, match a code, read what was allowed</li><li>Experimental: try it and tell us what’s missing</li></ul><a class="more" href="/when-agents-call">When agents call you{AR}</a></div><div class="tile wide" aria-hidden="true">{CARD_CALL}</div></div>
<div class="row flip rv" id="identity"><div class="row-copy"><h3>No new paperwork</h3><p>We start from what the other side already knows about you. Extra proof is optional.</p><ul class="dots"><li>Nothing new to register for</li><li>Open format: anyone can check it without us</li></ul><a class="more" href="{GH}" rel="noopener">GitHub{AR}</a></div><div class="tile wide" aria-hidden="true"><div class="layers"><div class="layer l4">vLEI<small>optional</small></div><div class="layer l3">LEI<small>optional</small></div><div class="layer l2">Company register<small>optional</small></div><div class="layer l1">What the bank already knows<small>enough</small></div></div></div></div>
</div></section>
<section id="team" class="sec tight"><div class="wrap"><div class="team-head"><h2>Two founders in Vienna</h2><span class="useed">Part of u:seed · University of Vienna</span></div><div class="team">
<div class="person rv"><div class="person-top"><span class="av-l" aria-hidden="true">IV</span><div><h3>Ivan Voloshyn</h3><p class="role">Co-founder &amp; CEO</p></div></div><p>Writes the code, including the cryptography. Built Planara and ran online shops before this.</p><a class="more" href="https://www.linkedin.com/in/ivan-voloshyn-096715225/" rel="me noopener">LinkedIn{AR}</a></div>
<div class="person rv"><div class="person-top"><span class="av-l" aria-hidden="true">TK</span><div><h3>Tatiana Khokhlova</h3><p class="role">Co-founder</p></div></div><p>Turns law into rules software can check. Wrote the full legal rule set behind Planara.</p><a class="more" href="https://www.linkedin.com/in/tatiana-khokhlova-1691693a7/" rel="me noopener">LinkedIn{AR}</a></div></div></div></section>
<section id="faq" class="sec tight"><div class="wrap"><h2 class="sec-title">Questions</h2><div class="faq">{faq}</div><p class="fine-l more-q">More questions? Ask your AI to read our <a href="/skills.md">agent guide</a>, or write to <a href="mailto:ivan.voloshyn@getgleipnir.com">ivan.voloshyn@getgleipnir.com</a>.</p></div></section>
{CTA}</main>
'''+FOOT
open(f'{PUB}/index.html','w').write(home)

def doc(path,title,desc,eye,h1,lede,vis,body,cta=True):
    v=f'<div class="doc-vis"><div class="tile" aria-hidden="true">{vis}</div></div>' if vis else ''
    c=f'<div class="doc-cta"><h2>Test one flow with us, free</h2><p>The check runs next to what you do today, with no access to funds and no effect on your flow.</p><div class="btns spaced"><a class="btn primary" href="{BOOK}">Book a call</a><a class="btn line" href="{MAIL}">Email Ivan</a></div></div>' if cta else ''
    open(f'{PUB}/{path}','w').write(head(path,title,desc)+HDR+f'<main id="main" class="wrap plain doc"><p class="eyebrow">{eye}</p><h1>{h1}</h1><p class="doc-lede">{lede}</p>{v}{body}{c}</main>\n'+FOOT)
def inner(f):
    t=open(f'{SRC}/{f}').read(); m=re.search(r'<main[^>]*>(.*)</main>',t,re.S).group(1); return m
def strip_cta(s): return re.sub(r'<div class="doc-cta">.*?</div>\s*</div>','',s,flags=re.S)
def parts(f):
    s=strip_cta(inner(f)); e=re.search(r'<p class="eyebrow">(.*?)</p>',s,re.S); h=re.search(r'<h1>(.*?)</h1>',s,re.S); l=re.search(r'<p class="doc-lede">(.*?)</p>',s,re.S)
    return e.group(1) if e else '',h.group(1),l.group(1),s[l.end():]
OUTS='<div class="stack-ui"><div class="ui slim"><span class="dot ok"></span><span><b>allow</b><small>€18,400 to an approved supplier</small></span></div><div class="ui slim"><span class="dot warn"></span><span><b>escalate</b><small>new_payee · a person decides</small></span></div><div class="ui slim"><span class="dot stop"></span><span><b>block</b><small>payee_account_changed</small></span></div></div>'
e,h,l,b=parts('for-banks.html')
b=b.replace('23 ordered checks, each','Ordered checks, each')
doc('for-banks.html','For banks and PSPs: know the agent before you send | Gleipnir','Check before an AI agent’s transfer goes out: who signed off, how much, to whom. Signed proof for disputes and audits.',e,h,l,CARD_CODE,b)
e,h,l,b=parts('for-platforms.html')
extra='<h2>Beyond payments</h2><p>Spec 0.6 adds a profile for agent protocols: the agent is bound by its key, counterparties are domains, no personal data travels, and a person can approve one operation with a passkey. It is a draft written around payments. Other actions are open work, and we want to do them with real teams.</p><p>For agents that call or write to companies today, try the experimental <a href="/link/">mandate link</a>.</p>'
doc('for-platforms.html','For teams building AI agents | Gleipnir','Give your agent a permission the other side can check, across banks, companies and protocols. Open spec, checkers and an MCP server.','Teams building agents','For teams building agents','Your agent gets refused because nobody can tell who sent it. '+l.replace('Your customers’ AI agents pay invoices through you. Your partner bank','If it pays, your partner bank') ,CARD_FAN,extra+b)
doc('when-agents-call.html','When AI agents call you | Gleipnir','AI agents call collectors, insurers and support lines for customers. A mandate link lets your team see who sent the agent and what it may do.','Collectors, insurers, support lines','When AI agents call you','A voice says it’s calling for your customer. Detection tells you it’s a bot. It doesn’t tell you the customer sent it, or what it may agree to.',CARD_CALL,f'''<h2>What your team sees</h2><p>The customer signs a short statement: which agent, toward which company, what it may do, up to how much, until when. The agent gives your team the link and reads out a short code. Your team opens the link and sees the scope and the code to match. No account and no integration.</p><p><a class="btn line" href="/link/">Create one and try it{AR}</a></p>
<h2>What it doesn’t prove</h2><p>On its own, a link proves that the holder of a key signed this scope. It doesn’t prove that the holder is your customer. For that you tie the key to someone you know, or confirm identity as you do now. Whether it satisfies your rules is a question for your compliance team and counsel. We make no claim that it does.</p>
<h2>Where it stands</h2><p>The link format is an experiment and may change. Nobody uses it in production. Don’t use it for health data without your own review.</p>
<h2>What we’d like to learn</h2><ul><li>How many agent calls do you get a month, and what do you do with them?</li><li>Who decided that, and what would they accept instead?</li><li>What does one wrong call cost you?</li></ul><p>Even a short answer helps.</p>''')
LIM=[('It doesn’t catch bad decisions','An agent acting inside what was allowed can still be wrong. A fake invoice from an approved supplier passes.'),('Prompt injection inside the scope','If the agent is tricked into something the mandate allows, the check says allowed. The scope limits the damage, it doesn’t remove it.'),('Duplicate invoices with a new id','The same payment id is caught. The same invoice sent again with a new id, inside the limits, is not.'),('Skipping the check','Nothing forces anyone to run it. In shadow mode nothing is enforced by design.'),('A stolen signer device','Whoever holds the key can sign. Rotation and revocation help after the fact.'),('Who a link signer really is','A mandate link alone doesn’t identify the signer. The key has to be enrolled with someone who knows the person.'),('Revocation delay and trust','A check made before the revocation stands. The link status answer isn’t signed yet, so whoever controls the status host or the network could fake it.'),('Legal force','Whether a mandate counts as proof is open and differs by country. Nobody has tested it in a dispute yet.')]
doc('limits.html','What Gleipnir doesn’t do | Gleipnir','The risks a signed mandate does not solve, in plain words.','Read this first','What it doesn’t do','A signed mandate proves who allowed what. Here is what it leaves open. The full threat model is in the spec.','', '<div class="limit-grid">'+''.join(f'<div class="limit"><h3>{a}</h3><p>{b}</p></div>' for a,b in LIM)+f'</div><p>Full list: <a href="{SPEC}#11-threat-model" rel="noopener">spec section 11</a> and the <a href="{GH}/blob/kya-mandate-spec/docs/mandate-link.md" rel="noopener">mandate link notes</a>. Found another one? <a href="{GH}/issues" rel="noopener">Open an issue</a>.</p>',False)
e,h,l,b=parts('know-your-agent.html')
KV='<div class="layers"><div class="layer l3">Who is this agent?<small>identity, detection</small></div><div class="layer l2">Who sent it, what may it do?<small>the mandate</small></div><div class="layer l1">Can you prove it later?<small>signed decision</small></div></div>'
l2='Know Your Customer asks who you are dealing with. Know Your Agent asks who an AI agent acts for and what it may do.'
doc('know-your-agent.html','Know Your Agent (KYA): what it means | Gleipnir','Know Your Agent means knowing who an AI agent acts for and what it may do. What exists today, and where signed mandates fit.',e,'Know Your Agent (KYA)',l2,KV,b)
e,h,l,b=parts('spec.html')
SV='<div class="code"><p class="c-d">{ "v": "gleipnir/mandate/0.6",</p><p class="c-d">&nbsp;&nbsp;"company": { "name": "Nordhafen Logistik GmbH" },</p><p class="c-d">&nbsp;&nbsp;"agent": { "id": "ap-agent", "jkt": "aVBtapLd…" },</p><p class="c-d">&nbsp;&nbsp;"scope": { "max_per_payment": "500.00",</p><p class="c-d">&nbsp;&nbsp;&nbsp;&nbsp;"counterparties": ["shop.example.com"] },</p><p class="c-d">&nbsp;&nbsp;"sig": { "type": "webauthn", … } }</p><p class="c-cap">A mandate, shortened.</p></div>'
b=b.replace('23 ordered steps in five groups','Ordered steps in five groups')
b=f'<h2>Scope of this version</h2><p>0.6 is written for company payments, with a profile for agent protocols in section 14: agent key binding, counterparties as domains, principals without user data, per-operation approval and Token Status List. Use by consumers and for other actions is open work. The experimental <a href="/link/">mandate link</a> is a separate prototype.</p>'+b
doc('spec.html','Mandate specification 0.6 (draft) | Gleipnir','The open Gleipnir mandate format: mandate, payment, decision, revocation, delegation and an agent protocol profile. Apache 2.0.',e,h,l,SV,b,False)
for f,a,bb in [('imprint.html','Gleipnir is an early-stage project building Know Your Agent (KYA) checks for bank payments: banks and payment service providers verify that an AI agent is authorized by a company before executing its transfer.','Gleipnir is an early-stage project building signed mandates for AI agents: the other side can check who sent an agent and what it may do.'),('privacy.html','The example on the homepage runs entirely in your browser and sends nothing.','The examples on the homepage and the demo run entirely in your browser and send nothing. A mandate link keeps its contents after the # in the address, which browsers do not send to our server. If a link uses our status address, opening it asks our server whether it was revoked, so our host sees your IP address and which status address was asked. Revoking sends a random id, a public key and a signature. We store only that the id was revoked and when.')]:
    s=inner(f).replace(a,bb).replace('Last updated: 14 October 2026','Last updated: 4 November 2026')
    t=open(f'{SRC}/{f}').read()
    tt=re.search(r'<title>(.*?)</title>',t).group(1)
    open(f'{PUB}/{f}','w').write(head(f,tt,'Legal notice of getgleipnir.com.')+HDR+f'<main id="main" class="wrap plain">{s}</main>\n'+FOOT)
open(f'{PUB}/404.html','w').write(head('404.html','Page not found | Gleipnir','This page does not exist.')+HDR+'<main id="main" class="wrap plain"><h1>This page doesn’t exist</h1><p>Go to the <a href="/">home page</a> or read the <a href="/spec">spec</a>.</p></main>\n'+FOOT)
# demo
d=open(f'{PUB}/demo/index.html').read()
d=re.sub(r'<meta property="og:image[^>]*>\n?','',d)
d=re.sub(r'<nav class="nav".*?</nav>','<nav class="nav" aria-label="Main"><a href="/#how">How it works</a><a href="/#who">Who it’s for</a><a href="/know-your-agent">Know Your Agent</a><a href="/link/">Mandate link</a><a href="/spec">Spec</a></nav>',d,flags=re.S)
d=d.replace('?subject=Gleipnir%20pilot','?subject=Test%20one%20flow')
open(f'{PUB}/demo/index.html','w').write(d)
# link pages
THEME="""
/* brand */
@font-face{font-family:"Newsreader";src:url("/assets/fonts/newsreader-latin-wght-normal.woff2") format("woff2");font-weight:200 800;font-display:swap}
@font-face{font-family:"Schibsted Grotesk";src:url("/assets/fonts/schibsted-grotesk-latin-wght-normal.woff2") format("woff2");font-weight:400 900;font-display:swap}
:root:root:root{color-scheme:light;--paper:#F4F2EE;--sheet:#FFFFFF;--ink:#14161C;--muted:#454851;--rule:#E3E0DA;--steel:#7A5B22;--ok:#22915A;--bad:#C8452E;--warn:#B7791F;--focus:#C9A45C}
body{font-family:"Schibsted Grotesk",system-ui,sans-serif}
h1{font-family:"Newsreader",Georgia,serif;font-weight:400;font-size:2.8rem;line-height:1.05;letter-spacing:-.02em}
.gbar{background:#0C0E13;color:#F2EDE3;padding:16px}.gbar div{max-width:42rem;margin:0 auto;display:flex;justify-content:space-between;align-items:center;gap:16px}
.gbar a{color:inherit;text-decoration:none}.gbar .g{display:inline-flex;gap:12px;align-items:center;font:500 1.02rem "Newsreader",Georgia,serif;letter-spacing:.32em}.gbar svg{width:28px;height:24px}.gbar small{font-size:.9rem;opacity:.8}
.exbtn,.mylinks button{appearance:none;background:#fff;border:1px solid var(--ink);color:var(--ink);border-radius:999px;padding:8px 16px;font:600 .9rem "Schibsted Grotesk",sans-serif;cursor:pointer}
.exbtn{margin:0 0 1rem}
.verdict{background:var(--sheet)!important}
.mylinks{margin-top:2rem}.mylinks ul{list-style:none;padding:0;margin:.5rem 0 0}.mylinks li{display:flex;align-items:center;gap:14px;padding:10px 0;border-top:1px solid var(--rule)}.rv-st{color:var(--muted);font-size:.9rem}
"""
BAR=f'<header class="gbar"><div><a class="g" href="/" aria-label="Gleipnir home">{BRAND}GLEIPNIR</a><small><a href="/when-agents-call">How this works</a></small></div></header>'
for f,c in [('link/index.html','link/link.css'),('link/v/index.html','link/v/check.css')]:
    h=open(f'{PUB}/{f}').read().replace("img-src 'self' data:;","img-src 'self' data:; font-src 'self';").replace('<body>','<body>\n'+BAR)
    if f=='link/index.html':
        h=h.replace("connect-src 'none'","connect-src 'self'")
        h=h.replace('<form id="form" novalidate>','<button type="button" class="exbtn" id="example">Fill in an example</button>\n  <form id="form" novalidate>')
        h=h.replace('<script src="link.js" defer></script>','<script src="link.js" defer></script>\n<script src="example.js" defer></script>\n<script src="revoke.js" defer></script>')
        h=re.sub(r'Nothing is uploaded and this page makes no network requests\.','Nothing is uploaded when you sign. Only if you revoke does this page send a random id, a public key and a signature.',h)
        h=h.replace('<footer><p>Experimental format','<section class="mylinks" id="my-links-wrap" hidden><h2>Your links in this browser</h2><p class="help">Revoke one, then open it again. Revoking works only from this browser.</p><ul id="my-links"></ul></section>\n  <footer><p>Experimental format')
        shutil.copy(f'{HERE}/example.js',f'{PUB}/link/example.js'); shutil.copy(f'{HERE}/revoke.js',f'{PUB}/link/revoke.js')
    open(f'{PUB}/{f}','w').write(h); open(f'{PUB}/{c}','a').write(THEME)
# llms
l=open(f'{SRC}/llms.txt').read()
top="""# Gleipnir

> Gleipnir (getgleipnir.com) is a power of attorney for AI agents. A person or company signs what one agent may do: for whom, toward whom, how much, until when. A bank, payment provider, insurer or call centre can check the signature, the scope and revocation before acting. Company payments are the most complete profile (spec 0.6, draft). The mandate link for agents acting for people is experimental. Other uses are open work. No production customers yet. What it does not do: https://getgleipnir.com/limits

Pages: /for-banks, /for-platforms, /when-agents-call, /know-your-agent, /limits, /spec, /link/, /demo/.
"""
l=top+l[l.index('\nNot to be confused'):]
l=l.replace('- Company finance teams: one console for which agents can pay, how much and to whom, with revocation.\n','').replace('specification 0.4','specification 0.6').replace('version 0.4 draft','version 0.6 draft')
open(f'{PUB}/llms.txt','w').write(l)
locs=['','know-your-agent','for-banks','for-platforms','when-agents-call','limits','spec','demo/','link/','imprint','privacy']
open(f'{PUB}/sitemap.xml','w').write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+''.join(f'  <url><loc>https://getgleipnir.com/{x}</loc><lastmod>2026-11-04</lastmod></url>\n' for x in locs)+'</urlset>\n')
# headers
CSP="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests"
V=CSP.replace("connect-src 'self'","connect-src 'self' https:")
base="/*\n  X-Frame-Options: DENY\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()\n  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload\n"
pp=['/','/*.html','/assets/*','/demo/*','/link/','/link/index.html','/link/link.js','/link/link.css','/link/example.js','/link/revoke.js','/for-banks','/for-platforms','/when-agents-call','/know-your-agent','/limits','/spec','/imprint','/privacy']
open(f'{PUB}/_headers','w').write(base+''.join(f'{p}\n  Content-Security-Policy: {CSP}\n' for p in pp)+f'/link/v/*\n  Content-Security-Policy: {V}\n')

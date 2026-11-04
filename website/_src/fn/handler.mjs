// Revocation status for mandate links. Only someone holding the slot's key can revoke.
const SLOT = /^[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{43}$/;
const B64 = /^[A-Za-z0-9_-]{43}$/;
const CORS = { "access-control-allow-origin": "*", "cache-control": "no-store" };
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "content-type": "application/json" } });
const b64 = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
const unb64 = (u) => btoa(String.fromCharCode(...new Uint8Array(u))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function handle(req, store) {
  const path = new URL(req.url).pathname;
  if (req.method === "GET") {
    const slot = path.split("/").pop();
    if (!SLOT.test(slot)) return json({ error: "bad slot" }, 400);
    const hit = await store.get(slot);
    return json({ status: hit ? "revoked" : "active" });
  }
  if (req.method !== "POST" || path !== "/api/link-revoke") return json({ error: "not found" }, 404);
  const text = await req.text();
  if (text.length > 1024) return json({ error: "too large" }, 413);
  let body;
  try { body = JSON.parse(text); } catch { return json({ error: "bad json" }, 400); }
  const { slot, x, y, sig } = body || {};
  if (typeof slot !== "string" || !SLOT.test(slot) || typeof x !== "string" || !B64.test(x) || typeof y !== "string" || !B64.test(y) || typeof sig !== "string" || sig.length > 128) {
    return json({ error: "bad fields" }, 400);
  }
  // RFC 7638 thumbprint: the slot names exactly one key.
  const canon = `{"crv":"P-256","kty":"EC","x":"${x}","y":"${y}"}`;
  const thumb = unb64(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canon)));
  if (slot.split(".")[1] !== thumb) return json({ error: "key does not match" }, 403);
  let ok = false;
  try {
    const key = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", x, y, ext: true }, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, b64(sig), new TextEncoder().encode(`gleipnir/link-revoke/v0.1\n${slot}`));
  } catch { ok = false; }
  if (!ok) return json({ error: "bad signature" }, 403);
  await store.set(slot, new Date().toISOString());
  return json({ status: "revoked" });
}

import { getStore } from "@netlify/blobs";
import { handle } from "./handler.mjs";
export default async (req) => {
  try { return await handle(req, getStore({ name: "link-revocations", consistency: "strong" })); }
  catch { return new Response(JSON.stringify({ error: "unavailable" }), { status: 503, headers: { "access-control-allow-origin": "*", "cache-control": "no-store", "content-type": "application/json" } }); }
};
export const config = { path: ["/api/link-status/:slot", "/api/link-revoke"] };

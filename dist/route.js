"use strict";
// Next.js App Router adapter — turns the bridge contract into route
// handlers for app/api/geo-engine-bridge/[...path]/route.ts.
//
// Copy template/route.ts.txt to your app (or import and spread):
//
//   // app/api/geo-engine-bridge/[...path]/route.ts
//   export const runtime = "nodejs";            // fs store needs Node
//   export const dynamic = "force-dynamic";
//   import { geoengineRouteHandlers } from "@geoengine/nextjs/route";
//   const h = geoengineRouteHandlers();
//   export const GET = h.GET; export const POST = h.POST;
//   export const PUT = h.PUT;  export const DELETE = h.DELETE;
//
// Options/env identical to @geoengine/node — see README.
//
// NOTE: handlers speak the Web Request/Response API — Next.js route
// handlers accept standard Response objects, so no next/server import
// is needed at runtime (works on Next 13.4+ and Node 18+).
Object.defineProperty(exports, "__esModule", { value: true });
exports.geoengineRouteHandlers = geoengineRouteHandlers;
exports.getBridge = getBridge;
const contract_1 = require("./contract");
let cached = null;
function geoengineRouteHandlers(options = {}) {
    const bridge = (0, contract_1.createBridge)(options);
    cached = bridge;
    async function toResponse(req, ctx) {
        const params = ctx?.params ? await ctx.params : {};
        const segments = params?.path || [];
        const pathname = contract_1.PREFIX + (segments.length ? "/" + segments.join("/") : "");
        let body = null;
        if (req.method !== "GET" && req.method !== "HEAD") {
            const text = await req.text();
            if (text) {
                try {
                    body = JSON.parse(text);
                }
                catch {
                    body = null;
                }
            }
        }
        const headers = {};
        req.headers.forEach((v, k) => {
            headers[k] = v;
        });
        const query = {};
        try {
            const search = new URL(req.url).searchParams;
            search.forEach((v, k) => {
                query[k] = v;
            });
        }
        catch { /* no query */ }
        const out = (await bridge.handle({
            method: req.method,
            pathname,
            query,
            headers,
            body,
        }));
        if (out === null) {
            return Response.json({ detail: "Not found" }, { status: 404 });
        }
        const resHeaders = new Headers();
        for (const [k, v] of Object.entries(out.headers || {})) {
            resHeaders.set(k, v);
        }
        if (typeof out.body === "string") {
            return new Response(out.body, { status: out.status, headers: resHeaders });
        }
        return Response.json(out.body, { status: out.status, headers: resHeaders });
    }
    const wrap = (req, ctx) => toResponse(req, ctx);
    return { GET: wrap, POST: wrap, PUT: wrap, DELETE: wrap, PATCH: wrap };
}
/** Access the last-created bridge instance (stores, siteUrl). */
function getBridge() {
    return cached;
}

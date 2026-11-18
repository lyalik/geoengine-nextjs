// @geoengine/nextjs — GEO Engine bridge for Next.js (App Router).
//
//   // app/api/geo-engine-bridge/[...path]/route.ts
//   export const runtime = "nodejs";
//   export const dynamic = "force-dynamic";
//   import { geoengineRouteHandlers } from "@geoengine/nextjs/route";
//   const h = geoengineRouteHandlers();
//   export const GET = h.GET; export const POST = h.POST;
//   export const PUT = h.PUT;  export const DELETE = h.DELETE;
//
//   // any page/layout — managed metadata:
//   import { geoEngineMetadata, jsonLdScriptProps } from "@geoengine/nextjs/meta";
//   export async function generateMetadata() {
//       return geoEngineMetadata("/");
//   }
//
// Configuration via env (or options): GEO_ENGINE_API_KEY (required),
// GEO_BRIDGE_SITE_URL, GEO_BRIDGE_PAGES, GEO_BRIDGE_STORE,
// GEO_BRIDGE_PRODUCTS_STORE, GEO_BRIDGE_STATIC_DIR,
// GEO_BRIDGE_POST_HANDLER, GEO_ENGINE_API_URL, GEO_BRIDGE_AUTO_RESTART.
// See README.md / INSTALL.md.

export { createBridge, PREFIX } from "./contract";
export { VERSION } from "./version";
export type { Bridge, BridgeOptions, BridgeRequest, BridgeResponse } from "./contract";
export { createStores, JsonStore } from "./store";
export { geoengineRouteHandlers, getBridge } from "./route";
export type { GeoEngineRouteHandlers, GeoRequest, RouteContext } from "./route";
export {
    geoEngineMetadata,
    getManagedSeo,
    getManagedJsonLd,
    jsonLdScriptProps,
    pageIdFromPath,
} from "./meta";
export type { ManagedSeoRecord, GeoEngineMetadata, JsonLdScriptProps } from "./meta";

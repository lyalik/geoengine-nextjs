"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.pageIdFromPath = exports.jsonLdScriptProps = exports.getManagedJsonLd = exports.getManagedSeo = exports.geoEngineMetadata = exports.getBridge = exports.geoengineRouteHandlers = exports.JsonStore = exports.createStores = exports.VERSION = exports.PREFIX = exports.createBridge = void 0;
var contract_1 = require("./contract");
Object.defineProperty(exports, "createBridge", { enumerable: true, get: function () { return contract_1.createBridge; } });
Object.defineProperty(exports, "PREFIX", { enumerable: true, get: function () { return contract_1.PREFIX; } });
var version_1 = require("./version");
Object.defineProperty(exports, "VERSION", { enumerable: true, get: function () { return version_1.VERSION; } });
var store_1 = require("./store");
Object.defineProperty(exports, "createStores", { enumerable: true, get: function () { return store_1.createStores; } });
Object.defineProperty(exports, "JsonStore", { enumerable: true, get: function () { return store_1.JsonStore; } });
var route_1 = require("./route");
Object.defineProperty(exports, "geoengineRouteHandlers", { enumerable: true, get: function () { return route_1.geoengineRouteHandlers; } });
Object.defineProperty(exports, "getBridge", { enumerable: true, get: function () { return route_1.getBridge; } });
var meta_1 = require("./meta");
Object.defineProperty(exports, "geoEngineMetadata", { enumerable: true, get: function () { return meta_1.geoEngineMetadata; } });
Object.defineProperty(exports, "getManagedSeo", { enumerable: true, get: function () { return meta_1.getManagedSeo; } });
Object.defineProperty(exports, "getManagedJsonLd", { enumerable: true, get: function () { return meta_1.getManagedJsonLd; } });
Object.defineProperty(exports, "jsonLdScriptProps", { enumerable: true, get: function () { return meta_1.jsonLdScriptProps; } });
Object.defineProperty(exports, "pageIdFromPath", { enumerable: true, get: function () { return meta_1.pageIdFromPath; } });

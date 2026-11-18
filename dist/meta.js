"use strict";
// Managed-SEO helpers for Next.js pages — the App Router equivalent of
// the HTML <head> injection other bridges do. Next.js metadata is
// per-route, so the integration surface is:
//
//   // app/[locale]/page.tsx (or any page/layout)
//   import { geoEngineMetadata, jsonLdScriptProps } from "@geoengine/nextjs/meta";
//
//   export async function generateMetadata({ params }) {
//       return geoEngineMetadata("/", { title: "Default title" });
//   }
//
//   export default function Page() {
//       return (<>
//           {jsonLdScriptProps("/").map((p, i) => <script key={i} {...p} />)}
//           <main>...</main>
//       </>);
//   }
//
// geoEngineMetadata merges stored managed fields over your defaults —
// customer values win where GEO Engine has no managed record.
// Zero runtime deps: no next/react imports — helpers return plain
// objects shaped exactly like Next.js Metadata / script props.
Object.defineProperty(exports, "__esModule", { value: true });
exports.pageIdFromPath = pageIdFromPath;
exports.getManagedSeo = getManagedSeo;
exports.getManagedJsonLd = getManagedJsonLd;
exports.geoEngineMetadata = geoEngineMetadata;
exports.jsonLdScriptProps = jsonLdScriptProps;
const contract_1 = require("./contract");
let bridge = null;
function getBridgeInstance() {
    if (!bridge)
        bridge = (0, contract_1.createBridge)();
    return bridge;
}
/** Normalize a request path (/about, about, /en/about) to a store page id. */
function pageIdFromPath(pathname) {
    const slug = String(pathname || "/").replace(/^\/+|\/+$/g, "");
    return slug || "home";
}
/** Raw managed record for a path (null when unmanaged). */
function getManagedSeo(pathname) {
    const b = getBridgeInstance();
    const page = pageIdFromPath(pathname);
    return b.store.get(page) || null;
}
/** All managed structured-data blocks for a path. */
function getManagedJsonLd(pathname) {
    const rec = getManagedSeo(pathname);
    const sd = rec?.structured_data;
    if (!sd)
        return [];
    const blocks = Array.isArray(sd) ? sd : [sd];
    return blocks.filter((b) => b && typeof b === "object");
}
/**
 * generateMetadata helper: managed fields override the defaults you pass.
 * Returns a plain object shaped like Next.js `Metadata` — return it
 * directly from generateMetadata.
 */
function geoEngineMetadata(pathname, defaults = {}) {
    const rec = getManagedSeo(pathname);
    if (!rec)
        return defaults;
    const out = { ...defaults };
    if (rec.title)
        out.title = rec.title;
    if (rec.description)
        out.description = rec.description;
    if (rec.keywords) {
        out.keywords = String(rec.keywords)
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean);
    }
    if (rec.canonical_url) {
        out.alternates = { ...(out.alternates || {}), canonical: rec.canonical_url };
    }
    if (rec.indexable === false) {
        out.robots = { index: false, follow: false };
    }
    const ogTitle = rec.og_title || rec.title;
    const ogDesc = rec.og_description || rec.description;
    const ogImage = rec.og_image;
    if (ogTitle || ogDesc || ogImage) {
        out.openGraph = {
            ...(out.openGraph || {}),
            ...(ogTitle ? { title: ogTitle } : {}),
            ...(ogDesc ? { description: ogDesc } : {}),
            ...(ogImage ? { images: [ogImage] } : {}),
        };
    }
    const twTitle = rec.twitter_title || ogTitle;
    const twDesc = rec.twitter_description || ogDesc;
    const twImage = rec.twitter_image || ogImage;
    if (twTitle || twDesc || twImage) {
        out.twitter = {
            ...(out.twitter || {}),
            card: "summary_large_image",
            ...(twTitle ? { title: twTitle } : {}),
            ...(twDesc ? { description: twDesc } : {}),
            ...(twImage ? { images: [twImage] } : {}),
        };
    }
    return out;
}
/**
 * Props for managed JSON-LD <script> tags. Render in a server component:
 *
 *   {jsonLdScriptProps("/about").map((p, i) => <script key={i} {...p} />)}
 */
function jsonLdScriptProps(pathname) {
    return getManagedJsonLd(pathname).map((block) => ({
        type: "application/ld+json",
        "data-geoengine": "1",
        dangerouslySetInnerHTML: {
            __html: JSON.stringify(block).replace(/<\//g, "<\\/"),
        },
    }));
}

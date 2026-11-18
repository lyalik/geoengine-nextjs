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

import { createBridge } from "./contract";

let bridge: ReturnType<typeof createBridge> | null = null;
function getBridgeInstance() {
    if (!bridge) bridge = createBridge();
    return bridge;
}

export interface ManagedSeoRecord {
    title?: string | null;
    description?: string | null;
    keywords?: string | null;
    canonical_url?: string | null;
    indexable?: boolean;
    og_title?: string | null;
    og_description?: string | null;
    og_image?: string | null;
    twitter_title?: string | null;
    twitter_description?: string | null;
    twitter_image?: string | null;
    h1?: string | null;
    structured_data?: any;
    faq?: any;
}

/** Loose Next.js Metadata shape — compatible with `Metadata` from "next". */
export type GeoEngineMetadata = Record<string, any>;

/** Normalize a request path (/about, about, /en/about) to a store page id. */
export function pageIdFromPath(pathname: string): string {
    const slug = String(pathname || "/").replace(/^\/+|\/+$/g, "");
    return slug || "home";
}

/** Raw managed record for a path (null when unmanaged). */
export function getManagedSeo(pathname: string): ManagedSeoRecord | null {
    const b = getBridgeInstance();
    const page = pageIdFromPath(pathname);
    return (b.store.get(page) as ManagedSeoRecord | null) || null;
}

/** All managed structured-data blocks for a path. */
export function getManagedJsonLd(pathname: string): any[] {
    const rec = getManagedSeo(pathname);
    const sd = rec?.structured_data;
    if (!sd) return [];
    const blocks = Array.isArray(sd) ? sd : [sd];
    return blocks.filter((b) => b && typeof b === "object");
}

/**
 * generateMetadata helper: managed fields override the defaults you pass.
 * Returns a plain object shaped like Next.js `Metadata` — return it
 * directly from generateMetadata.
 */
export function geoEngineMetadata(
    pathname: string,
    defaults: GeoEngineMetadata = {}
): GeoEngineMetadata {
    const rec = getManagedSeo(pathname);
    if (!rec) return defaults;

    const out: GeoEngineMetadata = { ...defaults };
    if (rec.title) out.title = rec.title;
    if (rec.description) out.description = rec.description;
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

export interface JsonLdScriptProps {
    type: "application/ld+json";
    "data-geoengine": "1";
    dangerouslySetInnerHTML: { __html: string };
}

/**
 * Props for managed JSON-LD <script> tags. Render in a server component:
 *
 *   {jsonLdScriptProps("/about").map((p, i) => <script key={i} {...p} />)}
 */
export function jsonLdScriptProps(pathname: string): JsonLdScriptProps[] {
    return getManagedJsonLd(pathname).map((block) => ({
        type: "application/ld+json" as const,
        "data-geoengine": "1" as const,
        dangerouslySetInnerHTML: {
            __html: JSON.stringify(block).replace(/<\//g, "<\\/"),
        },
    }));
}

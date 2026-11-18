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
export declare function pageIdFromPath(pathname: string): string;
/** Raw managed record for a path (null when unmanaged). */
export declare function getManagedSeo(pathname: string): ManagedSeoRecord | null;
/** All managed structured-data blocks for a path. */
export declare function getManagedJsonLd(pathname: string): any[];
/**
 * generateMetadata helper: managed fields override the defaults you pass.
 * Returns a plain object shaped like Next.js `Metadata` — return it
 * directly from generateMetadata.
 */
export declare function geoEngineMetadata(pathname: string, defaults?: GeoEngineMetadata): GeoEngineMetadata;
export interface JsonLdScriptProps {
    type: "application/ld+json";
    "data-geoengine": "1";
    dangerouslySetInnerHTML: {
        __html: string;
    };
}
/**
 * Props for managed JSON-LD <script> tags. Render in a server component:
 *
 *   {jsonLdScriptProps("/about").map((p, i) => <script key={i} {...p} />)}
 */
export declare function jsonLdScriptProps(pathname: string): JsonLdScriptProps[];

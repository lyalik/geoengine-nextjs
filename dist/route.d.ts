import { BridgeOptions } from "./contract";
/** Minimal structural type — NextRequest satisfies this. */
export interface GeoRequest {
    method: string;
    headers: {
        forEach(cb: (value: string, key: string) => void): void;
    };
    text(): Promise<string>;
    url: string;
}
export interface RouteContext {
    params?: {
        path?: string[];
    } | Promise<{
        path?: string[];
    }>;
}
export interface GeoEngineRouteHandlers {
    GET: (req: GeoRequest, ctx: RouteContext) => Promise<Response>;
    POST: (req: GeoRequest, ctx: RouteContext) => Promise<Response>;
    PUT: (req: GeoRequest, ctx: RouteContext) => Promise<Response>;
    DELETE: (req: GeoRequest, ctx: RouteContext) => Promise<Response>;
    PATCH: (req: GeoRequest, ctx: RouteContext) => Promise<Response>;
}
export declare function geoengineRouteHandlers(options?: BridgeOptions): GeoEngineRouteHandlers;
/** Access the last-created bridge instance (stores, siteUrl). */
export declare function getBridge(): import("./contract").Bridge | null;

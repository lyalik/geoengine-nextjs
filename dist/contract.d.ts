import { JsonStore } from "./store";
export declare const PREFIX = "/api/geo-engine-bridge";
export interface BridgeRequest {
    method: string;
    /** Full path including PREFIX, e.g. /api/geo-engine-bridge/pages */
    pathname: string;
    query?: Record<string, string>;
    headers?: Record<string, string | string[] | undefined>;
    body?: any;
}
export interface BridgeResponse {
    status: number;
    headers: Record<string, string>;
    body: any;
}
export interface BridgeOptions {
    apiKey?: string;
    siteUrl?: string;
    staticDir?: string;
    autoRestart?: boolean;
    postHandler?: string;
    env?: NodeJS.ProcessEnv;
}
export interface Bridge {
    handle(req: BridgeRequest): Promise<BridgeResponse | null>;
    store: JsonStore;
    productStore: JsonStore;
    allPages(): string[];
    siteUrl: string;
    staticDir: string;
}
export declare function createBridge(options?: BridgeOptions): Bridge;

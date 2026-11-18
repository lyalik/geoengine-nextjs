export declare const SEO_FIELDS: Set<string>;
export declare const PRODUCT_FIELDS: Set<string>;
export type StoreRecord = Record<string, any>;
export declare class JsonStore {
    private readonly filePath;
    private readonly allowedFields;
    private cache;
    private mtimeMs;
    constructor(filePath: string, allowedFields: Set<string>);
    private statMtime;
    private load;
    private save;
    get(id: string): StoreRecord | null;
    all(): Record<string, StoreRecord>;
    update(id: string, fields: Record<string, any>): StoreRecord;
    delete(id: string): boolean;
}
export interface BridgeStores {
    seo: JsonStore;
    products: JsonStore;
}
export declare function createStores(env?: NodeJS.ProcessEnv): BridgeStores;

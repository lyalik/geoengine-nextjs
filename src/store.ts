// JSON-file backed stores for per-page SEO overrides and the product
// catalog mirror. No DB required — small JSON files with atomic writes.
// Serverless caveat: needs a writable filesystem (self-hosted Node).

import fs from "node:fs";
import path from "node:path";

export const SEO_FIELDS = new Set([
    "title",
    "description",
    "keywords",
    "og_title",
    "og_description",
    "og_image",
    "twitter_title",
    "twitter_description",
    "twitter_image",
    "canonical_url",
    "structured_data",
    "indexable",
    "h1",
    "content_markdown",
]);

export const PRODUCT_FIELDS = new Set([
    "name",
    "description",
    "short_description",
    "meta_title",
    "meta_description",
    "attributes",
    "faq",
    "image_alt",
    "content_html",
    "sku",
    "price",
    "url",
    "image",
    "category",
    "status",
]);

export type StoreRecord = Record<string, any>;

export class JsonStore {
    private cache: Record<string, StoreRecord> | null = null;
    private mtimeMs = -1;

    constructor(
        private readonly filePath: string,
        private readonly allowedFields: Set<string>
    ) {}

    private statMtime(): number {
        try {
            return fs.statSync(this.filePath).mtimeMs;
        } catch {
            return -1;
        }
    }

    private load(): Record<string, StoreRecord> {
        const mtime = this.statMtime();
        if (this.cache !== null && mtime === this.mtimeMs) return this.cache;
        let data: Record<string, StoreRecord> = {};
        if (mtime !== -1) {
            try {
                const raw = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
                if (raw && typeof raw === "object" && !Array.isArray(raw)) data = raw;
            } catch {
                data = {};
            }
        }
        this.cache = data;
        this.mtimeMs = mtime;
        return data;
    }

    private save(): void {
        const dir = path.dirname(path.resolve(this.filePath));
        fs.mkdirSync(dir, { recursive: true });
        const tmp = path.join(dir, `.geo-tmp-${process.pid}-${Date.now()}.json`);
        fs.writeFileSync(tmp, JSON.stringify(this.cache, null, 2), "utf8");
        fs.renameSync(tmp, this.filePath);
        this.mtimeMs = this.statMtime();
    }

    get(id: string): StoreRecord | null {
        const rec = this.load()[id];
        return rec && typeof rec === "object" ? rec : null;
    }

    all(): Record<string, StoreRecord> {
        return { ...this.load() };
    }

    update(id: string, fields: Record<string, any>): StoreRecord {
        const data = this.load();
        const rec = data[id] || {};
        for (const [key, value] of Object.entries(fields || {})) {
            if (this.allowedFields.has(key) && value !== null && value !== undefined) {
                rec[key] = value;
            }
        }
        rec.updated_at = new Date().toISOString();
        data[id] = rec;
        this.save();
        return { ...rec };
    }

    delete(id: string): boolean {
        const data = this.load();
        const existed = id in data;
        delete data[id];
        this.save();
        return existed;
    }
}

export interface BridgeStores {
    seo: JsonStore;
    products: JsonStore;
}

export function createStores(env: NodeJS.ProcessEnv = process.env): BridgeStores {
    return {
        seo: new JsonStore(env.GEO_BRIDGE_STORE || "./geo_bridge_store.json", SEO_FIELDS),
        products: new JsonStore(
            env.GEO_BRIDGE_PRODUCTS_STORE || "./geo_bridge_products.json",
            PRODUCT_FIELDS
        ),
    };
}

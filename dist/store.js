"use strict";
// JSON-file backed stores for per-page SEO overrides and the product
// catalog mirror. No DB required — small JSON files with atomic writes.
// Serverless caveat: needs a writable filesystem (self-hosted Node).
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonStore = exports.PRODUCT_FIELDS = exports.SEO_FIELDS = void 0;
exports.createStores = createStores;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
exports.SEO_FIELDS = new Set([
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
exports.PRODUCT_FIELDS = new Set([
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
class JsonStore {
    constructor(filePath, allowedFields) {
        this.filePath = filePath;
        this.allowedFields = allowedFields;
        this.cache = null;
        this.mtimeMs = -1;
    }
    statMtime() {
        try {
            return node_fs_1.default.statSync(this.filePath).mtimeMs;
        }
        catch {
            return -1;
        }
    }
    load() {
        const mtime = this.statMtime();
        if (this.cache !== null && mtime === this.mtimeMs)
            return this.cache;
        let data = {};
        if (mtime !== -1) {
            try {
                const raw = JSON.parse(node_fs_1.default.readFileSync(this.filePath, "utf8"));
                if (raw && typeof raw === "object" && !Array.isArray(raw))
                    data = raw;
            }
            catch {
                data = {};
            }
        }
        this.cache = data;
        this.mtimeMs = mtime;
        return data;
    }
    save() {
        const dir = node_path_1.default.dirname(node_path_1.default.resolve(this.filePath));
        node_fs_1.default.mkdirSync(dir, { recursive: true });
        const tmp = node_path_1.default.join(dir, `.geo-tmp-${process.pid}-${Date.now()}.json`);
        node_fs_1.default.writeFileSync(tmp, JSON.stringify(this.cache, null, 2), "utf8");
        node_fs_1.default.renameSync(tmp, this.filePath);
        this.mtimeMs = this.statMtime();
    }
    get(id) {
        const rec = this.load()[id];
        return rec && typeof rec === "object" ? rec : null;
    }
    all() {
        return { ...this.load() };
    }
    update(id, fields) {
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
    delete(id) {
        const data = this.load();
        const existed = id in data;
        delete data[id];
        this.save();
        return existed;
    }
}
exports.JsonStore = JsonStore;
function createStores(env = process.env) {
    return {
        seo: new JsonStore(env.GEO_BRIDGE_STORE || "./geo_bridge_store.json", exports.SEO_FIELDS),
        products: new JsonStore(env.GEO_BRIDGE_PRODUCTS_STORE || "./geo_bridge_products.json", exports.PRODUCT_FIELDS),
    };
}

// Framework-agnostic implementation of the GEO Engine bridge contract —
// same endpoint surface as geoengine_bridge (FastAPI) and @geoengine/node.
//
//   GET  /api/geo-engine-bridge/health            public
//   GET  /api/geo-engine-bridge/recon             public (Scout probe)
//   GET  /api/geo-engine-bridge/structured-data   public
//   GET  /api/geo-engine-bridge/page-meta         public (?page=...)
//   GET  /api/geo-engine-bridge/llms-txt          public (text)
//   GET  /api/geo-engine-bridge/products/{id}     public (render-time)
//   GET  /api/geo-engine-bridge/pages             x-api-key
//   GET  /api/geo-engine-bridge/pages/{page}      x-api-key
//   PUT  /api/geo-engine-bridge/pages/{page}      x-api-key
//   POST /api/geo-engine-bridge/pages/{page}      x-api-key (upsert)
//   POST /api/geo-engine-bridge/apply-fix         x-api-key
//   GET  /api/geo-engine-bridge/ai-export         x-api-key
//   POST /api/geo-engine-bridge/upload-file       x-api-key
//   POST /api/geo-engine-bridge/publish-file      x-api-key (alias)
//   POST /api/geo-engine-bridge/posts             x-api-key
//   GET  /api/geo-engine-bridge/products          x-api-key
//   POST /api/geo-engine-bridge/products          x-api-key
//   PUT  /api/geo-engine-bridge/products/{id}     x-api-key
//   POST /api/geo-engine-bridge/self-update       x-api-key

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { VERSION } from "./version";
import { createStores, JsonStore } from "./store";
import { selfUpdate } from "./selfUpdate";

export const PREFIX = "/api/geo-engine-bridge";

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
    body: any; // object → JSON, string → raw text
}

export interface BridgeOptions {
    apiKey?: string;
    siteUrl?: string;
    staticDir?: string;
    autoRestart?: boolean;
    postHandler?: string;
    env?: NodeJS.ProcessEnv;
}

const ISSUE_FIELD_MAP: Record<string, string> = {
    missing_title: "title",
    short_title: "title",
    long_title: "title",
    duplicate_title: "title",
    missing_description: "description",
    missing_meta_description: "description",
    short_description: "description",
    long_description: "description",
    duplicate_description: "description",
    missing_canonical: "canonical_url",
    missing_schema: "structured_data",
    missing_structured_data: "structured_data",
    schema_markup: "structured_data",
    missing_h1: "h1",
};

function cleanFixValue(field: string, raw: any): any {
    if (typeof raw !== "string") return raw;
    const text = raw.trim();
    if (field === "title") {
        const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(text);
        return m ? m[1].trim() : text;
    }
    if (field === "description") {
        const m = /content=["']([\s\S]*?)["']/i.exec(text);
        return m && /<meta/i.test(text) ? m[1].trim() : text;
    }
    if (field === "canonical_url") {
        const m = /href=["']([^"']+)["']/i.exec(text);
        return m && /<link/i.test(text) ? m[1].trim() : text;
    }
    if (field === "h1") {
        const m = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(text);
        return m ? m[1].trim() : text;
    }
    if (field === "structured_data") {
        const scripts = [...text.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
        if (scripts.length) {
            const parsed: any[] = [];
            for (const s of scripts) {
                try { parsed.push(JSON.parse(s[1].trim())); } catch { /* ignore */ }
            }
            if (parsed.length) return parsed.length === 1 ? parsed[0] : parsed;
        }
        try {
            return JSON.parse(text);
        } catch {
            return { "@context": "https://schema.org", raw: text };
        }
    }
    return text;
}

const ALLOWED_UPLOAD_NAMES = /^(?:\.well-known\/[A-Za-z0-9._-]+|[A-Za-z0-9][A-Za-z0-9._-]{0,120})$/;
const PAGE_ID_RE = /^[A-Za-z0-9_\-/]{1,200}$/;
const PRODUCT_ID_RE = /^[A-Za-z0-9_-]{1,120}$/;

function envBool(env: NodeJS.ProcessEnv, name: string): boolean {
    return ["1", "true", "yes"].includes(String(env[name] || "").toLowerCase());
}

function decodeSafe(s: string): string {
    try {
        return decodeURIComponent(s);
    } catch {
        return s;
    }
}

export interface Bridge {
    handle(req: BridgeRequest): Promise<BridgeResponse | null>;
    store: JsonStore;
    productStore: JsonStore;
    allPages(): string[];
    siteUrl: string;
    staticDir: string;
}

export function createBridge(options: BridgeOptions = {}): Bridge {
    const env = options.env || process.env;
    const apiKey = options.apiKey !== undefined ? options.apiKey : env.GEO_ENGINE_API_KEY || "";
    const siteUrl = String(
        options.siteUrl !== undefined ? options.siteUrl : env.GEO_BRIDGE_SITE_URL || ""
    ).replace(/\/+$/, "");
    const staticDir =
        options.staticDir !== undefined ? options.staticDir : env.GEO_BRIDGE_STATIC_DIR || "";
    const configuredPages = String(env.GEO_BRIDGE_PAGES || "home");
    const autoRestart =
        options.autoRestart !== undefined ? options.autoRestart : envBool(env, "GEO_BRIDGE_AUTO_RESTART");
    const postHandler =
        options.postHandler !== undefined ? options.postHandler : env.GEO_BRIDGE_POST_HANDLER || "";
    const { seo: store, products: productStore } = createStores(env);

    function allPages(): string[] {
        const pages = configuredPages
            .split(",")
            .map((p) => p.trim().replace(/^\/+|\/+$/g, "") || "home")
            .filter(Boolean);
        for (const slug of Object.keys(store.all())) {
            if (!pages.includes(slug)) pages.push(slug);
        }
        return pages;
    }

    const normalizePageId = (pageId: string) => String(pageId || "").replace(/^\/+|\/+$/g, "") || "home";
    const pageUrl = (page: string) => (page === "home" ? siteUrl : `${siteUrl}/${page}`);

    function findPage(pageId: string): string | null {
        const slug = normalizePageId(decodeSafe(String(pageId || "")));
        return allPages().includes(slug) ? slug : null;
    }

    function publicView(page: string) {
        const rec = store.get(page) || {};
        return {
            id: page,
            page,
            url: pageUrl(page),
            title: rec.title ?? null,
            description: rec.description ?? null,
            structuredData: rec.structured_data ?? null,
        };
    }

    function fullView(page: string) {
        const rec = store.get(page) || {};
        return {
            ...publicView(page),
            keywords: rec.keywords ?? null,
            og_title: rec.og_title ?? null,
            og_description: rec.og_description ?? null,
            og_image: rec.og_image ?? null,
            twitter_title: rec.twitter_title ?? null,
            twitter_description: rec.twitter_description ?? null,
            canonical_url: rec.canonical_url ?? null,
            indexable: rec.indexable !== false,
            custom_meta: rec.custom_meta ?? null,
        };
    }

    const SEO_FIELD_ALIASES: Record<string, string[]> = {
        title: ["title"],
        description: ["description"],
        keywords: ["keywords"],
        og_title: ["og_title", "ogTitle"],
        og_description: ["og_description", "ogDescription"],
        og_image: ["og_image", "ogImage"],
        twitter_title: ["twitter_title", "twitterTitle"],
        twitter_description: ["twitter_description", "twitterDescription"],
        twitter_image: ["twitter_image", "twitterImage"],
        canonical_url: ["canonical_url", "canonicalUrl", "canonical"],
        structured_data: ["structured_data", "structuredData"],
        indexable: ["indexable"],
        h1: ["h1"],
    };

    function seoFieldsFromBody(body: any): Record<string, any> {
        const fields: Record<string, any> = {};
        for (const [field, aliases] of Object.entries(SEO_FIELD_ALIASES)) {
            for (const alias of aliases) {
                if (body && body[alias] !== undefined) {
                    let value = body[alias];
                    if (field === "keywords" && Array.isArray(value)) {
                        value = value.map(String).join(", ");
                    }
                    fields[field] = value;
                    break;
                }
            }
        }
        return fields;
    }

    function headerValue(headers: BridgeRequest["headers"], name: string): string {
        const v = headers?.[name.toLowerCase()];
        if (Array.isArray(v)) return v[0] || "";
        return typeof v === "string" ? v : "";
    }

    function authed(headers: BridgeRequest["headers"]): BridgeResponse | null {
        if (!apiKey) {
            return json(503, { detail: "GEO_ENGINE_API_KEY is not configured" });
        }
        const provided = headerValue(headers, "x-api-key");
        const a = Buffer.from(provided);
        const b = Buffer.from(apiKey);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
            return json(401, { detail: "Invalid or missing API key" });
        }
        return null;
    }

    function json(status: number, body: any): BridgeResponse {
        return { status, headers: { "content-type": "application/json; charset=utf-8" }, body };
    }
    function err(status: number, detail: string): BridgeResponse {
        return json(status, { detail });
    }
    function text(status: number, body: string): BridgeResponse {
        return { status, headers: { "content-type": "text/plain; charset=utf-8" }, body };
    }

    async function fetchMediaToStatic(productId: string, key: string, url: string, ext: string): Promise<string> {
        if (!staticDir || !/^https?:\/\//i.test(url)) return "";
        try {
            const resp = await fetch(url, {
                headers: { "user-agent": "geoengine-bridge" },
                signal: AbortSignal.timeout(60000),
            });
            if (!resp.ok) return "";
            const buf = Buffer.from(await resp.arrayBuffer());
            if (!buf.length || buf.length > 50 * 1024 * 1024) return "";
            const mediaDir = path.join(staticDir, "media");
            fs.mkdirSync(mediaDir, { recursive: true });
            const name = `${productId}-${key[0]}-${Date.now()}.${ext}`;
            fs.writeFileSync(path.join(mediaDir, name), buf);
            return `media/${name}`;
        } catch {
            return "";
        }
    }

    async function handle(req: BridgeRequest): Promise<BridgeResponse | null> {
        const { method, pathname, query = {}, headers = {}, body = null } = req;
        const rel = pathname.startsWith(PREFIX) ? pathname.slice(PREFIX.length) || "/" : null;
        if (rel === null) return null;
        const m = method.toUpperCase();

        // ---------------- public ----------------
        if (m === "GET" && rel === "/health") {
            let writable = false;
            try {
                fs.accessSync(__dirname, fs.constants.W_OK);
                writable = true;
            } catch {
                writable = false;
            }
            return json(200, {
                status: "ok",
                service: "geo-engine-bridge",
                framework: "nextjs",
                version: VERSION,
                module_dir_writable: writable,
            });
        }
        if (m === "GET" && rel === "/recon") {
            return json(200, {
                bridge: "geo-engine",
                version: VERSION,
                platform: "custom",
                framework: "nextjs",
                auth: { type: "header", key: "x-api-key" },
                capabilities: [
                    "pages.list", "pages.read", "pages.upsert", "seo.apply",
                    "fix.apply", "ai_export", "file.upload", "self_update",
                    "products.list", "products.read", "products.upsert",
                    "posts.create",
                ],
                endpoints: {
                    health: `${PREFIX}/health`,
                    pages: `${PREFIX}/pages`,
                    apply_seo: `${PREFIX}/pages/{page}`,
                    apply_fix: `${PREFIX}/apply-fix`,
                    ai_export: `${PREFIX}/ai-export`,
                    upload_file: `${PREFIX}/upload-file`,
                    self_update: `${PREFIX}/self-update`,
                },
            });
        }
        if (m === "GET" && rel === "/structured-data") {
            const out: Record<string, any> = {};
            for (const page of allPages()) {
                const rec = store.get(page) || {};
                if (rec.structured_data) out[page] = rec.structured_data;
            }
            return json(200, out);
        }
        if (m === "GET" && rel === "/page-meta") {
            const rec = store.get(normalizePageId(query.page || "home")) || {};
            return json(200, {
                title: rec.title ?? null,
                description: rec.description ?? null,
                keywords: rec.keywords ?? null,
                canonical_url: rec.canonical_url ?? null,
                indexable: rec.indexable !== false,
                og_title: rec.og_title ?? null,
                og_description: rec.og_description ?? null,
                og_image: rec.og_image ?? null,
            });
        }
        if (m === "GET" && rel === "/llms-txt") {
            if (staticDir) {
                const candidate = path.join(staticDir, "llms.txt");
                try {
                    if (fs.existsSync(candidate)) {
                        return text(200, fs.readFileSync(candidate, "utf8"));
                    }
                } catch { /* fall through */ }
            }
            const lines = [`# ${siteUrl || "site"}`, ""];
            for (const page of allPages()) {
                const rec = store.get(page) || {};
                const title = rec.title || page;
                const desc = rec.description || "";
                lines.push(`- [${title}](${pageUrl(page)})` + (desc ? `: ${desc}` : ""));
            }
            return text(200, lines.join("\n") + "\n");
        }

        const prodPub = rel.match(/^\/products\/([^/]+)$/);
        if (m === "GET" && prodPub) {
            const rec = productStore.get(decodeSafe(prodPub[1]));
            if (rec === null) return err(404, "Product not found");
            return json(200, { product_id: prodPub[1], fields: rec });
        }

        // ---------------- authed ----------------
        const deny = authed(headers);
        if (deny) return deny;

        if (m === "GET" && rel === "/pages") {
            return json(200, { pages: allPages().map(publicView) });
        }

        const pageMatch = rel.match(/^\/pages\/(.+)$/);
        if (pageMatch) {
            const pageId = decodeSafe(pageMatch[1]);
            if (m === "GET") {
                const page = findPage(pageId);
                if (page === null) return err(404, "Page not found");
                return json(200, fullView(page));
            }
            if (m === "PUT") {
                let page = findPage(pageId);
                if (page === null) {
                    const cand = normalizePageId(pageId);
                    if (!PAGE_ID_RE.test(cand)) return err(422, "Invalid page slug");
                    page = cand;
                }
                const fields = seoFieldsFromBody(body || {});
                store.update(page, fields);
                return json(200, { ok: true, page_id: pageId, page });
            }
            if (m === "POST") {
                const page = normalizePageId(pageId);
                if (!PAGE_ID_RE.test(page)) return err(422, "Invalid page slug");
                const fields = seoFieldsFromBody(body || {});
                const created = !allPages().includes(page);
                store.update(page, fields);
                return json(200, { ok: true, page_id: pageId, page, created });
            }
        }

        if (m === "POST" && rel === "/apply-fix") {
            const b = body || {};
            const pageId = String(b.page_id || b.page || "");
            let page = findPage(pageId);
            if (page === null && pageId) {
                const cand = normalizePageId(decodeSafe(pageId));
                if (PAGE_ID_RE.test(cand)) page = cand;
            }
            if (page === null) {
                return json(200, { success: false, applied: false, message: `Unknown page: ${pageId || "(empty)"}` });
            }
            const issueType = String(b.issue_type || "").trim();
            const fixContent = b.fix_content;
            let fields: Record<string, any> = {};
            if (issueType) {
                const field = ISSUE_FIELD_MAP[issueType];
                if (!field || fixContent === undefined || fixContent === null) {
                    return json(200, { success: false, applied: false, message: `Unsupported issue_type '${issueType}' for bridge meta store` });
                }
                fields = { [field]: cleanFixValue(field, fixContent) };
            } else {
                fields = seoFieldsFromBody(b);
                if (!Object.keys(fields).length && fixContent !== undefined && fixContent !== null) {
                    fields = { description: String(fixContent) };
                }
            }
            if (Object.keys(fields).length) store.update(page, fields);
            return json(200, { success: true, page, applied: Object.keys(fields) });
        }

        if (m === "GET" && rel === "/ai-export") {
            const pages = allPages().map((page) => {
                const rec = store.get(page) || {};
                return {
                    page,
                    url: pageUrl(page),
                    title: rec.title || page,
                    description: rec.description ?? null,
                    content_markdown: rec.content_markdown || "",
                };
            });
            return json(200, { pages, count: pages.length });
        }

        if (m === "POST" && (rel === "/upload-file" || rel === "/publish-file")) {
            if (!staticDir) return err(503, "GEO_BRIDGE_STATIC_DIR is not configured");
            const b = body || {};
            const filename = String(b.filename || b.path || b.file_path || "").replace(/^\/+/, "");
            const content = b.content ?? b.data ?? "";
            const encoding = String(b.encoding || "utf-8");
            if (!filename || !ALLOWED_UPLOAD_NAMES.test(filename) || filename.includes("..")) {
                return err(422, "Disallowed filename");
            }
            const target = path.join(staticDir, filename);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            if (encoding === "base64") {
                fs.writeFileSync(target, Buffer.from(String(content), "base64"));
            } else {
                fs.writeFileSync(target, String(content), "utf8");
            }
            return json(200, { ok: true, filename, url: `${siteUrl}/${filename}` });
        }

        if (m === "POST" && rel === "/posts") {
            if (!postHandler) {
                return err(501, "Blog publishing is not configured (set GEO_BRIDGE_POST_HANDLER)");
            }
            try {
                const [mod, fn] = String(postHandler).split(":");
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const handler = require(mod)[fn];
                const result = await handler(body || {});
                return json(200, result && typeof result === "object" ? result : { ok: true, result });
            } catch (exc: any) {
                return err(502, `Post handler failed: ${exc?.message || exc}`);
            }
        }

        if (m === "GET" && rel === "/products") {
            const offset = Math.max(0, parseInt(query.offset || "0", 10) || 0);
            const limit = Math.min(500, Math.max(1, parseInt(query.limit || "200", 10) || 200));
            const all = productStore.all();
            const ids = Object.keys(all).sort();
            const slice = ids.slice(offset, offset + limit);
            const items = slice.map((pid) => ({ external_id: pid, kind: "product", ...all[pid] }));
            return json(200, {
                items,
                total: ids.length,
                has_more: offset + slice.length < ids.length,
                next_offset: offset + slice.length,
            });
        }
        if (m === "POST" && rel === "/products") {
            const items = (body || {}).items;
            if (!Array.isArray(items)) return err(422, "items must be a list");
            let upserted = 0;
            for (const item of items.slice(0, 1000)) {
                if (!item || typeof item !== "object") continue;
                const pid = String(item.id ?? item.external_id ?? "").trim();
                if (!pid) continue;
                const fields: Record<string, any> = {};
                for (const [k, v] of Object.entries(item)) {
                    if (k !== "id" && k !== "external_id") fields[k] = v;
                }
                productStore.update(pid, fields);
                upserted++;
            }
            return json(200, { ok: true, upserted });
        }

        const prodMatch = rel.match(/^\/products\/([^/]+)$/);
        if (prodMatch && m === "PUT") {
            const productId = decodeSafe(prodMatch[1]);
            if (!PRODUCT_ID_RE.test(productId)) return err(422, "Invalid product_id");
            const b = body || {};
            const fields: Record<string, any> =
                b.fields && typeof b.fields === "object" ? { ...b.fields } : { ...b };
            delete fields.product_id;
            delete fields.external_id;
            delete fields.id;
            delete fields.url;
            const before = productStore.get(productId) || {};
            const snapshot: Record<string, any> = {};
            for (const k of ["name", "description", "short_description", "meta_title", "meta_description", "attributes"]) {
                if (k in before) snapshot[k] = before[k];
            }
            const allowName = Boolean(fields._allow_name || b._allow_name);
            const restoreName = Boolean(fields._restore_name || b._restore_name);
            delete fields._allow_name;
            delete fields._restore_name;
            const skippedFields: string[] = [];
            if ("name" in fields && before.name && !(allowName || restoreName)) {
                delete fields.name;
                skippedFields.push("name:protected");
            }
            const mediaWarnings: string[] = [];
            for (const [key, ext] of [["photo_url", "png"], ["video_url", "mp4"]] as const) {
                const url = String(fields[key] || "");
                if (!url) continue;
                delete fields[key];
                const local = await fetchMediaToStatic(productId, key, url, ext);
                if (local) fields["media_" + key] = local;
                else {
                    mediaWarnings.push(`${key}: download failed`);
                    skippedFields.push(`${key}: download failed`);
                }
            }
            const rec = productStore.update(productId, fields);
            const result: any = { ok: true, product_id: productId, result_data: { before: snapshot, product: rec } };
            if (mediaWarnings.length) result.result_data.warnings = mediaWarnings;
            if (skippedFields.length) result.result_data.skipped_fields = skippedFields;
            return json(200, result);
        }

        if (m === "POST" && rel === "/self-update") {
            const out = await selfUpdate({ body: body || {}, apiKey, autoRestart });
            return json(out.status, out.body);
        }

        return err(404, "Not found");
    }

    return { handle, store, productStore, allPages, siteUrl, staticDir };
}

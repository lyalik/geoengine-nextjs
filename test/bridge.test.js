"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createBridge } = require("../dist/contract");

function makeBridge(env = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "geo-nextjs-"));
    return createBridge({
        apiKey: "test-key",
        siteUrl: "https://example.test",
        env: {
            GEO_BRIDGE_STORE: path.join(dir, "seo.json"),
            GEO_BRIDGE_PRODUCTS_STORE: path.join(dir, "products.json"),
            GEO_BRIDGE_STATIC_DIR: dir,
            ...env,
        },
    });
}

const AUTH = { "x-api-key": "test-key" };

test("health + recon public", async () => {
    const b = makeBridge();
    const h = await b.handle({ method: "GET", pathname: "/api/geo-engine-bridge/health", headers: {} });
    assert.equal(h.status, 200);
    assert.equal(h.body.framework, "nextjs");
    assert.equal(h.body.version, "1.0.1");
    const r = await b.handle({ method: "GET", pathname: "/api/geo-engine-bridge/recon", headers: {} });
    assert.equal(r.body.framework, "nextjs");
});

test("auth fail-closed", async () => {
    const b = makeBridge();
    const r = await b.handle({ method: "GET", pathname: "/api/geo-engine-bridge/pages", headers: {} });
    assert.equal(r.status, 401);
    const b2 = makeBridge({ GEO_ENGINE_API_KEY: "" });
    // apiKey option overrides env — pass empty explicitly
    const b3 = createBridge({ apiKey: "", env: { GEO_ENGINE_API_KEY: "" } });
    const r3 = await b3.handle({ method: "GET", pathname: "/api/geo-engine-bridge/pages", headers: { "x-api-key": "x" } });
    assert.equal(r3.status, 503);
});

test("pages upsert/get/meta/ai-export", async () => {
    const b = makeBridge();
    const up = await b.handle({
        method: "POST",
        pathname: "/api/geo-engine-bridge/pages/about",
        headers: AUTH,
        body: { title: "About", description: "d", structuredData: { "@type": "WebPage" } },
    });
    assert.equal(up.body.created, true);
    const get = await b.handle({ method: "GET", pathname: "/api/geo-engine-bridge/pages/about", headers: AUTH });
    assert.equal(get.body.title, "About");
    const meta = await b.handle({ method: "GET", pathname: "/api/geo-engine-bridge/page-meta", query: { page: "/about" }, headers: {} });
    assert.equal(meta.body.title, "About");
    const sd = await b.handle({ method: "GET", pathname: "/api/geo-engine-bridge/structured-data", headers: {} });
    assert.deepEqual(sd.body.about, { "@type": "WebPage" });
    const ai = await b.handle({ method: "GET", pathname: "/api/geo-engine-bridge/ai-export", headers: AUTH });
    assert.ok(ai.body.count >= 1);
});

test("products flow", async () => {
    const b = makeBridge();
    await b.handle({
        method: "POST",
        pathname: "/api/geo-engine-bridge/products",
        headers: AUTH,
        body: { items: [{ external_id: "s1", name: "W" }] },
    });
    const list = await b.handle({ method: "GET", pathname: "/api/geo-engine-bridge/products", headers: AUTH });
    assert.equal(list.body.total, 1);
    const pub = await b.handle({ method: "GET", pathname: "/api/geo-engine-bridge/products/s1", headers: {} });
    assert.equal(pub.body.fields.name, "W");

    // Name is protected without _allow_name / _restore_name
    const upd = await b.handle({
        method: "PUT",
        pathname: "/api/geo-engine-bridge/products/s1",
        headers: AUTH,
        body: { fields: { name: "BadOverwrite", description: "Desc" } },
    });
    assert.deepEqual(upd.body.result_data.skipped_fields, ["name:protected"]);
    const pub2 = await b.handle({ method: "GET", pathname: "/api/geo-engine-bridge/products/s1", headers: {} });
    assert.equal(pub2.body.fields.name, "W");

    // apply-fix with SeoIssue envelope never overwrites page title with issue.title
    await b.handle({ method: "PUT", pathname: "/api/geo-engine-bridge/pages/pricing", headers: AUTH, body: { title: "Pricing" } });
    await b.handle({
        method: "POST",
        pathname: "/api/geo-engine-bridge/apply-fix",
        headers: AUTH,
        body: {
            page_id: "pricing",
            issue_type: "missing_schema",
            title: "Missing Schema.org",
            description: "Issue label",
            fix_content: '<script type="application/ld+json">{"@type":"Product"}</script>',
        },
    });
    const pr = await b.handle({ method: "GET", pathname: "/api/geo-engine-bridge/pages/pricing", headers: AUTH });
    assert.equal(pr.body.title, "Pricing");
    assert.deepEqual(pr.body.structuredData, { "@type": "Product" });
});

test("non-bridge path → null", async () => {
    const b = makeBridge();
    const r = await b.handle({ method: "GET", pathname: "/api/other", headers: {} });
    assert.equal(r, null);
});

test("meta helpers", async () => {
    const { geoEngineMetadata, jsonLdScriptProps, getManagedSeo } = require("../dist/meta");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "geo-meta-"));
    process.env.GEO_BRIDGE_STORE = path.join(dir, "seo.json");
    process.env.GEO_BRIDGE_PRODUCTS_STORE = path.join(dir, "p.json");
    process.env.GEO_ENGINE_API_KEY = "k";
    const { createStores } = require("../dist/store");
    const { seo } = createStores();
    seo.update("home", { title: "Managed Home", description: "md", structured_data: { "@type": "WebSite" } });
    const m = geoEngineMetadata("/");
    assert.equal(m.title, "Managed Home");
    assert.equal(m.description, "md");
    const scripts = jsonLdScriptProps("/");
    assert.equal(scripts.length, 1);
    assert.equal(scripts[0].type, "application/ld+json");
    assert.ok(scripts[0].dangerouslySetInnerHTML.__html.includes("WebSite"));
    const unmanaged = geoEngineMetadata("/nope");
    assert.deepEqual(unmanaged, {});
});

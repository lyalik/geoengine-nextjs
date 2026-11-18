"use strict";
// Self-update: download the bridge package zip from GEO Engine, verify
// sha256 (payload or X-GeoEngine-Sha256 header — server is authoritative
// for what it just served), extract, copy over the installed package
// directory with per-file backup + rollback on failure.
//
// Works for vendored installs and writable node_modules. For read-only
// installs prefer `npm install @geoengine/nextjs@latest` + restart.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.selfUpdate = selfUpdate;
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const version_1 = require("./version");
function verTuple(v) {
    return String(v || "0")
        .split(/[.\-+]/)
        .map((c) => {
        const m = /\d+/.exec(c);
        return m ? parseInt(m[0], 10) : 0;
    });
}
function verGte(a, b) {
    const ta = verTuple(a);
    const tb = verTuple(b);
    const len = Math.max(ta.length, tb.length);
    for (let i = 0; i < len; i++) {
        const d = (ta[i] || 0) - (tb[i] || 0);
        if (d !== 0)
            return d > 0;
    }
    return true;
}
function copyTreeOver(srcDir, dstDir) {
    const backupDir = node_fs_1.default.mkdtempSync(node_path_1.default.join(node_os_1.default.tmpdir(), "geoengine-nextjs-backup-"));
    const backups = new Map();
    const created = [];
    let written = 0;
    try {
        const stack = [srcDir];
        while (stack.length) {
            const root = stack.pop();
            for (const entry of node_fs_1.default.readdirSync(root, { withFileTypes: true })) {
                const s = node_path_1.default.join(root, entry.name);
                const rel = node_path_1.default.relative(srcDir, s);
                const d = node_path_1.default.join(dstDir, rel);
                if (entry.isDirectory()) {
                    stack.push(s);
                    continue;
                }
                if (node_fs_1.default.existsSync(d)) {
                    const bak = node_path_1.default.join(backupDir, rel);
                    node_fs_1.default.mkdirSync(node_path_1.default.dirname(bak), { recursive: true });
                    node_fs_1.default.copyFileSync(d, bak);
                    backups.set(d, bak);
                }
                else {
                    created.push(d);
                }
                node_fs_1.default.mkdirSync(node_path_1.default.dirname(d), { recursive: true });
                node_fs_1.default.copyFileSync(s, d);
                written++;
            }
        }
    }
    catch (exc) {
        for (const [d, bak] of backups) {
            try {
                node_fs_1.default.copyFileSync(bak, d);
            }
            catch { /* best effort */ }
        }
        for (const f of created) {
            try {
                if (node_fs_1.default.existsSync(f))
                    node_fs_1.default.unlinkSync(f);
            }
            catch { /* best effort */ }
        }
        node_fs_1.default.rmSync(backupDir, { recursive: true, force: true });
        throw exc;
    }
    return { written, backupDir };
}
async function downloadPackage(url, apiKey, dest) {
    const resp = await fetch(url, {
        headers: { "x-api-key": apiKey || "" },
        signal: AbortSignal.timeout(120000),
    });
    if (!resp.ok)
        throw new Error(`Package download failed: HTTP ${resp.status}`);
    const servedSha = resp.headers.get("x-geoengine-sha256") || "";
    const buf = Buffer.from(await resp.arrayBuffer());
    node_fs_1.default.writeFileSync(dest, buf);
    return servedSha;
}
async function selfUpdate(opts) {
    const { body, apiKey, autoRestart } = opts;
    const target = String(body.target_version || "");
    const sha256 = String(body.sha256 || "").toLowerCase();
    const apiUrl = (process.env.GEO_ENGINE_API_URL || "").replace(/\/+$/, "");
    const packageUrl = String(body.package_url ||
        process.env.GEO_ENGINE_PACKAGE_URL ||
        (apiUrl ? `${apiUrl}/api/v1/cms/agent/package?cms_type=nextjs` : ""));
    if (!packageUrl) {
        return { status: 422, body: { detail: "No package_url and GEO_ENGINE_API_URL unset" } };
    }
    if (target && verGte(version_1.VERSION, target)) {
        return { status: 200, body: { ok: true, already_up_to_date: true, version: version_1.VERSION } };
    }
    const tmpZip = node_path_1.default.join(node_os_1.default.tmpdir(), `geoengine-update-${process.pid}-${Date.now()}.zip`);
    let servedSha = "";
    try {
        servedSha = await downloadPackage(packageUrl, apiKey, tmpZip);
    }
    catch (exc) {
        return { status: 502, body: { detail: `Package download failed: ${exc.message}` } };
    }
    const check = (servedSha || sha256 || "").toLowerCase();
    if (check) {
        const digest = node_crypto_1.default.createHash("sha256").update(node_fs_1.default.readFileSync(tmpZip)).digest("hex");
        if (digest !== check) {
            node_fs_1.default.unlinkSync(tmpZip);
            return { status: 422, body: { detail: "Package checksum mismatch (download corrupt)" } };
        }
    }
    let AdmZip;
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        AdmZip = require("adm-zip");
    }
    catch {
        node_fs_1.default.unlinkSync(tmpZip);
        return { status: 503, body: { detail: "adm-zip is required for self-update (npm i adm-zip)" } };
    }
    const zip = new AdmZip(tmpZip);
    const entries = zip.getEntries();
    const pkgJsonEntry = entries.find((e) => /(^|\/)package\.json$/.test(e.entryName) && !e.isDirectory);
    if (!pkgJsonEntry) {
        node_fs_1.default.unlinkSync(tmpZip);
        return { status: 422, body: { detail: "Package layout mismatch (package.json missing)" } };
    }
    const pkgRootInZip = pkgJsonEntry.entryName.slice(0, pkgJsonEntry.entryName.length - "package.json".length);
    const extractDir = node_fs_1.default.mkdtempSync(node_path_1.default.join(node_os_1.default.tmpdir(), "geoengine-nextjs-update-"));
    zip.extractAllTo(extractDir, true);
    node_fs_1.default.unlinkSync(tmpZip);
    const srcRoot = node_path_1.default.join(extractDir, pkgRootInZip);
    if (!node_fs_1.default.existsSync(srcRoot) || !node_fs_1.default.statSync(srcRoot).isDirectory()) {
        node_fs_1.default.rmSync(extractDir, { recursive: true, force: true });
        return { status: 422, body: { detail: "Package layout mismatch" } };
    }
    // Install dir = parent of dist/ (package root containing package.json).
    const pkgDir = node_path_1.default.resolve(__dirname, "..");
    try {
        const { written, backupDir } = copyTreeOver(srcRoot, pkgDir);
        node_fs_1.default.rmSync(extractDir, { recursive: true, force: true });
        node_fs_1.default.rmSync(backupDir, { recursive: true, force: true });
        let newVersion = version_1.VERSION;
        try {
            const pj = JSON.parse(node_fs_1.default.readFileSync(node_path_1.default.join(pkgDir, "package.json"), "utf8"));
            if (pj.version)
                newVersion = pj.version;
        }
        catch { /* keep VERSION */ }
        const result = {
            ok: true,
            version: newVersion,
            files_written: written,
            requires_restart: true,
        };
        if (autoRestart) {
            result.restarting = true;
            setImmediate(() => process.exit(0));
        }
        return { status: 200, body: result };
    }
    catch (exc) {
        node_fs_1.default.rmSync(extractDir, { recursive: true, force: true });
        return { status: 500, body: { detail: `Update rolled back: ${exc.message}` } };
    }
}

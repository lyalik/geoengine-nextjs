# @geoengine/nextjs — GEO Engine bridge for Next.js

Drop-in bridge that lets [GEO Engine](https://geoengine.pro) manage SEO meta,
JSON-LD, llms.txt, the product catalog and managed files on a Next.js
(App Router) site.

## Install

```bash
npm install @geoengine/nextjs
# or vendored: unpack geoengine-nextjs.zip into your project and
# "file:./geoengine-nextjs" in package.json
```

## 1. API routes — copy the template

```bash
mkdir -p app/api/geo-engine-bridge/[...path]
cp node_modules/@geoengine/nextjs/template/route.ts.txt \
   app/api/geo-engine-bridge/[...path]/route.ts
```

The file already contains `export const runtime = "nodejs"` (required —
the bridge keeps JSON-file state) and wires all HTTP methods.

## 2. Managed metadata in pages

Next.js metadata is per-route — spread managed fields over your defaults:

```tsx
// app/about/page.tsx
import { geoEngineMetadata, jsonLdScriptProps } from "@geoengine/nextjs/meta";

export async function generateMetadata() {
    return geoEngineMetadata("/about", { title: "About us" });
}

export default function AboutPage() {
    return (
        <>
            {jsonLdScriptProps("/about").map((p, i) => <script key={i} {...p} />)}
            <h1>About</h1>
        </>
    );
}
```

Customer values always win where GEO Engine has no managed record for the
path — nothing is overwritten silently.

## Configuration (env)

| Var | Purpose |
|---|---|
| `GEO_ENGINE_API_KEY` | Project API key from GEO Engine (`ge_…`). **Required** — authed endpoints fail closed without it. |
| `GEO_BRIDGE_SITE_URL` | Public site URL |
| `GEO_BRIDGE_PAGES` | Comma-separated public routes (default `home`) |
| `GEO_BRIDGE_STORE` / `GEO_BRIDGE_PRODUCTS_STORE` | JSON store paths |
| `GEO_BRIDGE_STATIC_DIR` | Dir where `upload-file` writes (use `public/`) |
| `GEO_ENGINE_API_URL` | GEO Engine API base for `/self-update` pulls |
| `GEO_BRIDGE_AUTO_RESTART` | `1` → exit after self-update (restart via pm2/systemd) |

## Endpoints

Same contract as the FastAPI bridge: public `health`, `recon`,
`structured-data`, `page-meta`, `llms-txt`, `products/{id}`; authed
(`X-Api-Key`) `pages`, `apply-fix`, `ai-export`, `upload-file`,
`publish-file`, `posts`, `products`, `self-update`.

## Notes

- **Self-hosted Node only** — the JSON store needs a writable filesystem.
  On Vercel/serverless use a persistent volume or skip file-backed state.
- `self-update` copies over the package dir with backup + rollback;
  for read-only `node_modules` run `npm install @geoengine/nextjs@latest`.

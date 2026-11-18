# GEO Engine Next.js Bridge — установка

Интеграция Next.js-сайтов (App Router) с geoengine.pro: SEO-мета,
JSON-LD, llms.txt, каталог, managed-файлы, self-update.

## Требования

- Next.js 13.4+ (App Router), Node.js 18+
- Self-hosted Node (JSON-store требует записываемой ФС; на Vercel —
  persistent volume или отключить файловое состояние)
- API-ключ проекта в GEO Engine (`ge_…`)

## Установка

```bash
npm install github:lyalik/geoengine-nextjs#v1.0.1
```

или vendored: `unzip geoengine-nextjs.zip` → `"file:./geoengine-nextjs"`.

## Подключение

1. Route handler — скопируйте шаблон:

```bash
mkdir -p app/api/geo-engine-bridge/[...path]
cp node_modules/@geoengine/nextjs/template/route.ts.txt \
   app/api/geo-engine-bridge/[...path]/route.ts
```

2. Managed-метаданные на страницах:

```tsx
import { geoEngineMetadata, jsonLdScriptProps } from "@geoengine/nextjs/meta";

export async function generateMetadata() {
    return geoEngineMetadata("/about", { title: "О нас" });
}
```

```tsx
{jsonLdScriptProps("/about").map((p, i) => <script key={i} {...p} />)}
```

## Env (.env)

```env
GEO_ENGINE_API_KEY=ge_ВАШ_КЛЮЧ
GEO_BRIDGE_SITE_URL=https://example.com
GEO_BRIDGE_STATIC_DIR=./public
GEO_ENGINE_API_URL=https://geoengine.pro
```

## Проверка

```bash
curl https://example.com/api/geo-engine-bridge/health
# {"status":"ok","service":"geo-engine-bridge","version":"1.0.0",...}
```

GEO Engine → Integrations → New → preset **Next.js Bridge**.

## Обновление

`npm install @geoengine/nextjs@latest` + restart, либо self-update
(`POST /self-update`, `GEO_BRIDGE_AUTO_RESTART=1` для авторестарта).

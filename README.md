# Tree Shaking Barrel Test

Тестируем tree shaking на 7 бандлерах: webpack, rspack, rollup, vite, esbuild, Next.js (webpack) и Next.js (Turbopack).

Один и тот же набор данных (6 экспортов, 3 страницы — каждая использует только 2), три способа импорта:

- **Single file** — все экспорты в одном файле
- **Barrel** — экспорты в отдельных файлах, импорт через `index.ts`
- **Direct** — прямой импорт из конкретного файла, без barrel

## Быстрый старт

```bash
pnpm install
node analyze.js
```

Скрипт установит зависимости, соберёт каждый бандлер и покажет где tree shaking сработал, а где нет.

## Результаты

| Кейс | webpack | rspack | rollup | vite | esbuild | next-webpack | next-turbopack |
|------|---------|--------|--------|------|---------|-------------|---------------|
| Single file | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Barrel | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Direct | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**Direct import работает у всех 7 бандлеров.** Если хотите гарантированный tree shaking — `import { X } from './constants/a'` вместо `import { X } from './constants'`.

Подробный разбор почему каждый бандлер ведёт себя именно так — в [статье](article.md).

## Структура проекта

```
shared/                          общие исходники для всех бандлеров
  constants-single-file.ts       все экспорты в одном файле
  constants-separate/            экспорты в отдельных файлах
    a.ts, b.ts, c.ts, index.ts

webpack/ rspack/ rollup/         каждый бандлер — отдельный workspace-пакет
vite/ esbuild/                   с одинаковой структурой entry
next-webpack/ next-turbopack/    Next.js с app router

analyze.js                       автоматический анализ
pnpm-workspace.yaml              монорепо
```

## Бандлеры

| Бандлер | Версия |
|---------|--------|
| webpack | 5 |
| rspack | 1 |
| rollup | 4 |
| vite | 8 |
| esbuild | 0.28 |
| Next.js (webpack) | 15 |
| Next.js (Turbopack) | 16 |
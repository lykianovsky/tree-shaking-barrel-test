# Почему tree shaking не работает с barrel файлами — тест на 7 бандлерах

Практическое сравнение tree shaking в webpack, rspack, rollup, vite, esbuild, Next.js (webpack) и Next.js (Turbopack). Тестируем как barrel file (index.ts с реэкспортами) влияет на удаление мёртвого кода, и почему в одних случаях это работает, а в других нет.

## Что тестируем

Есть 6 экспортов — 3 константы и 3 объекта конфигурации. Каждая страница использует только 2 из них. Если бандлер правильно делает tree shaking (удаление неиспользуемого кода при сборке), в финальный файл попадут только нужные данные. Если нет — потащит всё, и в бандле окажется мёртвый код который никогда не выполнится.

Три кейса с одинаковыми данными, но разной структурой импортов:

### 1. Single file — все экспорты в одном файле

Все 6 экспортов лежат в одном файле:

```ts
// shared/constants-single-file.ts

export const CONSTANT_A = 'value_a_from_single_file'
export const CONSTANT_B = 'value_b_from_single_file'
export const CONSTANT_C = 'value_c_from_single_file'

export const CONFIG_A = { name: 'config_a', value: 1, nested: { deep: true } }
export const CONFIG_B = { name: 'config_b', value: 2, nested: { deep: false } }
export const CONFIG_C = { name: 'config_c', value: 3, nested: { deep: true } }
```

Страница берёт только то что ей нужно:

```ts
// page1.ts
import { CONSTANT_A, CONFIG_A } from '../shared/constants-single-file'

console.log('Page 1:', CONSTANT_A, CONFIG_A)
```

Бандлер должен выкинуть B и C — они не используются.

### 2. Barrel — экспорты в отдельных файлах, импорт через index.ts

Каждый экспорт в своём файле:

```ts
// shared/constants-separate/a.ts
export const CONSTANT_A = 'value_a_from_separate_file'
export const CONFIG_A = { name: 'config_a', value: 1, nested: { deep: true } }
```

```ts
// shared/constants-separate/b.ts
export const CONSTANT_B = 'value_b_from_separate_file'
export const CONFIG_B = { name: 'config_b', value: 2, nested: { deep: false } }
```

```ts
// shared/constants-separate/c.ts
export const CONSTANT_C = 'value_c_from_separate_file'
export const CONFIG_C = { name: 'config_c', value: 3, nested: { deep: true } }
```

А `index.ts` реэкспортирует всё — это и есть barrel file:

```ts
// shared/constants-separate/index.ts
export { CONSTANT_A, CONFIG_A } from './a'
export { CONSTANT_B, CONFIG_B } from './b'
export { CONSTANT_C, CONFIG_C } from './c'
```

Страница импортирует через barrel:

```ts
// page1.ts — импорт через barrel
import { CONSTANT_A, CONFIG_A } from '../shared/constants-separate'

console.log('Page 1:', CONSTANT_A, CONFIG_A)
```

### 3. Direct — прямой импорт из файла, без barrel

Те же отдельные файлы, но `index.ts` не участвует — импорт идёт напрямую:

```ts
// page1.ts — прямой импорт
import { CONSTANT_A, CONFIG_A } from '../shared/constants-separate/a'

console.log('Page 1:', CONSTANT_A, CONFIG_A)
```

Бандлер видит только `a.ts` и не трогает `b.ts` / `c.ts`.

## Какие бандлеры сравниваем

| Бандлер | Версия | Описание |
|---------|--------|----------|
| **webpack** | 5 | Scope hoisting + terser |
| **rspack** | 1 | Webpack переписанный на Rust, тот же API |
| **rollup** | 4 | Заточен под tree shaking и ES-модули |
| **vite** | 8 | Rollup под капотом для production |
| **esbuild** | 0.28 | Написан на Go, самый быстрый |
| **next-webpack** | Next.js 15 | Next.js с webpack под капотом |
| **next-turbopack** | Next.js 16 | Next.js 16 с Turbopack по дефолту |

## Как запустить

```bash
pnpm install
node analyze.js
```

`analyze.js` установит зависимости в каждом пакете, соберёт всё, и выведет:
- скорость сборки каждого бандлера (с диаграммой)
- детальный разбор чанков — какие маркеры попали, размеры, есть ли мёртвый код
- итоговую таблицу — где tree shaking сработал, а где нет

## Структура проекта

```
shared/                          общие исходники для всех бандлеров
  constants-single-file.ts       все экспорты в одном файле
  constants-separate/            экспорты в отдельных файлах
    a.ts, b.ts, c.ts             по 2 экспорта в каждом
    index.ts                     barrel — реэкспорт всего

webpack/                         каждый бандлер — отдельный workspace-пакет
  src/single-file/               entry для кейса single
  src/separate-files/            entry для кейса barrel
  src/direct-files/              entry для кейса direct
  src/spa/                       SPA-пример (dynamic import + splitChunks)

rspack/ rollup/ vite/ esbuild/   аналогичная структура
next-webpack/ next-turbopack/    Next.js с app router

analyze.js                       автоматический анализ
pnpm-workspace.yaml              монорепо
```

## Как analyze.js определяет результат

В исходных данных 6 маркеров: `value_a`, `value_b`, `value_c`, `config_a`, `config_b`, `config_c`. Каждая страница использует только 2 (page1 — `value_a` + `config_a`, и так далее).

После сборки скрипт ищет маркеры в выходных JS-файлах:
- **2 маркера в чанке** — tree shaking сработал, в файле только нужное
- **6 маркеров** — не сработал, бандлер затянул всё

> Чанк (chunk) — отдельный JS-файл на выходе сборки. Entry chunk — точка входа страницы, shared chunk — общий код, вынесенный из нескольких entry.

## Результаты

| Кейс | webpack | rspack | rollup | vite | esbuild | next-webpack | next-turbopack |
|------|---------|--------|--------|------|---------|-------------|---------------|
| Single file | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Barrel | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Direct | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Только webpack и rspack справляются со всеми тремя кейсами. Rollup и vite ломаются на single file — выносят все 6 экспортов в shared chunk вместо инлайна. esbuild и next-webpack проваливают и single и barrel. Turbopack (Next.js 16) не справляется с single file, но barrel обрабатывает.

## Почему webpack и rspack справляются со всем

Webpack и rspack — единственные кто проходит все три кейса. Причина — scope hoisting (`ModuleConcatenationPlugin`) в связке с terser:

**Шаг 1 — scope hoisting.** Webpack объединяет все модули (a.ts, b.ts, c.ts, index.ts, page1.ts) в один скоуп. Не оборачивает каждый модуль в отдельную функцию, а складывает весь код в одно место. На этом этапе мёртвый код ещё не удалён — все 6 экспортов присутствуют в каждом entry.

Вот `page1.js` после scope hoisting, но **до минификации** (`minimize: false`):

```js
// webpack dist/separate/page1.js — minimize: false
(() => {
  "use strict";

  // ../shared/constants-separate/a.ts
  const CONSTANT_A = 'value_a_from_separate_file';
  const CONFIG_A = { name: 'config_a', value: 1, nested: { deep: true } };

  // ../shared/constants-separate/b.ts        ← мёртвый код
  const CONSTANT_B = 'value_b_from_separate_file';
  const CONFIG_B = { name: 'config_b', value: 2, nested: { deep: false } };

  // ../shared/constants-separate/c.ts        ← мёртвый код
  const CONSTANT_C = 'value_c_from_separate_file';
  const CONFIG_C = { name: 'config_c', value: 3, nested: { deep: true } };

  // ./src/separate-files/page1.ts
  console.log('Page 1:', CONSTANT_A, CONFIG_A);
})();
```

Все 6 экспортов на месте. Scope hoisting собрал всё в один скоуп, но ничего не удалил.

**Шаг 2 — terser (`minimize: true`, по дефолту).** Terser видит что `CONSTANT_B`, `CONSTANT_C`, `CONFIG_B`, `CONFIG_C` нигде не вызываются — и вырезает. Результат:

```js
// webpack dist/separate/page1.js — minimize: true (дефолт)
(() => {
  "use strict";
  console.log("Page 1:", "value_a_from_separate_file", { name: "config_a", value: 1, nested: { deep: !0 } })
})();
```

Чисто. Только `value_a` и `config_a`.

**Если отключить `minimize: false` — tree shaking ломается.** Terser не запускается, весь мёртвый код остаётся. Scope hoisting сам по себе не удаляет код — он только создаёт условия для terser. Без минификации webpack не лучше остальных.

### Почему rollup/vite не зависят от minimize, но ломаются на single file

Rollup и vite делают tree shaking на этапе сборки графа модулей, ещё до минификации. Rollup анализирует какие экспорты реально используются и не включает остальные. Ему не нужен terser чтобы вырезать мёртвый код.

Но у rollup другая проблема — когда один файл импортируется из нескольких entry (page1, page2, page3 все тянут `constants-single-file.ts`), rollup выносит его в shared chunk. Shared chunk содержит все 6 экспортов, потому что разные страницы используют разные:

```js
// rollup dist/single/shared-constants-single-file.js — ВСЕ 6 экспортов
const e = "value_a_from_single_file", a = { name: "config_a" ... };
const n = "value_b_from_single_file", o = { name: "config_b" ... };
const s = "value_c_from_single_file", t = { name: "config_c" ... };
export { e as C, a, n as b, o as c, s as d, t as e };
```

Каждая страница берёт из shared chunk только свои 2, но сам chunk грузится целиком — мёртвый код доставляется клиенту.

Webpack не создаёт shared chunk — дублирует код в каждый entry через scope hoisting, а terser вычищает лишнее. Каждый entry содержит только нужное.

В barrel-кейсе rollup справляется — трейсит через `index.ts` до конкретных файлов и включает только нужные. Shared chunk не создаётся потому что файлы маленькие и не пересекаются между entry.

### Почему barrel ломается в Next.js (webpack)

В чистом webpack barrel работает — scope hoisting + terser справляются. Но в Next.js граница `'use client'` создаёт chunk boundary. Каждый клиентский компонент — отдельная точка входа, и webpack не может объединить модули через эту границу в один скоуп. Barrel тянет весь граф в каждый чанк:

```js
// next-webpack .next/static/chunks/app/separate/page-....js — ВСЕ 6 маркеров
let t = "value_a_from_separate_file", _ = { name: "config_a" ... };
let t = "value_b_from_separate_file", _ = { name: "config_b" ... };  // мёртвый код
let t = "value_c_from_separate_file", _ = { name: "config_c" ... };  // мёртвый код
```

Direct import решает проблему — каждый чанк видит только свой файл.

Turbopack (Next.js 16) справляется с barrel — трейсит через `index.ts` до конкретных файлов, как rollup. Но single file ломает — scope hoisting не на том уровне.

### Что с rspack

rspack — тот же webpack на Rust. Тот же конфиг, те же результаты tree shaking. Быстрее, но каждый чанк на ~180 байт больше из-за runtime-обвязки:

```js
// rspack dist/single/page1.js — лишний runtime сверху
(() => {
  "use strict";
  var e = {}, r = {};
  function a(o) { var t = r[o]; if (void 0 !== t) return t.exports; var s = r[o] = { exports: {} }; return e[o](s, s.exports, a), s.exports }
  a.rv = () => "1.7.11",
  a.ruid = "bundler=rspack@1.7.11",
  console.log("Page 1:", "value_a_from_single_file", { name: "config_a", value: 1, nested: { deep: !0 } })
})();
```

### Что с esbuild

esbuild выносит общий код в shared chunk — и для single file, и для barrel:

```js
// esbuild dist/separate/shared-chunk-X3DOSE65.js — ВСЕ 6 экспортов
var e = "value_a_from_separate_file", _ = { name: "config_a" ... };
var o = "value_b_from_separate_file", t = { name: "config_b" ... };
var r = "value_c_from_separate_file", a = { name: "config_c" ... };
export { e as a, _ as b, o as c, t as d, r as e, a as f };
```

Каждая страница берёт только свои 2 значения, но shared chunk грузится целиком. С direct-импортами shared chunk не создаётся.

## SPA: дублирование кода и синглтоны в webpack

В `webpack/src/spa/` — отдельный пример: SPA с динамическими импортами. Три страницы используют общий `shared-state.ts`:

```ts
// shared-state.ts
export const testMap = new Map<string, string>()
```

```ts
// entry.ts — загружает страницы динамически
async function navigate(page: string) {
  switch (page) {
    case 'page1': await import('./page1'); break
    case 'page2': await import('./page2'); break
    case 'page3': await import('./page3'); break
  }
}

navigate('page1').then(() => navigate('page2'))
```

```ts
// page1.ts — пишет в Map
import { testMap } from './shared-state'
testMap.set('page', 'page1')
console.log('Page 1:', testMap.get('page'))
```

```ts
// page2.ts — читает из Map
import { testMap } from './shared-state'
console.log('Page 2:', testMap.get('page'))  // 'page1' — если синглтон работает
```

Два варианта сборки (`webpack.config.spa.js`):

### Без splitChunks (spa-default)

Webpack инлайнит `shared-state.ts` в каждый чанк. Если посмотреть на выходной код, `new Map()` создаётся внутри каждого файла:

```js
// 503.chunk.js (page1) — Map создаётся здесь
(self.webpackChunktest_webpack = self.webpackChunktest_webpack || []).push([[503], {
  503(e, a, s) {
    var p = s(564);                          // запрашивает модуль 564
    p.R.set("page", "page1"),
    console.log("Page 1:", p.R.get("page"))
  },
  564(e, a, s) {                             // модуль 564 — shared-state
    s.d(a, { R: () => p });
    const p = new Map                        // ← вот она
  }
}]);
```

```js
// 570.chunk.js (page2) — тот же модуль 564 внутри
(self.webpackChunktest_webpack = self.webpackChunktest_webpack || []).push([[570], {
  570(e, s, a) {
    var t = a(564);                          // тоже запрашивает 564
    console.log("Page 2:", t.R.get("page"))
  },
  564(e, s, a) {                             // тот же модуль 564
    a.d(s, { R: () => t });
    const t = new Map                        // ← ещё раз new Map
  }
}]);
```

Выглядит как два разных `new Map()` — кажется что синглтон сломается и page2 не увидит данные page1.

На самом деле нет. Webpack при первом вызове `require(564)` выполняет функцию и сохраняет результат в module cache (`__webpack_module_cache__`). Когда page2 запрашивает тот же модуль 564 — webpack берёт его из кэша, `new Map` второй раз не вызывается. Код дублирован физически, но выполняется один раз. Синглтон работает.

### С splitChunks (spa-split)

> `splitChunks` — настройка webpack для выноса общего кода в отдельные файлы. Параметр `minSize` задаёт порог: если общий модуль меньше порога, webpack дублирует его в каждом чанке вместо выноса.

С `splitChunks: { minSize: 0 }` webpack выносит `shared-state.ts` в отдельный чанк:

```js
// 564.chunk.js — shared-state вынесен отдельно, один на всех
(self.webpackChunktest_webpack = self.webpackChunktest_webpack || []).push([[564], {
  564(e, s, t) {
    t.d(s, { R: () => c });
    const c = new Map
  }
}]);
```

```js
// 503.chunk.js (page1) — только логика страницы, без Map
(self.webpackChunktest_webpack = self.webpackChunktest_webpack || []).push([[503], {
  503(e, a, s) {
    var p = s(564);
    p.R.set("page", "page1"),
    console.log("Page 1:", p.R.get("page"))
  }
}]);
```

Дублирования нет — все страницы ссылаются на один файл. Чище, но по дефолту `minSize` стоит 20kb, и мелкие модули под порог не попадают.

```bash
# Собрать SPA-пример
cd webpack
npx webpack --config webpack.config.spa.js
```

## Выводы

**webpack и rspack — единственные кто проходит все три кейса.** Scope hoisting дублирует код в каждый entry, а terser вычищает мёртвый код. Два шага вместо одного, но результат чистый.

**Без `minimize` webpack ломается.** Scope hoisting сам по себе не удаляет код — он создаёт условия для terser. Отключи минификацию — и все 6 экспортов останутся в каждом чанке. В rollup такой проблемы нет — tree shaking там на этапе сборки графа, до минификации.

**Rollup и vite ломаются на single file, но справляются с barrel.** Когда один файл импортируется из нескольких entry, rollup выносит его в shared chunk со всеми экспортами. В barrel-кейсе файлы маленькие и не пересекаются — shared chunk не создаётся.

**Next.js (webpack) ломает barrel из-за `'use client'`.** Граница клиентского компонента мешает scope hoisting. Чистый webpack справляется, но через Next.js — нет. Turbopack (Next.js 16) наоборот — barrel обрабатывает, но single file ломает.

**Прямые импорты решают проблему у всех.** `import { X } from './constants/a'` вместо `import { X } from './constants'` — и мёртвый код не попадает в бандл ни в одном из 7 бандлеров.

**Дублирование кода в webpack SPA — не баг.** Module cache (`__webpack_module_cache__`) гарантирует что модуль выполняется один раз. Синглтоны не ломаются даже когда `new Map()` физически записан в нескольких чанках.

**rspack быстрее webpack, но тяжелее.** Тот же результат tree shaking, но +180 байт runtime в каждом чанке.

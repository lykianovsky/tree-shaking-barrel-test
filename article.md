# Почему ваш бандл тяжелее чем должен быть — тестирую tree shaking на 7 бандлерах

## Как всё началось

В августе 2024 я наткнулся на проблему в рабочем проекте на Next.js. Несколько страниц импортировали константы из общего файла через barrel (index.ts с реэкспортами). Каждая страница использовала 2-3 значения, но в бандл попадало всё — десятки неиспользуемых экспортов. Разница оказалась колоссальной: когда я добавил `sideEffects: false` и перешёл на direct export — бандл уменьшился в два раза.

Я завёл [issue на GitHub](https://github.com/vercel/next.js/issues/69532), покопался, нашёл обходной путь и закрыл. Но вопрос не отпускал: это Next.js виноват? Webpack? Или barrel файлы сами по себе проблема? Спустя полтора года решил разобраться основательно — собрал лабораторную работу, прогнал одни и те же тесты на 7 бандлерах и посмотрел что реально попадает в выходные файлы.

**Сразу оговорюсь:** я не претендую на истину. Это личное исследование, которое я провёл чтобы разобраться в теме для себя. Делюсь результатами в надежде узнать что-то новое от людей, которые работают с бандлерами глубже. Если где-то ошибся или упустил важное — буду рад, если поправите в комментариях.

## Что такое barrel file и почему с ним проблемы

Barrel file — это `index.ts`, который реэкспортирует всё из нескольких файлов в одном месте:

```ts
// shared/constants/index.ts — barrel file
export { CONSTANT_A, CONFIG_A } from './a'
export { CONSTANT_B, CONFIG_B } from './b'
export { CONSTANT_C, CONFIG_C } from './c'
```

Удобно — вместо трёх импортов пишешь один:

```ts
import { CONSTANT_A, CONFIG_A } from '../shared/constants'
```

Проблема в том, что бандлер видит импорт из `index.ts` и может затянуть весь граф зависимостей — включая `b.ts` и `c.ts`, которые этой странице не нужны. Неиспользуемый код, который бандлер должен был вырезать (это и есть tree shaking — удаление мёртвого кода при сборке), остаётся в финальном файле и едет в продакшен.

## Лабораторная: 7 бандлеров, 3 кейса

Задумка простая — взять одни и те же данные, одну и ту же структуру импортов, и посмотреть как каждый бандлер справляется с удалением неиспользуемого кода. Без фреймворков, без сложной логики, минимальный воспроизводимый пример.

6 экспортов — 3 простые строки и 3 объекта конфигурации. Три страницы, каждая использует только 2 из 6. Если tree shaking работает — в финальном файле страницы будут только её 2 значения. Если нет — потащит все 6.

Одни и те же данные, три варианта импорта:

**Single file** — все 6 экспортов в одном файле:

```ts
// shared/constants-single-file.ts
export const CONSTANT_A = 'value_a_from_single_file'
export const CONFIG_A = { name: 'config_a', value: 1, nested: { deep: true } }
// ... и ещё B, C
```

**Barrel** — экспорты разнесены по файлам, импорт через `index.ts`:

```ts
// shared/constants-separate/index.ts
export { CONSTANT_A, CONFIG_A } from './a'
export { CONSTANT_B, CONFIG_B } from './b'
export { CONSTANT_C, CONFIG_C } from './c'
```

**Direct** — те же отдельные файлы, но импорт напрямую, без barrel:

```ts
import { CONSTANT_A, CONFIG_A } from '../shared/constants-separate/a'
```

Прогнал на:
- **webpack 5** — scope hoisting + terser
- **rspack 1** — webpack на Rust, тот же API
- **rollup 4** — заточен под ES-модули и tree shaking
- **vite 8** — rollup под капотом для production-сборки
- **esbuild 0.28** — написан на Go, самый быстрый
- **Next.js 15 (webpack)** — Next.js с webpack под капотом
- **Next.js 16 (Turbopack)** — Next.js с Turbopack по умолчанию

Всё автоматизировано — `node analyze.js` ставит зависимости, собирает каждый бандлер и анализирует выходные файлы, проверяя какие маркеры попали в бандл.

Репозиторий с лабораторной: [github.com/lykianovsky/tree-shaking-barrel-test](https://github.com/lykianovsky/tree-shaking-barrel-test)

## Результаты

| Кейс | webpack | rspack | rollup | vite | esbuild | next-webpack | next-turbopack |
|------|---------|--------|--------|------|---------|-------------|---------------|
| Single file | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Barrel | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Direct | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Первое что бросается в глаза — только webpack и rspack справляются со всеми тремя кейсами. Остальные ломаются на single file, barrel, или на обоих. Direct import — единственный вариант, который работает у всех семи.

## Как webpack делает tree shaking — и почему это два шага, а не один

Webpack не вырезает мёртвый код напрямую. Он работает в два этапа:

**Шаг 1 — scope hoisting.** `ModuleConcatenationPlugin` объединяет все модули в один скоуп. Вместо того чтобы оборачивать каждый файл в отдельную функцию, webpack складывает весь код в одно место. На этом этапе мёртвый код ещё никуда не делся — все 6 экспортов на месте:

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

**Шаг 2 — terser.** Минификатор видит что `CONSTANT_B`, `CONFIG_B`, `CONSTANT_C`, `CONFIG_C` нигде не используются — и вырезает:

```js
// webpack dist/separate/page1.js — minimize: true (по умолчанию)
(()=>{"use strict";console.log("Page 1:","value_a_from_separate_file",{name:"config_a",value:1,nested:{deep:!0}})})();
```

Чисто. Только нужные данные.

**Важный момент: отключи `minimize: false` — и tree shaking ломается.** Terser не запускается, все 6 экспортов остаются. Scope hoisting сам по себе не удаляет код — он только создаёт условия, чтобы terser мог увидеть неиспользуемые переменные. Без минификации webpack не лучше остальных.

В rollup и vite такой зависимости нет — tree shaking у них работает на этапе построения графа модулей, ещё до минификации. Rollup анализирует какие экспорты реально используются и просто не включает остальные в выходной файл.

### Какую проблему создаёт scope hoisting — дублирование кода

Scope hoisting дублирует модули в каждый entry. Это даёт чистый tree shaking, но создаёт побочный эффект — один и тот же код физически присутствует в нескольких файлах. Вот пример из SPA с динамическими импортами, где три страницы используют общий `shared-state.ts`:

```ts
// shared-state.ts
export const testMap = new Map<string, string>()
```

```ts
// page1.ts — пишет в Map
import { testMap } from './shared-state'
testMap.set('page', 'page1')
```

```ts
// page2.ts — читает из Map
import { testMap } from './shared-state'
console.log('Page 2:', testMap.get('page'))  // 'page1' — если синглтон работает
```

После сборки `new Map()` появляется внутри каждого чанка:

```js
// 503.chunk.js (page1)
(self.webpackChunktest_webpack = self.webpackChunktest_webpack || []).push([[503], {
  503(e, a, s) {
    var p = s(564);
    p.R.set("page", "page1"),
    console.log("Page 1:", p.R.get("page"))
  },
  564(e, a, s) {
    s.d(a, { R: () => p });
    const p = new Map                        // ← new Map здесь
  }
}]);
```

```js
// 570.chunk.js (page2)
(self.webpackChunktest_webpack = self.webpackChunktest_webpack || []).push([[570], {
  570(e, s, a) {
    var t = a(564);
    console.log("Page 2:", t.R.get("page"))
  },
  564(e, s, a) {
    a.d(s, { R: () => t });
    const t = new Map                        // ← и здесь тоже
  }
}]);
```

Выглядит как два разных `new Map()` — кажется что синглтон сломается и page2 не увидит данные page1. На самом деле нет. Webpack при первом вызове `require(564)` выполняет функцию и сохраняет результат в module cache (`__webpack_module_cache__`). Когда page2 запрашивает тот же модуль 564 — webpack берёт его из кэша, `new Map` второй раз не вызывается. Код дублирован физически, но выполняется один раз. Синглтон работает.

Если дублирование не устраивает — `splitChunks` с `minSize: 0` выносит общий код в отдельный чанк, один на всех. Но тогда этот чанк содержит все экспорты и tree shaking на нём не работает — тот же компромисс что у rollup.

## Почему rollup и vite ломаются на single file

Если tree shaking у rollup работает на этапе графа — почему single file ломается?

Потому что когда один файл (`constants-single-file.ts`) импортируется из нескольких entry (page1, page2, page3), rollup выносит его в отдельный shared chunk. Этот shared chunk содержит все 6 экспортов, потому что разные страницы используют разные:

```js
// rollup dist/single/shared-constants-single-file.js
const e = "value_a_from_single_file", a = { name: "config_a" ... };
const n = "value_b_from_single_file", o = { name: "config_b" ... };
const s = "value_c_from_single_file", t = { name: "config_c" ... };
export { e as C, a, n as b, o as c, s as d, t as e };
```

Shared chunk — это отдельный JS-файл, в который бандлер выносит код, общий для нескольких страниц. Каждая страница подключает его и берёт только свои значения, но сам файл грузится целиком — мёртвый код доставляется в браузер.

Webpack поступает иначе — дублирует код в каждый entry через scope hoisting, а terser вычищает лишнее в каждом отдельно. Каждый entry содержит только нужное.

В barrel-кейсе rollup справляется — трейсит через `index.ts` до конкретных файлов и включает только нужные. Shared chunk не создаётся, потому что файлы маленькие и разные страницы тянут разные файлы, которые не пересекаются.

## Почему esbuild ломает и barrel тоже

esbuild — самый быстрый из всех, но агрессивно создаёт shared chunks. И для single file, и для barrel весь общий код уезжает в один файл:

```js
// esbuild dist/separate/shared-chunk-X3DOSE65.js — ВСЕ 6 экспортов
var e="value_a_from_separate_file",_={name:"config_a",value:1,nested:{deep:!0}};
var o="value_b_from_separate_file",t={name:"config_b",value:2,nested:{deep:!1}};
var r="value_c_from_separate_file",a={name:"config_c",value:3,nested:{deep:!0}};
export{e as a,_ as b,o as c,t as d,r as e,a as f};
```

С direct-импортами shared chunk не создаётся — каждая страница видит только свой файл.

## Почему Next.js (webpack) ломает tree shaking — и это не 'use client'

Это было самое интересное в исследовании. Первая мысль — виноват `'use client'`, граница клиентского компонента мешает scope hoisting. Но нет — **на Pages Router, где никакого `'use client'` нет, картина ровно такая же**.

Я полез в исходники Next.js и повесил отладочные хуки на webpack-конфиг. Вот что выяснилось:

**Next.js вообще не включает `ModuleConcatenationPlugin`.** В файле [`webpack-config.js`](https://github.com/vercel/next.js/blob/canary/packages/next/src/build/webpack-config.ts) нет ни одного упоминания `concatenateModules` или `ModuleConcatenationPlugin`. Ноль.

Окей, может достаточно включить руками? Добавил через `next.config.js`:

```ts
webpack(config) {
  config.optimization.concatenateModules = true
  return config
}
```

Результат — 0 модулей сконкатенировано. Bailout на каждом. Webpack прямо говорит почему:

```
ModuleConcatenation bailout: Cannot concat with shared/constants-single-file.ts:
  Module is referenced from different chunks by these modules:
  app/single/page2/page.tsx, app/single/page3/page.tsx
```

**Корневая причина: Next.js создаёт отдельный chunk entry на каждую страницу.** В Pages Router это делает `next-client-pages-loader`, в App Router — `next-flight-client-entry-loader`. Когда `constants-single-file.ts` импортируется из page1, page2, page3 — модуль оказывается referenced из нескольких чанков.

`ModuleConcatenationPlugin` не может заинлайнить модуль, на который ссылаются из разных чанков — ему пришлось бы дублировать код, а он этого не делает. Без конкатенации модули остаются в отдельных обёртках, terser не видит что экспорты не используются, мёртвый код остаётся.

В чистом webpack те же 3 entry, тот же файл. Но там `splitChunks.minSize = 20000` (порог по умолчанию) — файл констант маленький, не дотягивает, webpack не выносит его в shared chunk, а дублирует в каждый entry. Дублированный код конкатенируется → terser вычищает. Next.js так не может — его загрузчики сразу создают отдельные chunk entries для каждой страницы, и модули автоматически шарятся между ними.

Turbopack (Next.js 16) частично решает проблему — barrel обрабатывает, трейсит через `index.ts` до конкретных файлов, как rollup. Но single file всё равно ломает — та же история с shared модулем.

## Можно ли починить tree shaking в Next.js?

Теоретически есть три пути:

**Дублировать модули в каждый entry** — как делает чистый webpack с маленькими файлами. Конкатенация работает, terser вычищает. Но Next.js специально шарит модули между страницами — при навигации page1 → page2 shared chunk уже в кеше браузера. Дублирование означает: каждая страница тяжелее, при навигации тот же код грузится заново.

**Tree shaking на уровне графа** — резать неиспользуемые экспорты при построении графа, не зависеть от concat + terser. Turbopack так и делает, поэтому barrel у него работает. Но это переписывание core-логики webpack, и single file всё равно не решается.

**Per-entry копии модуля** — создавать отдельную версию модуля для каждого entry с только нужными экспортами. Фундаментальное изменение, которого в webpack нет и вряд ли появится.

На практике:

- **Большие barrel-ы из npm** (`@mui/icons-material`, `lodash-es`) — Next.js решает через [`optimizePackageImports`](https://nextjs.org/docs/app/api-reference/config/next-config-js/optimizePackageImports), который переписывает `import { Add } from '@mui/icons-material'` в `import Add from '@mui/icons-material/Add'`
- **Свои barrel-ы** — direct import или разбивай на мелкие группы по фичам
- **Масштаб проблемы** зависит от размера barrel-а. 6 констант — незаметно. Но если в одном файле 100 экспортов с тяжёлыми объектами — каждая страница тащит всё, и это уже ощутимо

## Трейдоффы — нет единого лучшего решения

Каждый бандлер делает свой выбор, и у каждого выбора есть цена:

**webpack / rspack** — дублирует код в каждый entry, concat + terser вычищает мёртвое. Tree shaking работает на всех кейсах. Но есть порог `splitChunks.minSize` (по умолчанию 20kb) — если общий модуль вырастает больше порога, webpack выносит его в shared chunk и tree shaking на нём ломается. Плюс зависимость от `minimize` — без минификации ничего не вырезается.

**rollup / vite** — tree shaking на этапе графа, не зависит от минификации. Но создают shared chunks для файлов, которые импортируются из нескольких entry. Shared chunk содержит все экспорты для всех потребителей — мёртвый код для конкретной страницы.

**esbuild** — быстрее всех, но агрессивные shared chunks и для single file, и для barrel. Tree shaking работает только с direct imports.

**Next.js (webpack)** — multi-entry архитектура ради кеширования при навигации между страницами. Shared chunk загрузился один раз — при переходе на другую страницу грузится только новый код. Цена — tree shaking не работает на shared модулях, мёртвый код попадает в бандл.

## Вывод

Direct import — единственный вариант, который работает у всех 7 бандлеров. `import { X } from './constants/a'` вместо `import { X } from './constants'` — и проблемы нет.

Barrel файлы — это компромисс между удобством разработчика и размером бандла. В маленьком проекте с парой констант разница незаметна. В большом проекте с сотней экспортов в одном barrel-е — уже ощутимо.

Но у меня остался открытый вопрос, на который я так и не нашёл ответа. Webpack пошёл по пути scope hoisting + terser — объединяет модули, дублирует, потом вычищает. Rollup, vite, esbuild пошли другим путём — tree shaking на уровне графа, shared chunks вместо дублирования. Почему? Есть ли фундаментальная причина, по которой от подхода webpack отказались? Или это просто разные архитектурные решения с разными компромиссами? И можно ли вообще совместить лучшее из обоих — tree shaking на уровне графа без shared chunks с мёртвым кодом?

Если вы работаете над бандлерами или глубоко копали эту тему — буду рад услышать ваше мнение в комментариях. Возможно, ответ давно есть, а я просто не нашёл.

Репозиторий с лабораторной: [github.com/lykianovsky/tree-shaking-barrel-test](https://github.com/lykianovsky/tree-shaking-barrel-test)

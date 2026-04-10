const {execSync} = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT_DIRECTORY = __dirname
const COMMAND_TIMEOUT = 120_000
const MARKERS_PER_ENTRY = 2
const BAR_SCALE_DIVISOR = 100
const SEPARATOR_LENGTH = 70

const TREE_SHAKING_MARKERS = [
  'value_a',
  'value_b',
  'value_c',
  'config_a',
  'config_b',
  'config_c',
]

const SINGLE_FILE_ORIGIN_MARKER = 'single_file'
const SEPARATE_FILE_ORIGIN_MARKER = 'separate_file'

const EVariant = {
  SINGLE: 'single',
  SEPARATE: 'separate',
}

const VARIANT_LABELS = {
  [EVariant.SINGLE]: 'ОДИН ФАЙЛ',
  [EVariant.SEPARATE]: 'ОТДЕЛЬНЫЕ ФАЙЛЫ (barrel)',
}

const EFileType = {
  SHARED: 'shared',
  ENTRY: 'entry',
  RUNTIME: 'runtime',
}

function executeCommand(command, workingDirectory) {
  return execSync(command, {
    cwd: workingDirectory,
    stdio: 'pipe',
    timeout: COMMAND_TIMEOUT,
  }).toString()
}

function measureExecution(command, workingDirectory) {
  const startTime = performance.now()
  executeCommand(command, workingDirectory)
  return performance.now() - startTime
}

function findJavaScriptFiles(directory) {
  if (!fs.existsSync(directory)) {
    return []
  }

  return fs
    .readdirSync(directory, {recursive: true})
    .filter((fileName) => fileName.endsWith('.js'))
    .map((fileName) => path.join(directory, fileName))
}

function readFileContent(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function analyzeFile(filePath) {
  const content = readFileContent(filePath)
  const sizeInBytes = Buffer.byteLength(content)
  const foundMarkers = TREE_SHAKING_MARKERS.filter(
    (marker) => content.includes(marker),
  )

  return {
    name: path.basename(filePath),
    sizeInBytes,
    markers: foundMarkers,
    path: filePath,
    content,
  }
}

function analyzeDirectory(directory) {
  return findJavaScriptFiles(directory).map(analyzeFile)
}

function analyzeNextChunks(directory, originMarker) {
  return findJavaScriptFiles(directory)
    .map(analyzeFile)
    .filter((file) => {
      return file.markers.length > 0
        && file.content.includes(originMarker)
    })
}

function checkIsInlined(files) {
  const filesWithMarkers = files.filter(
    (file) => file.markers.length > 0,
  )

  if (filesWithMarkers.length === 0) {
    return false
  }

  return filesWithMarkers.every(
    (file) => file.markers.length <= MARKERS_PER_ENTRY,
  )
}

function classifyFiles(files) {
  const sharedFiles = files.filter((file) => {
    return file.name.includes('shared')
      || file.name.includes('chunk')
  })

  const entryFiles = files.filter((file) => {
    return !sharedFiles.includes(file)
      && file.markers.length > 0
  })

  const runtimeFiles = files.filter((file) => {
    return !sharedFiles.includes(file)
      && file.markers.length === 0
  })

  return {
    [EFileType.SHARED]: sharedFiles,
    [EFileType.ENTRY]: entryFiles,
    [EFileType.RUNTIME]: runtimeFiles,
  }
}

function calculateTotalSize(files) {
  return files.reduce(
    (accumulator, file) => accumulator + file.sizeInBytes,
    0,
  )
}

function buildBundlerPath(...segments) {
  return path.join(ROOT_DIRECTORY, ...segments)
}

function buildStandardAnalyzer(bundlerName, variant) {
  return () => analyzeDirectory(
    buildBundlerPath(bundlerName, 'dist', variant),
  )
}

const BUNDLER_CONFIGS = [
  {
    name: 'webpack',
    workingDirectory: buildBundlerPath('webpack'),
    installCommand: 'pnpm install',
    buildCommand: 'pnpm run build',
    analyzers: {
      [EVariant.SINGLE]:
        buildStandardAnalyzer('webpack', 'single'),
      [EVariant.SEPARATE]:
        buildStandardAnalyzer('webpack', 'separate'),
    },
  },
  {
    name: 'rspack',
    workingDirectory: buildBundlerPath('rspack'),
    installCommand: 'pnpm install',
    buildCommand: 'pnpm run build',
    analyzers: {
      [EVariant.SINGLE]:
        buildStandardAnalyzer('rspack', 'single'),
      [EVariant.SEPARATE]:
        buildStandardAnalyzer('rspack', 'separate'),
    },
  },
  {
    name: 'rollup',
    workingDirectory: buildBundlerPath('rollup'),
    installCommand: 'pnpm install',
    buildCommand: 'pnpm run build',
    analyzers: {
      [EVariant.SINGLE]:
        buildStandardAnalyzer('rollup', 'single'),
      [EVariant.SEPARATE]:
        buildStandardAnalyzer('rollup', 'separate'),
    },
  },
  {
    name: 'vite',
    workingDirectory: buildBundlerPath('vite'),
    installCommand: 'pnpm install',
    buildCommand: 'pnpm run build',
    analyzers: {
      [EVariant.SINGLE]:
        buildStandardAnalyzer('vite', 'single'),
      [EVariant.SEPARATE]:
        buildStandardAnalyzer('vite', 'separate'),
    },
  },
  {
    name: 'esbuild',
    workingDirectory: buildBundlerPath('esbuild'),
    installCommand: 'pnpm install',
    buildCommand: 'pnpm run build',
    analyzers: {
      [EVariant.SINGLE]:
        buildStandardAnalyzer('esbuild', 'single'),
      [EVariant.SEPARATE]:
        buildStandardAnalyzer('esbuild', 'separate'),
    },
  },
  {
    name: 'next-webpack',
    workingDirectory: buildBundlerPath('next-webpack'),
    installCommand: 'pnpm install',
    buildCommand: 'pnpm run build',
    analyzers: {
      [EVariant.SINGLE]: () => analyzeNextChunks(
        buildBundlerPath(
          'next-webpack', '.next', 'static', 'chunks',
        ),
        SINGLE_FILE_ORIGIN_MARKER,
      ),
      [EVariant.SEPARATE]: () => analyzeNextChunks(
        buildBundlerPath(
          'next-webpack', '.next', 'static', 'chunks',
        ),
        SEPARATE_FILE_ORIGIN_MARKER,
      ),
    },
  },
  {
    name: 'next-turbopack',
    workingDirectory: buildBundlerPath('next-turbopack'),
    installCommand: 'pnpm install',
    buildCommand: 'pnpm run build',
    analyzers: {
      [EVariant.SINGLE]: () => analyzeNextChunks(
        buildBundlerPath(
          'next-turbopack', '.next', 'static', 'chunks',
        ),
        SINGLE_FILE_ORIGIN_MARKER,
      ),
      [EVariant.SEPARATE]: () => analyzeNextChunks(
        buildBundlerPath(
          'next-turbopack', '.next', 'static', 'chunks',
        ),
        SEPARATE_FILE_ORIGIN_MARKER,
      ),
    },
  },
]

function formatSeconds(milliseconds, decimals = 2) {
  return (milliseconds / 1_000).toFixed(decimals) + 's'
}

function formatSize(bytes) {
  return `${bytes} б`
}

function formatInlineStatus(isInlined) {
  return isInlined ? '✅ ДА' : '❌ НЕТ'
}

function formatTable(headers, rows, {columnGap = 3} = {}) {
  const columnWidths = headers.map(
    (header, columnIndex) => {
      const cellWidths = rows.map(
        (row) => String(row[columnIndex]).length,
      )
      return Math.max(header.length, ...cellWidths)
    },
  )

  const gap = ' '.repeat(columnGap)

  const formatRow = (cells) => cells
    .map((cell, index) => {
      return String(cell).padEnd(columnWidths[index])
    })
    .join(gap)

  const separatorWidth = columnWidths.reduce(
    (sum, width) => sum + width + columnGap,
    -columnGap,
  )

  const lines = [
    formatRow(headers),
    '─'.repeat(separatorWidth),
    ...rows.map(formatRow),
  ]

  return lines.map((line) => `  ${line}`).join('\n')
}

function printSection(title, content) {
  const separator = '='.repeat(SEPARATOR_LENGTH)

  console.log()
  console.log(separator)
  console.log(`  ${title}`)
  console.log(separator)
  console.log()

  if (content) {
    console.log(content)
  }
}

function buildSpeedChart(buildTimesMap) {
  const sortedEntries = Object.entries(buildTimesMap)
    .sort(([, timeA], [, timeB]) => timeA - timeB)

  const rows = sortedEntries.map(
    ([name, milliseconds]) => {
      const barLength = Math.round(
        milliseconds / BAR_SCALE_DIVISOR,
      )
      return [
        name,
        formatSeconds(milliseconds),
        '█'.repeat(barLength),
      ]
    },
  )

  return formatTable(['Бандлер', 'Время', ''], rows)
}

function buildFileList(label, files) {
  const header = `  ${label}:`
  const rows = files.map((file) => {
    const markers = file.markers.join(', ')
    return `    ${file.name}  ${formatSize(file.sizeInBytes)}  [${markers}]`
  })

  return ['', header, ...rows].join('\n')
}

function buildBundlerCard(bundlerConfig, variant) {
  const files = bundlerConfig.analyzers[variant]()

  if (files.length === 0) {
    return `  ${bundlerConfig.name}: нет файлов`
  }

  const isInlined = checkIsInlined(files)
  const totalSizeInBytes = calculateTotalSize(files)
  const classified = classifyFiles(files)

  const lines = [
    `  ${bundlerConfig.name.toUpperCase()}`,
    `  Инлайн: ${formatInlineStatus(isInlined)}`,
    `  Суммарный размер: ${formatSize(totalSizeInBytes)} (${files.length} файлов)`,
  ]

  if (classified[EFileType.ENTRY].length > 0) {
    const hasDeadCode = classified[EFileType.ENTRY].some(
      (file) => file.markers.length > MARKERS_PER_ENTRY,
    )
    const entryLabel = hasDeadCode
      ? 'Entry chunks (мёртвый код внутри)'
      : 'Entry chunks'

    lines.push(
      buildFileList(
        entryLabel,
        classified[EFileType.ENTRY],
      ),
    )
  }

  if (classified[EFileType.SHARED].length > 0) {
    lines.push(
      buildFileList(
        'Shared chunks (мёртвый код)',
        classified[EFileType.SHARED],
      ),
    )
  }

  if (classified[EFileType.RUNTIME].length > 0) {
    const runtimeSize = calculateTotalSize(
      classified[EFileType.RUNTIME],
    )
    lines.push('')
    lines.push(
      `  Runtime/прочее: ${classified[EFileType.RUNTIME].length} файлов, ${formatSize(runtimeSize)}`,
    )
  }

  return lines.join('\n')
}

function buildSummaryTable(buildTimesMap) {
  const headers = [
    'Бандлер',
    'Время',
    'Single',
    'Инлайн',
    'Separate',
    'Инлайн',
  ]

  const rows = BUNDLER_CONFIGS.map((bundlerConfig) => {
    const singleFiles =
      bundlerConfig.analyzers[EVariant.SINGLE]()
    const separateFiles =
      bundlerConfig.analyzers[EVariant.SEPARATE]()

    return [
      bundlerConfig.name,
      formatSeconds(buildTimesMap[bundlerConfig.name]),
      formatSize(calculateTotalSize(singleFiles)),
      checkIsInlined(singleFiles) ? '✅' : '❌',
      formatSize(calculateTotalSize(separateFiles)),
      checkIsInlined(separateFiles) ? '✅' : '❌',
    ]
  })

  const table = formatTable(headers, rows)
  const legend = [
    '',
    '  Инлайн ✅ = каждая страница содержит только свои данные',
    '  Инлайн ❌ = лишние экспорты попадают в бандл',
  ].join('\n')

  return table + '\n' + legend
}

function runInstallPhase() {
  printSection('УСТАНОВКА ЗАВИСИМОСТЕЙ')

  for (const bundlerConfig of BUNDLER_CONFIGS) {
    const elapsedMilliseconds = measureExecution(
      bundlerConfig.installCommand,
      bundlerConfig.workingDirectory,
    )
    console.log(
      `  ${bundlerConfig.name} — ${formatSeconds(elapsedMilliseconds, 1)}`,
    )
  }
}

function runBuildPhase() {
  printSection('СБОРКА')

  const buildTimesMap = {}

  for (const bundlerConfig of BUNDLER_CONFIGS) {
    const elapsedMilliseconds = measureExecution(
      bundlerConfig.buildCommand,
      bundlerConfig.workingDirectory,
    )
    buildTimesMap[bundlerConfig.name] = elapsedMilliseconds
    console.log(
      `  ${bundlerConfig.name} — ${formatSeconds(elapsedMilliseconds)}`,
    )
  }

  return buildTimesMap
}

function runAnalysisPhase(buildTimesMap) {
  printSection(
    'СКОРОСТЬ СБОРКИ',
    buildSpeedChart(buildTimesMap),
  )

  for (const variant of [EVariant.SINGLE, EVariant.SEPARATE]) {
    printSection(
      `TREE SHAKING: ${VARIANT_LABELS[variant]}`,
    )

    for (const bundlerConfig of BUNDLER_CONFIGS) {
      console.log()
      console.log(buildBundlerCard(bundlerConfig, variant))
    }
  }

  printSection(
    'ИТОГОВАЯ ТАБЛИЦА',
    buildSummaryTable(buildTimesMap),
  )
}

function main() {
  runInstallPhase()
  const buildTimesMap = runBuildPhase()
  runAnalysisPhase(buildTimesMap)
}

main()

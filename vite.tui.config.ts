/**
 * Vite build config for the TUI (Terminal User Interface).
 *
 * Produces an ESM bundle at dist-tui/index.mjs because ink v5 is ESM-only.
 * Run with `node dist-tui/index.mjs`.
 */

import { resolve } from 'path'
import { defineConfig } from 'vite'

import type { Plugin } from 'vite'

// Node.js built-in modules that should be externalized
const nodeBuiltins = new Set([
  'fs', 'path', 'os', 'events', 'stream', 'util', 'net', 'tls',
  'http', 'https', 'crypto', 'zlib', 'url', 'querystring',
  'child_process', 'buffer', 'dns', 'dgram', 'assert', 'constants',
  'readline', 'string_decoder', 'timers', 'tty', 'worker_threads'
])

// Packages that must be externalized because they break when bundled
const externalPackages = [
  'ink', 'ink-select-input', 'ink-text-input', 'ink-spinner',
  'react', 'react-dom', 'react-devtools-core',
  'yoga-wasm-web', 'ssh2',
]

// Stub native .node addons (ssh2/cpu-features have JS fallbacks)
function nativeModuleStub(): Plugin {
  const STUB_ID = '\0native-stub'
  return {
    name: 'native-module-stub',
    resolveId(source) {
      if (source.endsWith('.node')) return STUB_ID
      return null
    },
    load(id) {
      if (id === STUB_ID) return 'export default {}'
      return null
    }
  }
}

// Stub out Electron imports with empty modules
const electronModules = new Set(['electron', 'electron-updater'])

function electronStub(): Plugin {
  const ELECTRON_STUB_ID = '\0electron-stub'
  const electronStubCode = `
const noop = () => {};
const noopClass = class {};
const handler = { get: () => noop };
const proxyObj = new Proxy({}, handler);
export const app = proxyObj;
export const BrowserWindow = noopClass;
export const ipcMain = { handle: noop, on: noop, removeHandler: noop };
export const shell = { openPath: noop, openExternal: noop };
export const dialog = { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) };
export const Notification = class { show() {} };
export default proxyObj;
`
  return {
    name: 'electron-stub',
    enforce: 'pre',
    resolveId(source) {
      if (electronModules.has(source)) return ELECTRON_STUB_ID
      return null
    },
    load(id) {
      if (id === ELECTRON_STUB_ID) return electronStubCode
      return null
    }
  }
}

export default defineConfig({
  plugins: [nativeModuleStub(), electronStub()],
  resolve: {
    alias: {
      '@main': resolve(__dirname, 'src/main'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@renderer': resolve(__dirname, 'src/renderer'),
      '@tui': resolve(__dirname, 'src/tui'),
    }
  },
  ssr: {
    noExternal: true
  },
  build: {
    outDir: 'dist-tui',
    target: 'node20',
    ssr: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/tui/index.tsx')
      },
      output: {
        format: 'esm',
        entryFileNames: '[name].mjs',
        banner: `import { fileURLToPath as __vite_fileURLToPath } from 'url';
import { dirname as __vite_dirname } from 'path';
const __filename = __vite_fileURLToPath(import.meta.url);
const __dirname = __vite_dirname(__filename);`,
      },
      external: (id) => {
        if (id.startsWith('node:')) return true
        if (nodeBuiltins.has(id)) return true
        if (externalPackages.some(pkg => id === pkg || id.startsWith(pkg + '/'))) return true
        return false
      }
    },
    minify: false,
    sourcemap: true
  }
})

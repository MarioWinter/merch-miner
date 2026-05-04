/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { readFileSync } from 'fs'

// Read version from package.json — kept in sync by release-please.
const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'),
) as { version: string }
const buildDate = new Date().toISOString()

// Read CHANGELOG.md content for in-app rendering. Source-of-truth lives at
// repo root, but it must be reachable from three different runtimes:
//   1. Local host (`npm run dev` outside Docker) — `../CHANGELOG.md`
//   2. Production image build (docker context = frontend-ui/, CI pre-copies)
//      — `./CHANGELOG.md`
//   3. Dev container (compose mounts repo-root file at `/changelog.md`
//      OUTSIDE /app to avoid bind-mount nesting on macOS virtiofs)
//      — `/changelog.md`
const changelogCandidates = [
  path.resolve(__dirname, '..', 'CHANGELOG.md'),
  path.resolve(__dirname, 'CHANGELOG.md'),
  '/changelog.md',
]
let changelogMd = '# Changelog\n\nNo entries available in this build.\n'
for (const candidate of changelogCandidates) {
  try {
    changelogMd = readFileSync(candidate, 'utf-8')
    break
  } catch {
    // try next
  }
}

// https://vite.dev/config/
export default defineConfig({
  envDir: path.resolve(__dirname, '..'),
  plugins: [react()],
  // Version + build timestamp inlined at build time — readable in app via
  // `import.meta.env.APP_VERSION` and `import.meta.env.BUILD_DATE`.
  // Vite's `define` requires JSON.stringify so the literal becomes a string.
  define: {
    'import.meta.env.APP_VERSION': JSON.stringify(pkg.version),
    'import.meta.env.BUILD_DATE': JSON.stringify(buildDate),
    'import.meta.env.CHANGELOG': JSON.stringify(changelogMd),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    hmr: { clientPort: 5173 },
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:8000',
        changeOrigin: false,
      },
      '/admin': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:8000',
        changeOrigin: false,
      },
      '/media': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:8000',
        changeOrigin: false,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    globals: true,
  },
})

// Lets Node load the same extensionless relative imports Next/webpack resolve.
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const EXTS = ['.js', '.jsx', '.mjs', '.json']

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    const parent = context.parentURL ? fileURLToPath(context.parentURL) : process.cwd()
    const base = specifier.startsWith('/') ? specifier : join(dirname(parent), specifier)
    if (!/\.(js|jsx|mjs|cjs|json)$/.test(base)) {
      for (const ext of EXTS) {
        if (existsSync(base + ext)) {
          return { url: pathToFileURL(base + ext).href, shortCircuit: true }
        }
        if (existsSync(join(base, 'index' + ext))) {
          return { url: pathToFileURL(join(base, 'index' + ext)).href, shortCircuit: true }
        }
      }
    }
  }
  return nextResolve(specifier, context)
}

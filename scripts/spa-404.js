// Create SPA fallback for GitHub Pages by copying index.html to 404.html
import { copyFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const dist = join(process.cwd(), 'dist')
const index = join(dist, 'index.html')
const fallback = join(dist, '404.html')

if (!existsSync(index)) {
  console.error('[spa-404] dist/index.html not found, did you run build?')
  process.exit(1)
}

try {
  copyFileSync(index, fallback)
  console.log('[spa-404] Created dist/404.html for GitHub Pages SPA routing')
} catch (e) {
  console.error('[spa-404] Failed to create 404.html', e)
  process.exit(1)
}

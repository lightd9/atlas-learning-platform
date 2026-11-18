import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import nextEnv from '@next/env'

// Use the same production env-file precedence as Next.js build/runtime.
nextEnv.loadEnvConfig(process.cwd(), false)
// Neon supplies a direct URL for migration DDL; runtime continues to use the
// pooled DATABASE_URL. For local PostgreSQL, set both URLs to the same value.
if (process.env.DATABASE_URL_UNPOOLED) process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED
const require = createRequire(import.meta.url)
const prismaCli = require.resolve('prisma/build/index.js')

const maxAttempts = 4
const waitMs = (attempt) => 5000 * attempt

function runMigration() {
  return new Promise((resolve) => {
    // Launch the CLI with Node directly; Windows cannot spawn a .cmd file
    // with shell:false, and enabling a shell is unnecessary here.
    const child = spawn(process.execPath, [prismaCli, 'migrate', 'deploy'], { stdio: 'inherit', shell: false })
    child.on('close', (code) => resolve(code ?? 1))
    child.on('error', () => resolve(1))
  })
}

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const code = await runMigration()
  if (code === 0) process.exit(0)
  if (attempt < maxAttempts) {
    console.log(`Migration attempt ${attempt} failed. Retrying in ${waitMs(attempt) / 1000}s...`)
    await new Promise((resolve) => setTimeout(resolve, waitMs(attempt)))
  }
}

console.error(`Database migration failed after ${maxAttempts} attempts.`)
process.exit(1)

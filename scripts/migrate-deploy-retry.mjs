import { spawn } from 'node:child_process'

const maxAttempts = 4
const waitMs = (attempt) => 5000 * attempt

function runMigration() {
  return new Promise((resolve) => {
    const command = process.platform === 'win32' ? 'npx.cmd' : 'npx'
    const child = spawn(command, ['prisma', 'migrate', 'deploy'], { stdio: 'inherit', shell: false })
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

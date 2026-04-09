import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = process.cwd()
const SKILL_TS_PATH = join(ROOT, 'src', 'lib', 'skill.ts')

if (!existsSync(SKILL_TS_PATH)) {
  process.stderr.write(
    `Missing generated file at ${SKILL_TS_PATH}\n` +
      'Run: pnpm generate:skill\n',
  )
  process.exit(1)
}

const before = readFileSync(SKILL_TS_PATH, 'utf8')

// Run generator in dry-run mode to get what the file *should* look like
const result = spawnSync(
  process.execPath,
  ['--import', 'tsx/esm', join(ROOT, 'scripts', 'generate-skill.ts'), '--dry-run'],
  { stdio: 'pipe', encoding: 'utf8' },
)

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout)
  process.exit(result.status ?? 1)
}

const generated = result.stdout

if (before !== generated) {
  process.stderr.write(
    'skill.ts is out of sync with command metadata.\n' +
      'Run: pnpm generate:skill and commit the updated src/lib/skill.ts\n',
  )
  process.exit(1)
}

process.stdout.write('skill.ts is up to date.\n')

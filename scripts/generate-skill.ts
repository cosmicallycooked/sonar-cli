#!/usr/bin/env tsx
/**
 * Generates src/lib/skill.ts from Pastel/Zod command metadata.
 *
 * Usage:
 *   tsx scripts/generate-skill.ts           # Write to src/lib/skill.ts
 *   tsx scripts/generate-skill.ts --dry-run # Print generated content to stdout
 */
import { readdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import zod from 'zod'

const ROOT = process.cwd()
const COMMANDS_DIR = join(ROOT, 'src', 'commands')
const SKILL_TS_PATH = join(ROOT, 'src', 'lib', 'skill.ts')
const DRY_RUN = process.argv.includes('--dry-run')

// ── filesystem helpers ───────────────────────────────────────────────────────

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (entry.isFile() && full.endsWith('.tsx')) out.push(full)
  }
  return out.sort()
}

function fileToCommand(filePath: string): string {
  const rel = relative(COMMANDS_DIR, filePath).replace(/\\/g, '/')
  const withoutExt = rel.replace(/\.tsx$/, '')
  const parts = withoutExt.split('/')
  if (parts[parts.length - 1] === 'index') parts.pop()
  return ['sonar', ...parts].filter(Boolean).join(' ')
}

// ── Zod introspection ────────────────────────────────────────────────────────

interface OptionMeta {
  flag: string
  type: string
  optional: boolean
  defaultValue: unknown
  description: string
}

function unwrapZod(schema: zod.ZodTypeAny): {
  typeName: string
  optional: boolean
  defaultValue: unknown
} {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let s: any = schema
  let optional = false
  let defaultValue: unknown = undefined

  // Peel layers (ZodDefault must come before ZodOptional in Zod wrapping order)
  for (;;) {
    const tn: string = s._def.typeName
    if (tn === 'ZodDefault') {
      defaultValue = s._def.defaultValue()
      s = s._def.innerType
    } else if (tn === 'ZodOptional') {
      optional = true
      s = s._def.innerType
    } else {
      break
    }
  }

  return { typeName: s._def.typeName as string, optional, defaultValue }
}

function zodTypeName(typeName: string): string {
  const map: Record<string, string> = {
    ZodString: 'string',
    ZodNumber: 'number',
    ZodBoolean: 'boolean',
    ZodArray: 'array',
    ZodEnum: 'string',
  }
  return map[typeName] ?? typeName.replace(/^Zod/, '').toLowerCase()
}

function extractOptions(schema: zod.ZodTypeAny | undefined): OptionMeta[] {
  if (!schema) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = schema as any
  if (s._def?.typeName !== 'ZodObject') return []

  return Object.entries(s.shape as Record<string, zod.ZodTypeAny>).map(([name, fieldSchema]) => {
    const { typeName, optional, defaultValue } = unwrapZod(fieldSchema)
    return {
      flag: `--${name}`,
      type: zodTypeName(typeName),
      optional,
      defaultValue,
      description: (fieldSchema as zod.ZodTypeAny).description ?? '',
    }
  })
}

// ── command metadata collection ──────────────────────────────────────────────

interface CommandMeta {
  command: string
  options: OptionMeta[]
}

async function collectCommands(): Promise<CommandMeta[]> {
  const files = walk(COMMANDS_DIR)
  const result: CommandMeta[] = []

  for (const file of files) {
    const commandName = fileToCommand(file)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import(pathToFileURL(file).href)
    const options = extractOptions(mod.options as zod.ZodTypeAny | undefined)
    result.push({ command: commandName, options })
  }

  return result
}

// ── markdown generation ──────────────────────────────────────────────────────

function flagUsageLine(opt: OptionMeta): string {
  if (opt.type === 'boolean') {
    // Default-true booleans: show --no-flag; default-false: show --flag
    if (opt.defaultValue === true) return `sonar ... --no-${opt.flag.slice(2)}`
    return `sonar ... ${opt.flag}`
  }
  if (opt.type === 'number') return `sonar ... ${opt.flag} N`
  return `sonar ... ${opt.flag} <value>`
}

function renderCommandSection(meta: CommandMeta): string {
  const lines: string[] = [`## ${meta.command}`, '']

  if (meta.options.length === 0) {
    lines.push(`\`\`\`bash`, `${meta.command}`, `\`\`\``, '')
    return lines.join('\n')
  }

  lines.push('```bash')
  lines.push(meta.command)
  for (const opt of meta.options) {
    const suffix = opt.description ? `  # ${opt.description}` : ''
    if (opt.type === 'boolean') {
      if (opt.defaultValue === true) {
        lines.push(`${meta.command} --no-${opt.flag.slice(2)}${suffix}`)
      } else {
        lines.push(`${meta.command} ${opt.flag}${suffix}`)
      }
    } else if (opt.type === 'number') {
      lines.push(`${meta.command} ${opt.flag} N${suffix}`)
    } else {
      lines.push(`${meta.command} ${opt.flag} <value>${suffix}`)
    }
  }
  lines.push('```', '')

  return lines.join('\n')
}

function generateSkillMarkdown(commands: CommandMeta[]): string {
  const header = `---
name: sonar
description: Sonar CLI — view and triage your feed, manage topics, trigger refresh jobs, and manage local Sonar config/data.
homepage: https://sonar.sh
user-invocable: true
allowed-tools: Bash
argument-hint: [command and options]
metadata: {"openclaw":{"emoji":"📡","requires":{"bins":["sonar"]}}}
---

# Sonar CLI

All commands are invoked as: \`sonar <command> [subcommand] [flags]\`.

`

  const sections = commands.map(renderCommandSection).join('\n')

  const footer = `## Environment variables

| Variable | Purpose |
|---|---|
| \`SONAR_API_URL\` | Backend URL (defaults to production GraphQL endpoint) |
| \`SONAR_AI_VENDOR\` | Vendor override for AI-assisted operations (\`openai\` or \`anthropic\`) |
| \`SONAR_FEED_RENDER\` | Default feed renderer override |
| \`SONAR_FEED_WIDTH\` | Default card width override |
| \`OPENAI_API_KEY\` | Required when vendor is \`openai\` |
| \`ANTHROPIC_API_KEY\` | Required when vendor is \`anthropic\` |
`

  return header + sections + '\n' + footer
}

// ── skill.ts template ────────────────────────────────────────────────────────

function generateSkillTs(skillContent: string): string {
  // Escape backticks and ${} in the content for embedding in a template literal
  const escaped = skillContent
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${')

  return `// THIS FILE IS AUTO-GENERATED. Do not edit manually.
// Run: pnpm generate:skill
// See: scripts/generate-skill.ts
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'

const SKILL_CONTENT = \`${escaped}\`

const DEFAULT_INSTALL_PATH = join(homedir(), '.claude', 'skills', 'sonar', 'SKILL.md')

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

function safeWrite(target: string, content: string, force: boolean): void {
  if (existsSync(target) && !force) {
    const existing = readFileSync(target, 'utf8')
    if (existing === content) {
      process.stdout.write(\`SKILL.md is already up to date: \${target}\\n\`)
      process.exit(0)
    }
    // File exists and differs — user may have customized it
    process.stderr.write(
      \`SKILL.md has been modified: \${target}\\n\` +
      \`Use --force to overwrite, or manually merge.\\n\` +
      \`New version hash: \${sha256(content).slice(0, 8)}\\n\`
    )
    process.exit(1)
  }
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content, 'utf8')
  process.stdout.write(\`SKILL.md written to \${target}\\n\`)
}

export function writeSkillTo(dest?: string, install?: boolean, force?: boolean): void {
  if (install || dest === '--install') {
    safeWrite(DEFAULT_INSTALL_PATH, SKILL_CONTENT, force ?? false)
    process.exit(0)
  }

  if (dest) {
    safeWrite(dest, SKILL_CONTENT, force ?? false)
    process.exit(0)
  }

  // Default: print to stdout
  process.stdout.write(SKILL_CONTENT)
  process.exit(0)
}
`
}

// ── main ─────────────────────────────────────────────────────────────────────

const commands = await collectCommands()
const skillMarkdown = generateSkillMarkdown(commands)
const skillTs = generateSkillTs(skillMarkdown)

if (DRY_RUN) {
  process.stdout.write(skillTs)
} else {
  writeFileSync(SKILL_TS_PATH, skillTs, 'utf8')
  process.stdout.write(`Generated: ${SKILL_TS_PATH}\n`)
  process.stdout.write(`Commands: ${commands.length}\n`)
}

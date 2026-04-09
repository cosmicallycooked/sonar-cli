// THIS FILE IS AUTO-GENERATED. Do not edit manually.
// Run: pnpm generate:skill
// See: scripts/generate-skill.ts
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'

const SKILL_CONTENT = `---
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

## sonar account add

\`\`\`bash
sonar account add
sonar account add --alias <value>  # Account alias (default: random)
sonar account add --api-url <value>  # Custom API URL
\`\`\`

## sonar account

\`\`\`bash
sonar account
sonar account --json  # Raw JSON output
\`\`\`

## sonar account remove

\`\`\`bash
sonar account remove
sonar account remove --force  # Remove even if active
\`\`\`

## sonar account rename

\`\`\`bash
sonar account rename
\`\`\`

## sonar account switch

\`\`\`bash
sonar account switch
\`\`\`

## sonar archive

\`\`\`bash
sonar archive
sonar archive --id <value>  # Suggestion ID to archive
\`\`\`

## sonar config env

\`\`\`bash
sonar config env
\`\`\`

## sonar config

\`\`\`bash
sonar config
\`\`\`

## sonar config nuke

\`\`\`bash
sonar config nuke
sonar config nuke --confirm  # Pass to confirm deletion
\`\`\`

## sonar config set

\`\`\`bash
sonar config set
sonar config set --key <value>  # Config key: vendor, feed-render, feed-width
sonar config set --value <value>  # Value to set
\`\`\`

## sonar config setup

\`\`\`bash
sonar config setup
sonar config setup --key <value>  # API key to use
\`\`\`

## sonar config skill

\`\`\`bash
sonar config skill
sonar config skill --install  # Install to ~/.claude/skills/sonar/SKILL.md
sonar config skill --dest <value>  # Write to a custom path
sonar config skill --force  # Overwrite even if file was modified
\`\`\`

## sonar data backup

\`\`\`bash
sonar data backup
sonar data backup --out <value>  # Backup output path (default: ~/.sonar/data-backup-<timestamp>.db)
sonar data backup --json  # Raw JSON output
\`\`\`

## sonar data path

\`\`\`bash
sonar data path
\`\`\`

## sonar data pull

\`\`\`bash
sonar data pull
\`\`\`

## sonar data restore

\`\`\`bash
sonar data restore
sonar data restore --from <value>  # Backup database path to restore from
sonar data restore --to <value>  # Target database path (default: local sonar DB path)
sonar data restore --json  # Raw JSON output
\`\`\`

## sonar data sql

\`\`\`bash
sonar data sql
\`\`\`

## sonar data verify

\`\`\`bash
sonar data verify
sonar data verify --path <value>  # Database path (default: local sonar DB path)
sonar data verify --json  # Raw JSON output
\`\`\`

## sonar feed

\`\`\`bash
sonar feed
sonar feed --hours N  # Look back N hours (default: 12)
sonar feed --days N  # Look back N days
sonar feed --limit N  # Result limit (default: 20)
sonar feed --offset N  # Skip first N results (default: 0)
sonar feed --kind <value>  # Feed source: default|bookmarks|followers|following
sonar feed --render <value>  # Output layout: card|table
sonar feed --width N  # Card width in columns
sonar feed --json  # Raw JSON output
sonar feed --follow  # Continuously poll for new items
sonar feed --interval N  # Poll interval in seconds (default: 30)
\`\`\`

## sonar

\`\`\`bash
sonar
sonar --hours N  # Look back N hours (default: 12)
sonar --days N  # Look back N days
sonar --limit N  # Result limit (default: 20)
sonar --kind <value>  # Feed source: default|bookmarks|followers|following
sonar --render <value>  # Output layout: card|table
sonar --width N  # Card width in columns
sonar --json  # Raw JSON output
sonar --no-interactive  # Interactive session mode (default: on, use --no-interactive to disable)
sonar --vendor <value>  # AI vendor: openai|anthropic
\`\`\`

## sonar later

\`\`\`bash
sonar later
sonar later --id <value>  # Suggestion ID to save for later
\`\`\`

## sonar refresh

\`\`\`bash
sonar refresh
sonar refresh --bookmarks  # Sync bookmarks from X
sonar refresh --likes  # Sync likes from X
sonar refresh --graph  # Rebuild social graph
sonar refresh --tweets  # Index tweets across network
sonar refresh --suggestions  # Regenerate suggestions
\`\`\`

## sonar skip

\`\`\`bash
sonar skip
sonar skip --id <value>  # Suggestion ID to skip
\`\`\`

## sonar status

\`\`\`bash
sonar status
sonar status --watch  # Poll and refresh every 2 seconds
sonar status --json  # Raw JSON output
\`\`\`

## sonar topics add

\`\`\`bash
sonar topics add
sonar topics add --description <value>  # Optional description (auto-generated if omitted)
sonar topics add --json  # Raw JSON output
\`\`\`

## sonar topics delete

\`\`\`bash
sonar topics delete
sonar topics delete --json  # Raw JSON output
\`\`\`

## sonar topics edit

\`\`\`bash
sonar topics edit
sonar topics edit --name <value>  # New name
sonar topics edit --description <value>  # New description
sonar topics edit --json  # Raw JSON output
\`\`\`

## sonar topics

\`\`\`bash
sonar topics
sonar topics --json  # Raw JSON output
\`\`\`

## sonar topics suggest

\`\`\`bash
sonar topics suggest
sonar topics suggest --vendor <value>  # AI vendor: openai|anthropic
sonar topics suggest --count N  # Number of suggestions (default: 5)
sonar topics suggest --json  # Raw JSON output
\`\`\`

## sonar topics view

\`\`\`bash
sonar topics view
\`\`\`

## Environment variables

| Variable | Purpose |
|---|---|
| \`SONAR_API_URL\` | Backend URL (defaults to production GraphQL endpoint) |
| \`SONAR_AI_VENDOR\` | Vendor override for AI-assisted operations (\`openai\` or \`anthropic\`) |
| \`SONAR_FEED_RENDER\` | Default feed renderer override |
| \`SONAR_FEED_WIDTH\` | Default card width override |
| \`OPENAI_API_KEY\` | Required when vendor is \`openai\` |
| \`ANTHROPIC_API_KEY\` | Required when vendor is \`anthropic\` |
`

const DEFAULT_INSTALL_PATH = join(homedir(), '.claude', 'skills', 'sonar', 'SKILL.md')

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

function safeWrite(target: string, content: string, force: boolean): void {
  if (existsSync(target) && !force) {
    const existing = readFileSync(target, 'utf8')
    if (existing === content) {
      process.stdout.write(`SKILL.md is already up to date: ${target}\n`)
      process.exit(0)
    }
    // File exists and differs — user may have customized it
    process.stderr.write(
      `SKILL.md has been modified: ${target}\n` +
      `Use --force to overwrite, or manually merge.\n` +
      `New version hash: ${sha256(content).slice(0, 8)}\n`
    )
    process.exit(1)
  }
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content, 'utf8')
  process.stdout.write(`SKILL.md written to ${target}\n`)
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

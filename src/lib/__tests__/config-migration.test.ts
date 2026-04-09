import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { migrateConfig, readAccountsConfig } from '../config.js'
import type { AccountsConfig } from '../config.js'

function makeTmpDir(): string {
  const dir = join(tmpdir(), `sonar-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('migrateConfig', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = makeTmpDir()
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('migrates legacy config.json to accounts.json', () => {
    const legacy = {
      token: 'tok_abc123',
      apiUrl: 'https://custom.api/graphql',
      vendor: 'anthropic',
    }
    writeFileSync(join(tmpDir, 'config.json'), JSON.stringify(legacy))

    const result = migrateConfig({ configDir: tmpDir })
    expect(result).toBe(true)

    const accounts = JSON.parse(
      readFileSync(join(tmpDir, 'accounts.json'), 'utf8'),
    ) as AccountsConfig

    expect(accounts.activeAccount).toBe('default')
    expect(accounts.accounts).toHaveLength(1)
    expect(accounts.accounts[0]).toEqual({
      name: 'default',
      token: 'tok_abc123',
      apiUrl: 'https://custom.api/graphql',
      vendor: 'anthropic',
    })
  })

  it('uses default apiUrl when not specified in legacy config', () => {
    writeFileSync(
      join(tmpDir, 'config.json'),
      JSON.stringify({ token: 'tok_xyz' }),
    )

    migrateConfig({ configDir: tmpDir })

    const accounts = JSON.parse(
      readFileSync(join(tmpDir, 'accounts.json'), 'utf8'),
    ) as AccountsConfig

    expect(accounts.accounts[0].apiUrl).toBe('https://api.sonar.8640p.info/graphql')
  })

  it('omits vendor field when not set in legacy config', () => {
    writeFileSync(
      join(tmpDir, 'config.json'),
      JSON.stringify({ token: 'tok_123', apiUrl: 'https://api.test/graphql' }),
    )

    migrateConfig({ configDir: tmpDir })

    const accounts = JSON.parse(
      readFileSync(join(tmpDir, 'accounts.json'), 'utf8'),
    ) as AccountsConfig

    expect(accounts.accounts[0]).not.toHaveProperty('vendor')
  })

  it('returns false if accounts.json already exists (no double migration)', () => {
    writeFileSync(join(tmpDir, 'config.json'), JSON.stringify({ token: 'tok' }))
    writeFileSync(join(tmpDir, 'accounts.json'), JSON.stringify({ activeAccount: 'x', accounts: [] }))

    expect(migrateConfig({ configDir: tmpDir })).toBe(false)
  })

  it('returns false if no legacy config.json exists', () => {
    expect(migrateConfig({ configDir: tmpDir })).toBe(false)
  })

  it('returns false if legacy config has no token', () => {
    writeFileSync(
      join(tmpDir, 'config.json'),
      JSON.stringify({ apiUrl: 'https://api.test/graphql' }),
    )

    expect(migrateConfig({ configDir: tmpDir })).toBe(false)
    expect(existsSync(join(tmpDir, 'accounts.json'))).toBe(false)
  })

  it('returns false if config.json is invalid JSON', () => {
    writeFileSync(join(tmpDir, 'config.json'), 'not json{{{')

    expect(migrateConfig({ configDir: tmpDir })).toBe(false)
  })
})

describe('readAccountsConfig', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = makeTmpDir()
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('reads a valid accounts.json', () => {
    const data: AccountsConfig = {
      activeAccount: 'work',
      accounts: [
        { name: 'work', token: 'tok_w', apiUrl: 'https://work.api/graphql' },
        { name: 'personal', token: 'tok_p', apiUrl: 'https://personal.api/graphql', vendor: 'openai' },
      ],
    }
    writeFileSync(join(tmpDir, 'accounts.json'), JSON.stringify(data))

    const result = readAccountsConfig({ configDir: tmpDir })
    expect(result).toEqual(data)
  })

  it('returns null if accounts.json does not exist', () => {
    expect(readAccountsConfig({ configDir: tmpDir })).toBeNull()
  })

  it('returns null if accounts.json is invalid JSON', () => {
    writeFileSync(join(tmpDir, 'accounts.json'), '{{invalid')
    expect(readAccountsConfig({ configDir: tmpDir })).toBeNull()
  })
})

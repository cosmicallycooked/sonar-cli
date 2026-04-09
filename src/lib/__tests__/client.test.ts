import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  gql,
  isTransientError,
  computeBackoff,
  HttpError,
  GraphQLError,
  type RetryOptions,
} from '../client.js'

// Stub config so gql() doesn't read real files
vi.mock('../config.js', () => ({
  getToken: () => 'test-token',
  getApiUrl: () => 'https://api.test/graphql',
}))

// ─── isTransientError ──────────────────────────────────────────

describe('isTransientError', () => {
  it('returns true for TypeError (network failure)', () => {
    expect(isTransientError(new TypeError('fetch failed'))).toBe(true)
  })

  it('returns true for 5xx HttpError', () => {
    expect(isTransientError(new HttpError(500, 'Internal Server Error'))).toBe(true)
    expect(isTransientError(new HttpError(502, 'Bad Gateway'))).toBe(true)
    expect(isTransientError(new HttpError(503, 'Service Unavailable'))).toBe(true)
  })

  it('returns true for 429 HttpError', () => {
    expect(isTransientError(new HttpError(429, 'Too Many Requests'))).toBe(true)
  })

  it('returns false for 4xx HttpError (non-429)', () => {
    expect(isTransientError(new HttpError(400, 'Bad Request'))).toBe(false)
    expect(isTransientError(new HttpError(401, 'Unauthorized'))).toBe(false)
    expect(isTransientError(new HttpError(403, 'Forbidden'))).toBe(false)
    expect(isTransientError(new HttpError(404, 'Not Found'))).toBe(false)
  })

  it('returns false for GraphQLError', () => {
    expect(isTransientError(new GraphQLError('Field not found'))).toBe(false)
  })

  it('returns false for generic Error', () => {
    expect(isTransientError(new Error('random'))).toBe(false)
  })

  it('returns false for non-error values', () => {
    expect(isTransientError(null)).toBe(false)
    expect(isTransientError('string')).toBe(false)
  })
})

// ─── computeBackoff ────────────────────────────────────────────

describe('computeBackoff', () => {
  const opts: RetryOptions = {
    maxRetries: 3,
    baseDelayMs: 100,
    maxDelayMs: 5000,
  }

  it('increases exponentially with attempt number', () => {
    // Seed Math.random to get deterministic results
    vi.spyOn(Math, 'random').mockReturnValue(0.5) // jitter factor = 1.0

    const d0 = computeBackoff(0, opts) // 100 * 1 * 1.0 = 100
    const d1 = computeBackoff(1, opts) // 100 * 2 * 1.0 = 200
    const d2 = computeBackoff(2, opts) // 100 * 4 * 1.0 = 400

    expect(d0).toBe(100)
    expect(d1).toBe(200)
    expect(d2).toBe(400)

    vi.restoreAllMocks()
  })

  it('caps delay at maxDelayMs', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    // attempt 10: 100 * 1024 = 102400, capped to 5000
    const d = computeBackoff(10, opts)
    expect(d).toBe(5000)

    vi.restoreAllMocks()
  })

  it('applies jitter between 0.5x and 1.5x', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0) // jitter = 0.5
    expect(computeBackoff(0, opts)).toBe(50)

    vi.spyOn(Math, 'random').mockReturnValue(1) // jitter = 1.5
    expect(computeBackoff(0, opts)).toBe(150)

    vi.restoreAllMocks()
  })
})

// ─── gql retry behavior ───────────────────────────────────────

describe('gql', () => {
  const fastRetry: RetryOptions = {
    maxRetries: 2,
    baseDelayMs: 1,
    maxDelayMs: 10,
  }

  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  function jsonResponse(data: unknown, status = 200) {
    return new Response(JSON.stringify({ data }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  function errorResponse(status: number, statusText: string) {
    return new Response(JSON.stringify({ error: statusText }), {
      status,
      statusText,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  function graphqlErrorResponse(message: string) {
    return new Response(
      JSON.stringify({ errors: [{ message }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  it('returns data on success', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ me: { id: 1 } }))

    const result = await gql('query { me { id } }', {}, {}, fastRetry)
    expect(result).toEqual({ me: { id: 1 } })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('retries on 5xx and succeeds', async () => {
    fetchSpy
      .mockResolvedValueOnce(errorResponse(502, 'Bad Gateway'))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))

    const result = await gql('query { ok }', {}, {}, fastRetry)
    expect(result).toEqual({ ok: true })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('retries on network error (TypeError) and succeeds', async () => {
    fetchSpy
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))

    const result = await gql('query { ok }', {}, {}, fastRetry)
    expect(result).toEqual({ ok: true })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('does not retry on 4xx errors', async () => {
    fetchSpy.mockResolvedValueOnce(errorResponse(401, 'Unauthorized'))

    await expect(gql('query { me }', {}, {}, fastRetry)).rejects.toThrow(
      'HTTP 401: Unauthorized',
    )
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('does not retry on GraphQL errors', async () => {
    fetchSpy.mockResolvedValueOnce(graphqlErrorResponse('Field "foo" not found'))

    await expect(gql('query { foo }', {}, {}, fastRetry)).rejects.toThrow(
      'Field "foo" not found',
    )
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('throws after exhausting max retries', async () => {
    fetchSpy
      .mockResolvedValueOnce(errorResponse(500, 'Internal Server Error'))
      .mockResolvedValueOnce(errorResponse(500, 'Internal Server Error'))
      .mockResolvedValueOnce(errorResponse(500, 'Internal Server Error'))

    await expect(gql('query { fail }', {}, {}, fastRetry)).rejects.toThrow(
      'HTTP 500: Internal Server Error',
    )
    // 1 initial + 2 retries = 3 total
    expect(fetchSpy).toHaveBeenCalledTimes(3)
  })

  it('respects maxRetries = 0 (no retries)', async () => {
    fetchSpy.mockResolvedValueOnce(errorResponse(500, 'Internal Server Error'))

    await expect(
      gql('query { x }', {}, {}, { maxRetries: 0, baseDelayMs: 1, maxDelayMs: 10 }),
    ).rejects.toThrow('HTTP 500')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})

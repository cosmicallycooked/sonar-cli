import { getApiUrl, getToken } from './config.js'

interface Flags {
  debug?: boolean
}

export interface RetryOptions {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
}

const DEFAULT_RETRY: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 10_000,
}

/**
 * Returns true for errors that are transient and worth retrying:
 * network failures, 5xx server errors, 429 rate limits.
 */
export function isTransientError(error: unknown): boolean {
  if (error instanceof TypeError) return true // fetch network errors
  if (error instanceof HttpError) {
    return error.status >= 500 || error.status === 429
  }
  return false
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
  ) {
    super(`HTTP ${status}: ${statusText}`)
    this.name = 'HttpError'
  }
}

export class GraphQLError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GraphQLError'
  }
}

/**
 * Compute delay with exponential backoff and jitter.
 * delay = min(baseDelay * 2^attempt, maxDelay) * random(0.5, 1.5)
 */
export function computeBackoff(
  attempt: number,
  opts: RetryOptions,
): number {
  const exponential = opts.baseDelayMs * 2 ** attempt
  const capped = Math.min(exponential, opts.maxDelayMs)
  const jitter = 0.5 + Math.random()
  return capped * jitter
}

export async function gql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  flags: Flags = {},
  retryOpts: RetryOptions = DEFAULT_RETRY,
): Promise<T> {
  const token = getToken()
  const url = getApiUrl()

  let lastError: unknown

  for (let attempt = 0; attempt <= retryOpts.maxRetries; attempt++) {
    try {
      if (flags.debug) {
        console.error(url, query, variables)
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query, variables }),
      })

      if (!res.ok) {
        if (flags.debug) {
          console.error(JSON.stringify(await res.json(), null, 2))
        }
        throw new HttpError(res.status, res.statusText)
      }

      const json = (await res.json()) as {
        data?: T
        errors?: Array<{ message: string }>
      }

      if (json.errors && json.errors.length > 0) {
        throw new GraphQLError(json.errors[0].message)
      }

      return json.data as T
    } catch (err) {
      lastError = err

      // Only retry transient errors, and only if we have attempts left
      if (!isTransientError(err) || attempt >= retryOpts.maxRetries) {
        throw err
      }

      const delay = computeBackoff(attempt, retryOpts)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  // Unreachable, but satisfies TypeScript
  throw lastError
}

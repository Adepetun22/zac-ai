import net from 'node:net'
import {
  redisAcquireConcurrency,
  redisRateLimit,
  redisReleaseConcurrency,
} from './redis.js'

const DEFAULT_IMAGE_HOSTS = [
  'image.pollinations.ai',
  'cdn.pollinations.ai',
  'cdn-lfs.huggingface.co',
  'cdn-lfs-us-1.hf.co',
  '*.supabase.co',
  '*.supabase.in',
]

function parseAllowedHosts() {
  const configured = (process.env.IMAGE_PROXY_ALLOWED_HOSTS || '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean)

  return configured.length > 0 ? configured : DEFAULT_IMAGE_HOSTS
}

function hostMatches(hostname, pattern) {
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1)
    return hostname.endsWith(suffix)
  }
  return hostname === pattern
}

export function isAllowedProxyUrl(rawUrl) {
  let url

  try {
    url = new URL(rawUrl)
  } catch {
    return false
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
  if (!url.hostname) return false

  const hostname = url.hostname.toLowerCase()

  // Never allow a literal private/loopback address. DNS rebinding is handled
  // by the host allowlist below, which is intentionally restrictive.
  if (net.isIP(hostname)) return false

  return parseAllowedHosts().some((pattern) => hostMatches(hostname, pattern))
}

export async function fetchAllowedImage(url, { signal, redirects = 3 } = {}) {
  let current = url

  for (let i = 0; i <= redirects; i += 1) {
    if (!isAllowedProxyUrl(current)) {
      const error = new Error('URL is not on the image proxy allowlist')
      error.statusCode = 400
      error.code = 'URL_NOT_ALLOWED'
      throw error
    }

    const response = await fetch(current, {
      signal,
      redirect: 'manual',
      headers: { 'User-Agent': 'Zac-AI-Image-Proxy/1.0' },
    })

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return response
    }

    const location = response.headers.get('location')

    if (!location) {
      const error = new Error('Image proxy redirect missing location')
      error.statusCode = 502
      error.code = 'UPSTREAM_REDIRECT_INVALID'
      throw error
    }

    current = new URL(location, current).toString()
  }

  const error = new Error('Too many redirects')
  error.statusCode = 502
  error.code = 'UPSTREAM_REDIRECT_LIMIT'
  throw error
}

let warnedRedisRateLimit = false
let warnedRedisConcurrency = false

export function createRateLimiter({
  name = 'rl',
  windowMs,
  max,
  keyGenerator = (req) => req.ip || req.socket?.remoteAddress || 'unknown',
}) {
  const hits = new Map()

  const prune = (now) => {
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key)
    }
  }

  return async function rateLimit(req, res, next) {
    const key = `${name}:${keyGenerator(req)}`
    const now = Date.now()

    try {
      const shared = await redisRateLimit({ name, key, windowMs, max })
      if (shared) {
        res.setHeader('RateLimit-Limit', String(max))
        res.setHeader('RateLimit-Remaining', String(shared.remaining))
        res.setHeader('RateLimit-Reset', String(shared.resetAt))

        if (!shared.allowed) {
          const retryAfter = Math.max(1, shared.resetAt - Math.ceil(now / 1000))
          res.setHeader('Retry-After', String(retryAfter))
          return res.status(429).json({
            error: 'Too many requests',
            code: 'RATE_LIMITED',
            retriable: true,
          })
        }

        return next()
      }
    } catch (error) {
      // Redis down or misconfigured: fall through to the per-instance limiter.
      if (!warnedRedisRateLimit) {
        warnedRedisRateLimit = true
        console.warn('[WARN] Shared rate limit failed, using local limiter:', error.message)
      }
    }

    // Avoid unbounded growth without needing a timer per limiter.
    if (hits.size > 10_000) prune(now)

    const existing = hits.get(key)

    if (!existing || existing.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs })
      res.setHeader('RateLimit-Limit', String(max))
      res.setHeader('RateLimit-Remaining', String(max - 1))
      res.setHeader('RateLimit-Reset', String(Math.ceil((now + windowMs) / 1000)))
      return next()
    }

    existing.count += 1
    const remaining = Math.max(0, max - existing.count)

    res.setHeader('RateLimit-Limit', String(max))
    res.setHeader('RateLimit-Remaining', String(remaining))
    res.setHeader('RateLimit-Reset', String(Math.ceil(existing.resetAt / 1000)))

    if (existing.count > max) {
      const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
      res.setHeader('Retry-After', String(retryAfter))
      return res.status(429).json({
        error: 'Too many requests',
        code: 'RATE_LIMITED',
        retriable: true,
      })
    }

    return next()
  }
}

export function createConcurrencyLimiter({
  name = 'ai',
  globalMax,
  perUserMax,
  keyGenerator = (req) => req.user?.id || req.ip || 'unknown',
}) {
  let active = 0
  const perKey = new Map()

  const releaseLocal = (key) => {
    active = Math.max(0, active - 1)

    const count = perKey.get(key) || 1
    if (count <= 1) perKey.delete(key)
    else perKey.set(key, count - 1)
  }

  return {
    async acquire(req) {
      const key = keyGenerator(req)

      try {
        const shared = await redisAcquireConcurrency({ name, key, globalMax, perUserMax })

        if (shared) {
          if (!shared.allowed) {
            const error = new Error(shared.code === 'AI_CAPACITY'
              ? 'AI service is at capacity'
              : 'Too many concurrent AI requests for this user')
            error.statusCode = 429
            error.code = shared.code
            throw error
          }

          let released = false
          return async function release() {
            if (released) return
            released = true
            try {
              await redisReleaseConcurrency({ name, key })
            } catch (error) {
              if (!warnedRedisConcurrency) {
                warnedRedisConcurrency = true
                console.warn('[WARN] Shared concurrency release failed:', error.message)
              }
            }
          }
        }
      } catch (error) {
        if (error.statusCode === 429) throw error
        // Redis unavailable: fall through to the per-instance limiter.
        if (!warnedRedisConcurrency) {
          warnedRedisConcurrency = true
          console.warn('[WARN] Shared concurrency limit failed, using local limiter:', error.message)
        }
      }

      if (active >= globalMax) {
        const error = new Error('AI service is at capacity')
        error.statusCode = 429
        error.code = 'AI_CAPACITY'
        throw error
      }

      const current = perKey.get(key) || 0

      if (current >= perUserMax) {
        const error = new Error('Too many concurrent AI requests for this user')
        error.statusCode = 429
        error.code = 'AI_USER_CONCURRENCY'
        throw error
      }

      active += 1
      perKey.set(key, current + 1)

      let released = false

      return function release() {
        if (released) return
        released = true
        releaseLocal(key)
      }
    },
  }
}
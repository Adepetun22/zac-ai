import Redis from 'ioredis'

let redis = null
let warned = false

export function getRedis() {
  if (redis) return redis
  if (!process.env.REDIS_URL) return null

  try {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      keyPrefix: 'zac:',
    })

    redis.on('error', (error) => {
      if (warned) return
      warned = true
      console.warn('[WARN] Redis unavailable, falling back to per-instance limits:', error.message)
    })
  } catch (error) {
    console.warn('[WARN] Redis configuration failed:', error.message)
    return null
  }

  return redis
}

const RATE_LIMIT_SCRIPT = `
local now = redis.call('TIME')
local now_ms = tonumber(now[1]) * 1000 + math.floor(tonumber(now[2]) / 1000)
local window_ms = tonumber(ARGV[1])
local max = tonumber(ARGV[2])
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], window_ms)
end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], window_ms)
  ttl = window_ms
end
if count > max then
  return {0, 0, math.ceil((now_ms + ttl) / 1000)}
end
return {1, max - count, math.ceil((now_ms + ttl) / 1000)}
`

export async function redisRateLimit({ name, key, windowMs, max }) {
  const client = getRedis()
  if (!client) return null

  const result = await client.eval(
    RATE_LIMIT_SCRIPT,
    1,
    `rl:${name}:${key}`,
    String(windowMs),
    String(max),
  )

  return {
    allowed: Number(result[0]) === 1,
    remaining: Number(result[1]),
    resetAt: Number(result[2]),
  }
}

const ACQUIRE_SCRIPT = `
local global = tonumber(redis.call('GET', KEYS[1]) or '0')
if global >= tonumber(ARGV[1]) then
  return {0, 'AI_CAPACITY'}
end
local user = tonumber(redis.call('GET', KEYS[2]) or '0')
if user >= tonumber(ARGV[2]) then
  return {0, 'AI_USER_CONCURRENCY'}
end
redis.call('INCR', KEYS[1])
redis.call('INCR', KEYS[2])
redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[3]))
redis.call('PEXPIRE', KEYS[2], tonumber(ARGV[3]))
return {1, 'OK'}
`

const RELEASE_SCRIPT = `
local ttl = tonumber(ARGV[1])
local global = redis.call('DECR', KEYS[1])
if global < 0 then
  redis.call('SET', KEYS[1], 0, 'PX', ttl)
end
local user = redis.call('DECR', KEYS[2])
if user <= 0 then
  redis.call('DEL', KEYS[2])
else
  redis.call('PEXPIRE', KEYS[2], ttl)
end
return 1
`

export async function redisAcquireConcurrency({ name, key, globalMax, perUserMax, ttlMs = 600_000 }) {
  const client = getRedis()
  if (!client) return null

  const result = await client.eval(
    ACQUIRE_SCRIPT,
    2,
    `concurrency:${name}:global`,
    `concurrency:${name}:user:${key}`,
    String(globalMax),
    String(perUserMax),
    String(ttlMs),
  )

  return {
    allowed: Number(result[0]) === 1,
    code: result[1],
  }
}

export async function redisReleaseConcurrency({ name, key, ttlMs = 600_000 }) {
  const client = getRedis()
  if (!client) return

  await client.eval(
    RELEASE_SCRIPT,
    2,
    `concurrency:${name}:global`,
    `concurrency:${name}:user:${key}`,
    String(ttlMs),
  )
}

export async function shutdownRedis() {
  if (!redis) return
  try {
    await redis.quit()
  } catch {
    redis.disconnect()
  } finally {
    redis = null
  }
}
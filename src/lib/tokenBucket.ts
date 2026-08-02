import { redis } from "./redis";

/**
 * Redis-backed token bucket, atomic via a single Lua script (read-modify-write
 * with no round trip in between, so concurrent requests can't race the
 * refill/consume logic).
 *
 * capacity: max burst size (points)
 * refillSeconds: time to go from empty to full
 */
const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refillSeconds = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local bucket = redis.call("HMGET", key, "tokens", "updatedAt")
local tokens = tonumber(bucket[1])
local updatedAt = tonumber(bucket[2])

if tokens == nil then
  tokens = capacity
  updatedAt = now
end

local elapsed = math.max(0, now - updatedAt)
local refillRate = capacity / refillSeconds
tokens = math.min(capacity, tokens + elapsed * refillRate)

local allowed = 0
if tokens >= 1 then
  allowed = 1
  tokens = tokens - 1
end

redis.call("HMSET", key, "tokens", tokens, "updatedAt", now)
redis.call("EXPIRE", key, refillSeconds * 2)

local retryAfter = 0
if allowed == 0 then
  retryAfter = math.ceil((1 - tokens) / refillRate)
end

return { allowed, retryAfter }
`;

export interface TokenBucketResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export async function consumeToken(
  key: string,
  capacity: number,
  refillSeconds: number,
): Promise<TokenBucketResult> {
  const now = Date.now() / 1000;
  const [allowed, retryAfter] = (await redis.eval(
    TOKEN_BUCKET_SCRIPT,
    1,
    key,
    capacity,
    refillSeconds,
    now,
  )) as [number, number];

  return { allowed: allowed === 1, retryAfterSeconds: retryAfter };
}

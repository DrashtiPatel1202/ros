import Redis from "ioredis"

export const redis = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
  maxRetriesPerRequest: 1,
  enableReadyCheck: true,
  lazyConnect: true,
})

redis.on("error", (error: Error) => {
  console.error("redis", error.message)
})

export async function cacheGet(key: string): Promise<string | null> {
  try {
    return await redis.get(key)
  } catch {
    return null
  }
}

export async function cacheSet(key: string, value: string, seconds: number): Promise<void> {
  try {
    await redis.set(key, value, "EX", seconds)
  } catch {
    // A cache miss is safe. The database remains the source of truth.
  }
}

import { Redis } from "@upstash/redis"
import { logger } from "./logger"

let redisClient: Redis | null = null

export function getRedisClient() {
  if (!redisClient) {
    redisClient = new Redis({
      url: process.env.KV_REST_API_URL || "",
      token: process.env.KV_REST_API_TOKEN || "",
    })
  }

  return redisClient
}

export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    const client = getRedisClient()
    const data = await client.get(key)

    if (data) {
      return data as T
    }

    return null
  } catch (error) {
    logger.warn("[upstash] Redis cache get error:", error)
    return null
  }
}

export async function setCachedData(key: string, data: any, ttlSeconds = 3600): Promise<void> {
  try {
    const client = getRedisClient()
    await client.set(key, data, { ex: ttlSeconds })
  } catch (error) {
    logger.warn("[upstash] Redis cache set error:", error)
  }
}


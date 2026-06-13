import Redis from "ioredis";

let redis: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redis) {
    redis = new Redis({
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    redis.on("error", (err) => {
      console.error("Redis Client Error:", err);
    });

    redis.on("connect", () => {
      console.log("Redis Client Connected");
    });
  }

  return redis;
}

export async function closeRedisClient(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { wsManager } from "./liveMatch/wsManager";
import { spawn } from "child_process";
import { promisify } from "util";
import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";
import { startInactiveLogoutBatch } from "./inactiveLogoutBatch";
import { startMatchAutoCloseBatch } from "./matchAutoCloseBatch";
import { startSuspendedUserCleanupBatch } from "./suspendedUserCleanupBatch";
import { getRedisClient } from "./redis";
import { connectMongoDB } from "./UserStorage/db";
import { ensureSuperAdmin } from "./bootstrapSuperAdmin";
import { ensureOperatorsReady, syncOperatorMatchAssignments } from "./managerOperatorService";
import { startManagerDailyPasswordBatch } from "./managerDailyPasswordBatch";
import { startPostgresMongoSyncBatch } from "./postgresMongoSyncBatch";

const execAsync = promisify(exec);

// 서버 시간대를 한국(KST)으로 설정
process.env.TZ = 'Asia/Seoul';

async function startRedis() {
  try {
    const { stdout } = await execAsync("redis-cli ping");
    if (stdout.trim() === "PONG") {
      log("Redis is already running");
      return null;
    }
  } catch (error) {
    log("Redis is not running, starting it now...");
  }

  const redisDataDir = path.join(process.cwd(), ".redis-data");
  
  try {
    await fs.mkdir(redisDataDir, { recursive: true });
  } catch (error) {
    log(`Failed to create Redis data directory: ${error}`);
  }

  const redisProcess = spawn("redis-server", [
    "--daemonize", "no",
    "--dir", redisDataDir,
    "--dbfilename", "dump.rdb",
    "--port", "6379",
    "--bind", "0.0.0.0",
    "--protected-mode", "no",
    "--save", "60", "1",
    "--loglevel", "notice"
  ], {
    stdio: ["ignore", "pipe", "pipe"]
  });

  redisProcess.stdout?.on("data", (data) => {
    const message = data.toString().trim();
    if (message) {
      log(`[Redis] ${message}`);
    }
  });

  redisProcess.stderr?.on("data", (data) => {
    const message = data.toString().trim();
    if (message) {
      log(`[Redis Error] ${message}`);
    }
  });

  redisProcess.on("error", (error) => {
    log(`Failed to start Redis: ${error.message}`);
  });

  await new Promise<void>((resolve) => {
    const checkRedis = async () => {
      try {
        const { stdout } = await execAsync("redis-cli ping");
        if (stdout.trim() === "PONG") {
          log("Redis is ready!");
          resolve();
        } else {
          setTimeout(checkRedis, 100);
        }
      } catch (error) {
        setTimeout(checkRedis, 100);
      }
    };
    checkRedis();
  });

  return redisProcess;
}

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

app.use(cookieParser());

// CORS 설정 - 모바일 앱(Capacitor)을 위한 설정
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // 허용할 origin 목록
  const allowedOrigins = [
    'https://localhost', // Capacitor 모바일 앱 (Android)
    'capacitor://localhost', // Capacitor 모바일 앱 (iOS)
    'http://localhost:5000', // 개발 환경
    'https://ppamong.com', // 실제 도메인
    'https://www.ppamong.com', // www 서브도메인
  ];
  
  // origin이 허용 목록에 있으면 CORS 헤더 추가
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
  }
  
  // Preflight 요청 처리
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const redisProcess = await startRedis();

  await connectMongoDB();
  await ensureSuperAdmin();
  await ensureOperatorsReady();
  await syncOperatorMatchAssignments();

  process.on("SIGINT", () => {
    log("Shutting down gracefully...");
    wsManager.cleanup();
    if (redisProcess) {
      redisProcess.kill();
    }
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    log("Shutting down gracefully...");
    wsManager.cleanup();
    if (redisProcess) {
      redisProcess.kill();
    }
    process.exit(0);
  });

  await registerRoutes(app);
  const server = createServer(app);

  // WebSocket 서버 설정
  const wss = new WebSocketServer({ server, path: "/ws/match" });
  wsManager.initialize(wss);
  log("WebSocket server initialized at /ws/match");
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "서버 오류가 발생했습니다.";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    startInactiveLogoutBatch();
    startMatchAutoCloseBatch();
    startSuspendedUserCleanupBatch();
    startManagerDailyPasswordBatch();
    startPostgresMongoSyncBatch();
    
    (async () => {
      try {
        const redis = getRedisClient();
        let cursor = "0";
        let deletedCount = 0;
        do {
          const result = await redis.scan(cursor, "MATCH", "session:admin:*", "COUNT", 100);
          cursor = result[0];
          const keys = result[1];
          if (keys.length > 0) {
            await redis.del(...keys);
            deletedCount += keys.length;
          }
        } while (cursor !== "0");
        if (deletedCount > 0) {
          console.log(`[Startup] Cleared ${deletedCount} admin session(s)`);
        }
      } catch (e) {
        console.error("[Startup] Failed to clear admin sessions:", e);
      }
    })();
  });
})();

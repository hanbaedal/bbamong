import fs from "fs";
import type { Express, Request, Response } from "express";

const LOG_PATH = "/opt/cursor/logs/debug.log";

/** Debug-mode NDJSON logger (switch_half interstitial investigation). */
export function agentDebugLog(payload: {
  hypothesisId: string;
  location: string;
  message: string;
  data?: Record<string, unknown>;
}): void {
  try {
    fs.appendFileSync(
      LOG_PATH,
      JSON.stringify({
        ...payload,
        data: payload.data ?? {},
        timestamp: Date.now(),
        source: "server",
      }) + "\n",
    );
  } catch {
    /* ignore */
  }
}

export function registerAgentDebugLogRoute(app: Express): void {
  app.post("/api/_agent_debug_log", (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      fs.appendFileSync(
        LOG_PATH,
        JSON.stringify({
          hypothesisId: body.hypothesisId ?? "?",
          location: body.location ?? "client",
          message: body.message ?? "",
          data: body.data ?? {},
          timestamp: typeof body.timestamp === "number" ? body.timestamp : Date.now(),
          source: "client",
        }) + "\n",
      );
    } catch {
      /* ignore */
    }
    res.status(204).end();
  });
}

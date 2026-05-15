import { Hono } from "hono";
import { cors } from "hono/cors";
import { signRoute } from "./routes/sign.ts";
import { statsRoute } from "./routes/stats.ts";
import { snapshotRoute } from "./routes/snapshot.ts";
import { verifyRoute } from "./routes/verify.ts";
import { runDailySnapshot } from "./snapshot.ts";
import type { Env } from "./env.ts";

const app = new Hono<{ Bindings: Env }>();

// CORS limited to the production origins. Local dev (port 4321) added for
// development convenience; remove or env-gate if you fork for another deploy.
const ALLOWED_ORIGINS = new Set([
  "https://noalacord.com",
  "https://www.noalacord.com",
  "http://localhost:4321",
]);

app.use(
  "/api/*",
  cors({
    origin: (origin) => (ALLOWED_ORIGINS.has(origin) ? origin : null),
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    maxAge: 86400,
  }),
);

app.route("/api/sign", signRoute);
app.route("/api/stats", statsRoute);
app.route("/api/snapshot", snapshotRoute);
app.route("/api/verify", verifyRoute);

app.get("/api/health", (c) => c.json({ ok: true }));

app.notFound((c) => c.json({ error: "not_found" }, 404));

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runDailySnapshot(env));
  },
};

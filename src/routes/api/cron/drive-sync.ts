import { createFileRoute } from "@tanstack/react-router";
import { runDriveSync, readAutoSync, writeAutoSync, appendSyncLog, alertSyncFailure } from "@/lib/google-drive-sync.server";

const json = (data: unknown, init?: ResponseInit) => Response.json(data, init);

export async function GET({ request }: { request: Request }) {
  const url = new URL(request.url);
  const authHeader = request.headers.get("authorization");
  const token = url.searchParams.get("secret");
  const expectedSecret = process.env["CRON_SECRET"] || "store-backup-safe-key";
  if (token !== expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return json({ error: "غير مصرح بالدخول" }, { status: 401 });
  }

  try {
    const s = await readAutoSync();
    const force = url.searchParams.get("force") === "1";
    if (!force) {
      if (!s.enabled) return json({ ok: true, skipped: "disabled" });
      const last = s.lastRun ? new Date(s.lastRun).getTime() : 0;
      if (Date.now() - last < s.hours * 3600_000 - 60_000) {
        return json({ ok: true, skipped: "not_due" });
      }
    }
    const result = await runDriveSync({ batchSize: s.batchSize });
    // إن بقيت صور، لا نحدّث وقت آخر مزامنة حتى تكمل الدفعات التالية
    if (result.remainingImages === 0) await writeAutoSync({ ...s, lastRun: result.timestamp });
    return json({ ok: true, result });
  } catch (e: any) {
    await appendSyncLog({ at: new Date().toISOString(), uploaded: 0, failed: 0, remaining: -1, error: e.message });
    await alertSyncFailure(e.message);
    return json({ ok: false, error: e.message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/cron/drive-sync")({
  server: {
    handlers: {
      GET: async ({ request }) => GET({ request }),
    },
  },
});

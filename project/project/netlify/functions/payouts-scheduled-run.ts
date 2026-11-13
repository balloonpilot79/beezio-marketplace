import type { Handler } from "@netlify/functions";
import { createSupabaseAdmin } from "./_lib/supabase";
import { requireAdmin } from "./_lib/auth";
import { getEnvBool } from "./_lib/env";
import {
  isTodayScheduledPayday,
  getTimeZoneDateString,
} from "./_lib/payoutSchedule";
import { prepareNormalPayoutBatch } from "./_lib/normalPayouts";
import { submitPreparedPayoutBatch } from "./_lib/payoutSubmission";
import { queueOwnerAlert, dispatchOwnerAlerts } from "./_lib/owner-alerts";
export const handler: Handler = async (event) => {
  if (event) {
    try { await requireAdmin(event); } catch (error: any) {
      return { statusCode: Number(error?.statusCode) || 401, body: JSON.stringify({ error: error?.message || "Unauthorized" }) };
    }
  }
  const skipped = (reason: string) => ({
    statusCode: 200,
    body: JSON.stringify({ ok: true, skipped: true, reason }),
  });
  if (
    !getEnvBool("PAYOUTS_SCHEDULED_ENABLED") ||
    !getEnvBool("PAYOUTS_AUTO_APPROVE") ||
    !getEnvBool("PAYOUTS_ENABLED") ||
    getEnvBool("PAYOUTS_PAUSED")
  )
    return skipped("Automatic payouts disabled or paused");
  const db = createSupabaseAdmin();
  try {
    const { error: ee } = await db.rpc("expire_unsubmitted_payout_batches");
    if (ee) throw ee;
    if (!isTodayScheduledPayday()) return skipped("Not a scheduled payday");
    const { data: prior, error: pe } = await db
      .from("payout_batches")
      .select("id")
      .eq("payout_date", getTimeZoneDateString(new Date()))
      .in("status", ["PREPARED", "CREATED"])
      .order("created_at")
      .limit(1);
    if (pe) throw pe;
    if (prior?.length) return await submitPreparedPayoutBatch(db, prior[0].id);
    const prepared = await prepareNormalPayoutBatch(db, {
      payoutDate: getTimeZoneDateString(new Date()),
    });
    if (prepared.batch_id)
      return await submitPreparedPayoutBatch(db, prepared.batch_id);
    return { statusCode: 200, body: JSON.stringify(prepared) };
  } catch (e) {
    await queueOwnerAlert(
      db,
      "payout-run-error:" + new Date().toISOString().slice(0, 13),
      { title: "Automatic payout job needs review", description: String(e) },
    );
    await dispatchOwnerAlerts(db);
    throw e;
  }
};
export default handler;

import type { Handler } from "@netlify/functions";
import { createSupabaseAdmin } from "./_lib/supabase";
import { requireAdmin } from "./_lib/auth";
import { json, assertPost, parseJson } from "./_lib/http";
import { prepareNormalPayoutBatch } from "./_lib/normalPayouts";
export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    await requireAdmin(event);
    const b = parseJson<{ dry_run?: boolean; payout_date?: string }>(
      event.body,
    );
    return json(
      200,
      await prepareNormalPayoutBatch(createSupabaseAdmin(), {
        dryRun: b?.dry_run === true,
        payoutDate: b?.payout_date,
      }),
    );
  } catch (e: any) {
    return json(Number(e?.statusCode) || 500, {
      error: String(e?.message || e),
    });
  }
};
export default handler;

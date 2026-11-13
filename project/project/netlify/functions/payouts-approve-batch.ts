import type { Handler } from "@netlify/functions";
import { createSupabaseAdmin } from "./_lib/supabase";
import { requireAdmin } from "./_lib/auth";
import { json, assertPost, parseJson } from "./_lib/http";
import { submitPreparedPayoutBatch } from "./_lib/payoutSubmission";
export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    await requireAdmin(event);
    const b = parseJson<{ batch_id?: string }>(event.body);
    if (!b?.batch_id) return json(400, { error: "Missing batch_id" });
    return await submitPreparedPayoutBatch(createSupabaseAdmin(), b.batch_id);
  } catch (e: any) {
    return json(Number(e?.statusCode) || 500, {
      error: String(e?.message || e),
    });
  }
};
export default handler;

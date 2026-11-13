import { getEnvBool } from "./env";
import { getPayPalAccessToken, getPayPalBaseUrl } from "./paypal";
import { queueOwnerAlert, dispatchOwnerAlerts } from "./owner-alerts";
const response = (statusCode: number, data: any) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});
export async function submitPreparedPayoutBatch(db: any, batchId: string) {
  if (
    getEnvBool("PAYOUTS_PAUSED", false) ||
    !getEnvBool("PAYOUTS_ENABLED", false)
  )
    return response(503, { error: "Payouts are disabled or paused." });
  const token = await getPayPalAccessToken(),
    baseUrl = await getPayPalBaseUrl();
  const { data: items, error } = await db
    .from("payout_items")
    .select("id,recipient,amount,status")
    .eq("payout_batch_id", batchId)
    .in("status", ["PREPARED", "CREATED"]);
  if (error || !items?.length)
    return response(409, {
      error: error?.message || "No reserved payout items.",
    });
  const { error: le } = await db.rpc("lock_normal_payout_submission", {
    p_batch_id: batchId,
  });
  if (le) {
    for (const state of ["PREPARED", "CREATED"]) {
      const { error: e } = await db.rpc("fail_normal_payout_batch", {
        p_batch_id: batchId,
        p_expected_status: state,
        p_reason: le.message,
      });
      if (e) throw e;
    }
    return response(409, { error: le.message });
  }
  const reconcile = async (reason: string) => {
    const { error: e } = await db
      .from("payout_batches")
      .update({
        status: "RECONCILIATION_REQUIRED",
        failure_reason: reason.slice(0, 1000),
        updated_at: new Date().toISOString(),
      })
      .eq("id", batchId)
      .eq("status", "SUBMITTING");
    if (e) console.error("Payout reconciliation state needs review", batchId);
    await queueOwnerAlert(db, "payout-reconcile:" + batchId, {
      title: "Payout requires review",
      batch_id: batchId,
      description: reason,
      action:
        "Check PayPal before retrying. These earnings stay reserved to prevent duplicate payments.",
    });
    await dispatchOwnerAlerts(db);
    return response(502, {
      error: "Payout locked for reconciliation.",
      batch_id: batchId,
      code: "PAYOUT_RECONCILIATION_REQUIRED",
    });
  };
  let res: Response;
  try {
    res = await fetch(baseUrl + "/v1/payments/payouts", {
      method: "POST",
      signal: AbortSignal.timeout(12000),
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        "PayPal-Request-Id": batchId,
      },
      body: JSON.stringify({
        sender_batch_header: {
          sender_batch_id: "BZO_" + batchId,
          email_subject: "Your Beezio payout",
          email_message: "Your eligible Beezio earnings are being paid.",
        },
        items: items.map((i: any) => ({
          recipient_type: "EMAIL",
          recipient_wallet: "PAYPAL",
          receiver: i.recipient,
          amount: { value: Number(i.amount).toFixed(2), currency: "USD" },
          sender_item_id: i.id,
          note: "Beezio payout",
        })),
      }),
    });
  } catch (e) {
    return reconcile(String(e));
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (
      res.status >= 500 ||
      [408, 429].includes(res.status) ||
      /DUPLICATE/.test(String(data?.name || ""))
    )
      return reconcile(
        "Ambiguous PayPal response " +
          res.status +
          ": " +
          String(data?.name || "unknown"),
      );
    const reason =
      "PayPal rejected payout: " + String(data?.name || res.status);
    const { error: e } = await db.rpc("fail_normal_payout_batch", {
      p_batch_id: batchId,
      p_expected_status: "SUBMITTING",
      p_reason: reason,
    });
    if (e) return reconcile("Could not safely record rejection: " + e.message);
    await queueOwnerAlert(db, "payout-rejected:" + batchId, {
      title: "Payout rejected by PayPal",
      batch_id: batchId,
      description: reason,
      action:
        "Review PayPal permissions and available funds. Eligible earnings remain unpaid.",
    });
    await dispatchOwnerAlerts(db);
    return response(502, { error: reason, batch_id: batchId });
  }
  const providerId = String(data?.batch_header?.payout_batch_id || "").trim();
  if (!providerId)
    return reconcile(
      "PayPal accepted the request without returning a payout batch ID.",
    );
  const { error: e } = await db
    .from("payout_batches")
    .update({
      status: "SUBMITTED",
      provider_batch_id: providerId,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", batchId)
    .eq("status", "SUBMITTING");
  if (e)
    return reconcile(
      "PayPal batch " +
        providerId +
        " was accepted but could not be recorded: " +
        e.message,
    );
  return response(200, {
    ok: true,
    batch_id: batchId,
    provider_batch_id: providerId,
    item_count: items.length,
  });
}

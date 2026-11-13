export function enforcePayoutMinimum<
  T extends { userId: string; role: string; amount: number },
>(entries: T[]): T[] {
  const totals = new Map<string, number>();
  for (const e of entries) {
    const k = JSON.stringify([e.userId, e.role]);
    totals.set(k, (totals.get(k) || 0) + Math.round(e.amount * 100));
  }
  return entries.filter(
    (e) => (totals.get(JSON.stringify([e.userId, e.role])) || 0) >= 500,
  );
}
export function isOrderPayoutEligible(
  o: any,
  l: any,
  now = Date.now(),
): boolean {
  if (
    !["paid", "completed"].includes(
      String(o?.payment_status || "").toLowerCase(),
    )
  )
    return false;
  if (/refund|cancel|revers|fail|denied/i.test(String(o?.status || "")))
    return false;
  if (String(o?.dispute_status || "NONE").toUpperCase() !== "NONE")
    return false;
  const paid = Date.parse(String(o?.paid_at || "")),
    hold = Date.parse(String(l?.hold_release_at || ""));
  if (
    !Number.isFinite(paid) ||
    !Number.isFinite(hold) ||
    Math.max(paid + 14 * 86400000, hold) > now
  )
    return false;
  if (!String(o?.provider_capture_id || "").trim()) return false;
  if (o.fulfillment_method === "pickup") return Boolean(o.picked_up_at);
  if (o.fulfillment_method === "digital") return true;
  const address =
    o.shipping_address &&
    typeof o.shipping_address === "object" &&
    Object.keys(o.shipping_address).length > 0;
  return (
    !address ||
    Boolean(String(o.tracking_number || o.cj_tracking_number || "").trim())
  );
}
export async function getEligibleLedgerIds(db: any, rows: any[]) {
  const ids = [...new Set(rows.map((r) => r.order_id).filter(Boolean))],
    result = new Set<string>();
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { data: orders, error } = await db
      .from("orders")
      .select(
        "id,dispute_status,status,payment_status,paid_at,provider_capture_id,shipping_address,tracking_number,cj_tracking_number,fulfillment_method,picked_up_at",
      )
      .in("id", chunk);
    if (error)
      throw new Error("Could not verify paid orders: " + error.message);
    const { data: disputes, error: de } = await db
      .from("disputes")
      .select("order_id")
      .in("order_id", chunk)
      .in("status", ["open", "investigating", "awaiting_response"]);
    if (de) throw new Error("Could not verify dispute holds: " + de.message);
    const blocked = new Set((disputes || []).map((d: any) => d.order_id));
    const byId = new Map((orders || []).map((o: any) => [o.id, o]));
    for (const row of rows)
      if (
        !blocked.has(row.order_id) &&
        isOrderPayoutEligible(byId.get(row.order_id), row)
      )
        result.add(String(row.id));
  }
  return result;
}

import {
  groupOrderPayeeCredits,
  loadPayoutCreditRows,
} from "./payoutPayeeGrouping";
import {
  enforcePayoutMinimum,
  getEligibleLedgerIds,
} from "./payoutEligibility";
import {
  getTimeZoneDateString,
  resolveRequestedPayoutDate,
} from "./payoutSchedule";
type Entry = {
  ledgerId: string;
  orderId: string;
  userId: string;
  role: "SELLER" | "PARTNER" | "INFLUENCER";
  amount: number;
  orderMoneyLedgerId?: string | null;
};
const check = (error: any) => {
  if (error) throw new Error(error.message);
};
export async function prepareNormalPayoutBatch(
  db: any,
  options: { dryRun?: boolean; payoutDate?: string } = {},
) {
  const { payoutDate } = resolveRequestedPayoutDate(options.payoutDate),
    today = getTimeZoneDateString(new Date());
  if (!options.dryRun && payoutDate !== today)
    throw new Error(
      "Live payouts can only be prepared on their scheduled payday.",
    );
  if (!options.dryRun) {
    const { error } = await db.rpc("release_normal_payout_holds");
    check(error);
  }
  const rows: any[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db
      .from("payout_ledger")
      .select("id,order_id,status,hold_release_at")
      .in(
        "status",
        options.dryRun ? ["PENDING_HOLD", "READY_TO_PAY"] : ["READY_TO_PAY"],
      )
      .lte("hold_release_at", new Date().toISOString())
      .order("id")
      .range(offset, offset + 499);
    check(error);
    rows.push(...(data || []));
    if (!data || data.length < 500) break;
  }
  const eligible = await getEligibleLedgerIds(db, rows),
    byOrder = new Map(
      rows.filter((r) => eligible.has(r.id)).map((r) => [r.order_id, r.id]),
    );
  const credits = await loadPayoutCreditRows(db, [...byOrder.keys()]);
  const entries = groupOrderPayeeCredits(
    credits
      .filter(
        (r) =>
          ["ready", ...(options.dryRun ? ["held"] : [])].includes(r.status) &&
          !r.payout_batch_id &&
          Number(r.net_amount) > 0,
      )
      .map((r) => ({
        ledgerId: byOrder.get(r.order_id)!,
        orderMoneyLedgerId: r.id,
        orderId: r.order_id,
        userId: r.payee_id,
        role: (r.payee_type === "seller"
          ? "SELLER"
          : r.payee_type === "affiliate"
            ? "PARTNER"
            : "INFLUENCER") as Entry["role"],
        amount: Number(r.net_amount),
      })),
  );
  const accounts = new Map<string, string>(),
    reserved = new Set<string>();
  const users = [...new Set(entries.map((e) => e.userId))];
  for (let n = 0; n < users.length; n += 100) {
    const { data, error } = await db
      .from("paypal_accounts")
      .select("user_id,role,paypal_email,is_verified")
      .in("user_id", users.slice(n, n + 100));
    check(error);
    for (const a of data || [])
      if (a.is_verified && String(a.paypal_email || "").includes("@"))
        accounts.set(
          a.user_id + "::" + a.role,
          a.paypal_email.trim().toLowerCase(),
        );
  }
  const ledgerIds = [...new Set(entries.map((e) => e.ledgerId))];
  for (let n = 0; n < ledgerIds.length; n += 100) {
    const { data, error } = await db
      .from("payout_items")
      .select("ledger_id,payee_user_id,payee_role")
      .in("ledger_id", ledgerIds.slice(n, n + 100))
      .in("status", ["PREPARED", "CREATED", "SENT"]);
    check(error);
    for (const i of data || [])
      reserved.add(i.ledger_id + "::" + i.payee_user_id + "::" + i.payee_role);
  }
  const ready = enforcePayoutMinimum(
    entries.filter(
      (e) =>
        accounts.has(e.userId + "::" + e.role) &&
        !reserved.has(e.ledgerId + "::" + e.userId + "::" + e.role),
    ),
  );
  // Keep all credits for a selected role together so the minimum remains true.
  const keys = [...new Set(ready.map((e) => e.userId + "::" + e.role))].slice(
      0,
      50,
    ),
    selected = ready.filter((e) => keys.includes(e.userId + "::" + e.role));
  if (selected.length > 15000)
    throw new Error(
      "Payout batch exceeds PayPal item limit; manual review required.",
    );
  const total =
    Math.round(selected.reduce((n, e) => n + Math.round(e.amount * 100), 0)) /
    100;
  if (options.dryRun || !selected.length)
    return {
      ok: true,
      dry_run: Boolean(options.dryRun),
      item_count: selected.length,
      total_amount: total,
      payout_date: payoutDate,
      message: selected.length
        ? "Payout preview"
        : "No eligible verified recipients at the $5 minimum.",
    };
  const batchId = crypto.randomUUID();
  const { error: be } = await db
    .from("payout_batches")
    .insert({
      id: batchId,
      batch_number: "BZO_" + batchId,
      provider: "paypal",
      status: "PREPARED",
      total_amount: total,
      recipient_count: keys.length,
      item_count: selected.length,
      payout_date: payoutDate,
    });
  check(be);
  const { error: ie } = await db
    .from("payout_items")
    .insert(
      selected.map((e) => ({
        payout_batch_id: batchId,
        ledger_id: e.ledgerId,
        order_money_ledger_id: e.orderMoneyLedgerId || null,
        payee_user_id: e.userId,
        payee_role: e.role,
        recipient: accounts.get(e.userId + "::" + e.role),
        amount: e.amount,
        status: "PREPARED",
      })),
    );
  if (ie) {
    await db.rpc("fail_normal_payout_batch", {
      p_batch_id: batchId,
      p_expected_status: "PREPARED",
      p_reason: ie.message,
    });
    throw new Error("Could not reserve payout items: " + ie.message);
  }
  const { error: re } = await db.rpc("reserve_normal_payout_credits", {
    p_batch_id: batchId,
  });
  if (re) {
    await db.rpc("fail_normal_payout_batch", {
      p_batch_id: batchId,
      p_expected_status: "PREPARED",
      p_reason: re.message,
    });
    throw new Error("Could not reserve itemized credits: " + re.message);
  }
  return {
    ok: true,
    batch_id: batchId,
    batch_status: "PREPARED",
    payout_date: payoutDate,
    item_count: selected.length,
    total_amount: total,
  };
}

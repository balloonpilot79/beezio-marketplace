// The payout queue allows one payment per order, payee, and role. Keep the
// underlying credits itemized, but send their combined amount to PayPal.
export function groupOrderPayeeCredits<T extends {
  orderId: string | null;
  userId: string;
  role: string;
  amount: number;
  orderMoneyLedgerId?: string | null;
}>(credits: T[]): T[] {
  const grouped = new Map<string, T>();
  for (const credit of credits) {
    const key = JSON.stringify([credit.orderId, credit.userId, credit.role]);
    const previous = grouped.get(key);
    grouped.set(key, previous ? {
      ...previous,
      amount: (Math.round(previous.amount * 100) + Math.round(credit.amount * 100)) / 100,
      orderMoneyLedgerId: null,
    } : credit);
  }
  return Array.from(grouped.values());
}

export async function loadPayoutCreditRows(db: any, orderIds: string[]) {
  const rows: Array<{
    id: string;
    order_id: string;
    payee_type: string;
    payee_id: string;
    net_amount: number;
    status: string;
    payout_batch_id: string | null;
  }> = [];
  const pageSize = 500;
  const orderChunkSize = 100;
  for (let start = 0; start < orderIds.length; start += orderChunkSize) {
    const ids = orderIds.slice(start, start + orderChunkSize);
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await db.from('order_money_ledger')
        .select('id, order_id, payee_type, payee_id, net_amount, status, payout_batch_id')
        .in('order_id', ids)
        .in('payee_type', ['seller', 'affiliate', 'influencer'])
        .order('id')
        .range(offset, offset + pageSize - 1);
      
      if (error) throw new Error(error.message);
      const page = data || [];
      rows.push(...page);
      if (page.length < pageSize) break;
    }
  }
  return rows;
}

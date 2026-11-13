import { describe, it, expect } from "vitest";
import {
  enforcePayoutMinimum,
  isOrderPayoutEligible,
} from "./payoutEligibility";
const now = Date.parse("2026-11-15T18:00:00Z");
const order = {
  payment_status: "paid",
  status: "paid",
  paid_at: "2026-11-01T18:00:00Z",
  provider_capture_id: "capture",
  dispute_status: "NONE",
  shipping_address: {},
  fulfillment_method: "digital",
};
const ledger = { hold_release_at: "2026-11-15T18:00:00Z" };
describe("normal payout eligibility", () => {
  it("requires the entire fourteen days, including the final millisecond", () => {
    expect(isOrderPayoutEligible(order, ledger, now - 1)).toBe(false);
    expect(isOrderPayoutEligible(order, ledger, now)).toBe(true);
  });
  it("never allows an early ledger date to shorten the paid-at hold", () =>
    expect(
      isOrderPayoutEligible(order, { hold_release_at: "2026-11-02" }, now - 1),
    ).toBe(false));
  it("honors a longer configured hold", () =>
    expect(
      isOrderPayoutEligible(order, { hold_release_at: "2026-11-16" }, now),
    ).toBe(false));
  it.each(["refunded", "refund_pending", "pending", "failed", "reversed"])(
    "blocks payment status %s",
    (status) =>
      expect(
        isOrderPayoutEligible(
          { ...order, payment_status: status },
          ledger,
          now,
        ),
      ).toBe(false),
  );
  it("blocks disputes and missing capture/payment timestamps", () => {
    for (const change of [
      { dispute_status: "OPEN" },
      { provider_capture_id: "" },
      { paid_at: null },
    ])
      expect(isOrderPayoutEligible({ ...order, ...change }, ledger, now)).toBe(
        false,
      );
  });
  it("requires shipping tracking or confirmed pickup", () => {
    expect(
      isOrderPayoutEligible(
        {
          ...order,
          fulfillment_method: "shipping",
          shipping_address: { city: "Ottumwa" },
        },
        ledger,
        now,
      ),
    ).toBe(false);
    expect(
      isOrderPayoutEligible(
        { ...order, fulfillment_method: "pickup" },
        ledger,
        now,
      ),
    ).toBe(false);
    expect(
      isOrderPayoutEligible(
        { ...order, fulfillment_method: "pickup", picked_up_at: "2026-11-02" },
        ledger,
        now,
      ),
    ).toBe(true);
  });
  it("keeps minimums separate by recipient and role and includes exactly five dollars", () => {
    const entries = [
      { userId: "a", role: "SELLER", amount: 4.99 },
      { userId: "a", role: "PARTNER", amount: 2.5 },
      { userId: "a", role: "PARTNER", amount: 2.5 },
      { userId: "b", role: "SELLER", amount: 0.01 },
    ];
    expect(enforcePayoutMinimum(entries)).toEqual(entries.slice(1, 3));
  });
});

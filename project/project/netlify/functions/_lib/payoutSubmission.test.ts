import { beforeEach, describe, it, expect, vi } from "vitest";
vi.mock("./paypal", () => ({
  getPayPalAccessToken: vi.fn(async () => "token"),
  getPayPalBaseUrl: vi.fn(async () => "https://paypal.test"),
}));
vi.mock("./owner-alerts", () => ({
  queueOwnerAlert: vi.fn(async () => {}),
  dispatchOwnerAlerts: vi.fn(async () => ({ sent: 1, failed: 0 })),
}));
import { submitPreparedPayoutBatch } from "./payoutSubmission";
import { queueOwnerAlert } from "./owner-alerts";
const id = "00000000-0000-4000-8000-000000000001";
function database(lockError: string | null = null) {
  const db: any = {
    updates: [],
    rpc: vi.fn(async (name: string, args: any) => ({
      error:
        name === "lock_normal_payout_submission" && lockError
          ? { message: lockError }
          : null,
      data: true,
    })),
  };
  db.from = () => {
    let update: any = null;
    const q: any = {
      select: () => q,
      update: (x: any) => {
        update = x;
        db.updates.push(x);
        return q;
      },
      eq: () => q,
      in: () => q,
      then: (resolve: any) =>
        Promise.resolve({
          data: update
            ? null
            : [
                {
                  id: "item",
                  recipient: "a@example.com",
                  amount: 5,
                  status: "PREPARED",
                },
              ],
          error: null,
        }).then(resolve),
    };
    return q;
  };
  return db;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("PAYOUTS_ENABLED", "true");
  vi.stubEnv("PAYOUTS_PAUSED", "false");
});
describe("PayPal payout submission", () => {
  it("uses stable provider idempotency identifiers and records a confirmed batch", async () => {
    const fetch = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({
        batch_header: { payout_batch_id: "provider-batch" },
      }),
    }));
    vi.stubGlobal("fetch", fetch);
    const db = database();
    expect((await submitPreparedPayoutBatch(db, id)).statusCode).toBe(200);
    expect(fetch.mock.calls[0][1].headers["PayPal-Request-Id"]).toBe(id);
    expect(
      JSON.parse(fetch.mock.calls[0][1].body).sender_batch_header
        .sender_batch_id,
    ).toBe("BZO_" + id);
    expect(db.updates).toContainEqual(
      expect.objectContaining({
        status: "SUBMITTED",
        provider_batch_id: "provider-batch",
      }),
    );
  });
  it("does not contact PayPal if the database rejects the submission lock", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(
      (await submitPreparedPayoutBatch(database("Order is not eligible"), id))
        .statusCode,
    ).toBe(409);
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["timeout", "server", "duplicate", "missing_id"])(
    "locks uncertain %s results for reconciliation instead of releasing earnings",
    async (mode) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          if (mode === "timeout") throw new Error("timeout");
          return {
            ok: mode === "missing_id",
            status: mode === "server" ? 500 : mode === "duplicate" ? 400 : 201,
            json: async () => ({
              name: mode === "duplicate" ? "DUPLICATE_BATCH_ID" : undefined,
            }),
          };
        }),
      );
      const db = database();
      expect((await submitPreparedPayoutBatch(db, id)).statusCode).toBe(502);
      expect(db.updates).toContainEqual(
        expect.objectContaining({ status: "RECONCILIATION_REQUIRED" }),
      );
      expect(
        db.rpc.mock.calls.filter(
          (c: any) => c[0] === "fail_normal_payout_batch",
        ),
      ).toHaveLength(0);
      expect(queueOwnerAlert).toHaveBeenCalled();
    },
  );
  it("releases definitively rejected payouts and notifies the owner", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 403,
        json: async () => ({ name: "NOT_AUTHORIZED" }),
      })),
    );
    const db = database();
    await submitPreparedPayoutBatch(db, id);
    expect(db.rpc).toHaveBeenCalledWith(
      "fail_normal_payout_batch",
      expect.objectContaining({ p_expected_status: "SUBMITTING" }),
    );
    expect(queueOwnerAlert).toHaveBeenCalled();
  });
  it("honors the payout pause switch", async () => {
    vi.stubEnv("PAYOUTS_PAUSED", "true");
    const db = database();
    expect((await submitPreparedPayoutBatch(db, id)).statusCode).toBe(503);
    expect(db.rpc).not.toHaveBeenCalled();
  });
});

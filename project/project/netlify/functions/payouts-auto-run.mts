import { handler } from "./payouts-scheduled-run";
import type { Config } from "@netlify/functions";
export default async () => {
  const result = await handler(
    undefined as any,
    undefined as any,
    undefined as any,
  );
  if (!result || result.statusCode >= 400)
    throw new Error(result?.body || "Payout job failed");
  return new Response(result.body || "OK", { status: result.statusCode });
};
export const config: Config = { schedule: "5 * * * *" };

import type { Config } from "@netlify/functions";
import { createSupabaseAdmin } from "./_lib/supabase";
import { dispatchOwnerAlerts } from "./_lib/owner-alerts";
export default async () =>
  Response.json(await dispatchOwnerAlerts(createSupabaseAdmin()));
export const config: Config = { schedule: "* * * * *" };

const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseClient = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey)
  : null;

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { name, email, message, ownerId, ownerType, storeName, pageUrl } = body;
    if (!name || !email || !message || !ownerId || !ownerType) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing required fields" }) };
    }

    // Basic anti-abuse guard
    if (message.length > 2000) {
      return { statusCode: 400, body: JSON.stringify({ error: "Message too long" }) };
    }

    // Store in Supabase if service role is available
    if (supabaseClient) {
      try {
        await supabaseClient.from("contact_messages").insert({
          owner_id: ownerId,
          owner_type: ownerType,
          name,
          email,
          message,
          store_name: storeName || null,
          page_url: pageUrl || null,
          created_at: new Date().toISOString(),
        });
      } catch (dbErr) {
        console.warn("contact-form supabase insert failed", dbErr?.message || dbErr);
      }
    } else {
      console.log("Contact message (no Supabase client configured)", { name, email, message, ownerId, ownerType, storeName, pageUrl });
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error("contact-form error", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Server error" }) };
  }
};

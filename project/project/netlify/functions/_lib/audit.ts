export async function writeAuditLog(params: {
  supabaseAdmin: any;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  details?: Record<string, unknown>;
}) {
  try {
    await params.supabaseAdmin.from('audit_log').insert({
      actor_user_id: params.actor_user_id,
      action: params.action,
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      details: params.details || {},
    });
  } catch {
    // non-fatal
  }
}


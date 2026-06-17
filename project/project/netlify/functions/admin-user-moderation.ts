import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { json, assertPost, parseJson } from './_lib/http';
import { requireAdmin, resolveAuthUserIdFromProfileId } from './_lib/auth';

type RequestBody = {
  action?: 'list' | 'apply' | 'revoke';
  target_user_id?: string;
  moderation_id?: string;
  action_type?: 'warning' | 'suspension' | 'ban' | 'restriction';
  reason?: string;
  notes?: string;
  duration_days?: number | null;
  restrictions?: Record<string, unknown> | null;
  limit?: number;
};

const asText = (value: unknown) => String(value || '').trim();
const asNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const extractMissingColumnName = (message: string): string | null => {
  const msg = String(message || '');
  const pg = msg.match(/column\s+"([^"]+)"\s+of\s+relation\s+"[^"]+"\s+does\s+not\s+exist/i);
  if (pg?.[1]) return pg[1];
  const pgrst = msg.match(/Could not find the '([^']+)' column of '[^']+' in the schema cache/i);
  if (pgrst?.[1]) return pgrst[1];
  return null;
};

const selectWithFallback = async (queryFactory: (selected: string[]) => PromiseLike<any>, fields: string[]) => {
  let selected = [...fields];
  let lastError: any = null;

  for (let attempt = 0; attempt < fields.length; attempt += 1) {
    const { data, error } = await queryFactory(selected);
    if (!error) return { data: (data as any[]) || [], error: null, selected };
    lastError = error;
    const missing = extractMissingColumnName(String((error as any)?.message || ''));
    if (missing && selected.includes(missing)) {
      selected = selected.filter((field) => field !== missing);
      continue;
    }
    break;
  }

  return { data: [], error: lastError, selected };
};

const normalizeModerationRow = (row: any) => ({
  id: asText(row?.id),
  user_id: asText(row?.user_id),
  action_type: asText(row?.action_type).toLowerCase(),
  reason: asText(row?.reason),
  notes: asText(row?.notes),
  duration_days: asNumber(row?.duration_days),
  restrictions: row?.restrictions && typeof row.restrictions === 'object' ? row.restrictions : null,
  is_active: Boolean(row?.is_active),
  expires_at: row?.expires_at || null,
  revoked_at: row?.revoked_at || null,
  created_at: row?.created_at || null,
  updated_at: row?.updated_at || null,
  applied_by: asText(row?.applied_by),
  revoked_by: asText(row?.revoked_by),
});

const normalizeLogRow = (row: any, source: 'moderation_log' | 'audit_log') => ({
  source,
  id: asText(row?.id),
  action: asText(row?.action_type || row?.action),
  entity_type: asText(row?.target_type || row?.entity_type),
  entity_id: asText(row?.target_id || row?.entity_id),
  reason: asText(row?.reason),
  details: row?.action_details || row?.details || null,
  actor_user_id: asText(row?.moderator_id || row?.actor_user_id),
  created_at: row?.created_at || null,
});

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    const { userId: adminUserId } = await requireAdmin(event);

    const body = parseJson<RequestBody>(event.body);
    const action = asText(body?.action || 'list').toLowerCase();
    const targetRaw = asText(body?.target_user_id);
    const moderationId = asText(body?.moderation_id);
    const limit = Math.max(5, Math.min(100, Number(body?.limit) || 20));
    const supabaseAdmin = createSupabaseAdmin();

    if (action === 'apply') {
      const actionType = asText(body?.action_type).toLowerCase();
      const reason = asText(body?.reason);
      const notes = asText(body?.notes);
      const durationDays = asNumber(body?.duration_days);
      const targetUserId = await resolveAuthUserIdFromProfileId(targetRaw);

      if (!targetUserId) return json(400, { error: 'target_user_id is required.' });
      if (!['warning', 'suspension', 'ban', 'restriction'].includes(actionType)) {
        return json(400, { error: 'Invalid action_type.' });
      }
      if (!reason) return json(400, { error: 'reason is required.' });

      if (actionType === 'ban' || actionType === 'suspension' || actionType === 'restriction') {
        await supabaseAdmin
          .from('user_moderation')
          .update({
            is_active: false,
            revoked_at: new Date().toISOString(),
            revoked_by: adminUserId,
          })
          .eq('user_id', targetUserId)
          .eq('is_active', true)
          .in('action_type', ['ban', 'suspension', 'restriction']);
      }

      const expiresAt =
        actionType === 'suspension' && durationDays && durationDays > 0
          ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
          : null;

      const insertPayload = {
        user_id: targetUserId,
        action_type: actionType,
        reason,
        notes: notes || null,
        duration_days: durationDays,
        restrictions: body?.restrictions && typeof body.restrictions === 'object' ? body.restrictions : null,
        is_active: true,
        applied_by: adminUserId,
        expires_at: expiresAt,
      };

      const { data, error } = await supabaseAdmin
        .from('user_moderation')
        .insert(insertPayload)
        .select('*')
        .maybeSingle();

      if (error) return json(500, { error: String((error as any)?.message || 'Failed to apply moderation action') });

      await supabaseAdmin.from('moderation_log').insert({
        action_type: `user_${actionType}`,
        target_type: 'user',
        target_id: targetUserId,
        moderator_id: adminUserId,
        action_details: {
          moderation_id: asText((data as any)?.id),
          duration_days: durationDays,
          expires_at: expiresAt,
          restrictions: insertPayload.restrictions,
        },
        reason: `${reason}${notes ? ` | ${notes}` : ''}`,
      });

      await supabaseAdmin.from('audit_log').insert({
        actor_user_id: adminUserId,
        action: `admin_user_${actionType}`,
        entity_type: 'user',
        entity_id: targetUserId,
        details: {
          moderation_id: asText((data as any)?.id),
          reason,
          notes,
          duration_days: durationDays,
          expires_at: expiresAt,
          restrictions: insertPayload.restrictions,
        },
      });

      return json(200, { ok: true, moderation: normalizeModerationRow(data) });
    }

    if (action === 'revoke') {
      if (!moderationId && !targetRaw) return json(400, { error: 'moderation_id or target_user_id is required.' });

      let query = supabaseAdmin
        .from('user_moderation')
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoked_by: adminUserId,
        })
        .eq('is_active', true);

      if (moderationId) {
        query = query.eq('id', moderationId);
      } else {
        const targetUserId = await resolveAuthUserIdFromProfileId(targetRaw);
        if (!targetUserId) return json(400, { error: 'Invalid target_user_id.' });
        query = query.eq('user_id', targetUserId);
      }

      const { data, error } = await query.select('*');
      if (error) return json(500, { error: String((error as any)?.message || 'Failed to revoke moderation action') });

      const revokedRows = ((data as any[]) || []).map(normalizeModerationRow);
      const targetIds = Array.from(new Set(revokedRows.map((row) => row.user_id).filter(Boolean)));

      for (const targetUserId of targetIds) {
        await supabaseAdmin.from('moderation_log').insert({
          action_type: 'user_moderation_revoked',
          target_type: 'user',
          target_id: targetUserId,
          moderator_id: adminUserId,
          action_details: { moderation_ids: revokedRows.map((row) => row.id) },
          reason: 'Admin revoked active moderation record.',
        });
        await supabaseAdmin.from('audit_log').insert({
          actor_user_id: adminUserId,
          action: 'admin_user_moderation_revoked',
          entity_type: 'user',
          entity_id: targetUserId,
          details: { moderation_ids: revokedRows.map((row) => row.id) },
        });
      }

      return json(200, { ok: true, revoked: revokedRows });
    }

    const targetUserId = targetRaw ? await resolveAuthUserIdFromProfileId(targetRaw) : null;
    const moderationFields = [
      'id',
      'user_id',
      'action_type',
      'reason',
      'notes',
      'duration_days',
      'restrictions',
      'is_active',
      'expires_at',
      'revoked_at',
      'created_at',
      'updated_at',
      'applied_by',
      'revoked_by',
    ];
    const moderationLogFields = ['id', 'action_type', 'target_type', 'target_id', 'moderator_id', 'action_details', 'reason', 'created_at'];
    const auditLogFields = ['id', 'actor_user_id', 'action', 'entity_type', 'entity_id', 'details', 'created_at'];

    const [moderationResult, moderationLogResult, auditLogResult] = await Promise.all([
      selectWithFallback(
        (selected) => {
          let query = supabaseAdmin.from('user_moderation').select(selected.join(',')).order('created_at', { ascending: false }).limit(limit);
          if (targetUserId) query = query.eq('user_id', targetUserId);
          return query;
        },
        moderationFields
      ),
      selectWithFallback(
        (selected) => {
          let query = supabaseAdmin.from('moderation_log').select(selected.join(',')).order('created_at', { ascending: false }).limit(limit);
          if (targetUserId) query = query.eq('target_id', targetUserId);
          return query;
        },
        moderationLogFields
      ),
      selectWithFallback(
        (selected) => {
          let query = supabaseAdmin.from('audit_log').select(selected.join(',')).order('created_at', { ascending: false }).limit(limit);
          if (targetUserId) query = query.eq('entity_id', targetUserId);
          return query;
        },
        auditLogFields
      ),
    ]);

    if (moderationResult.error) {
      return json(500, { error: String((moderationResult.error as any)?.message || 'Failed to load moderation records') });
    }

    const moderation = moderationResult.data.map(normalizeModerationRow);
    const activeRestrictions = moderation.filter(
      (row) => row.is_active && (row.action_type === 'ban' || row.action_type === 'suspension' || row.action_type === 'restriction')
    );
    const activity = [
      ...moderationLogResult.data.map((row) => normalizeLogRow(row, 'moderation_log')),
      ...auditLogResult.data.map((row) => normalizeLogRow(row, 'audit_log')),
    ]
      .sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')))
      .slice(0, limit);

    return json(200, {
      ok: true,
      target_user_id: targetUserId,
      moderation,
      active_restrictions: activeRestrictions,
      activity,
    });
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    return json(statusCode, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

export default handler;
import type { Handler } from '@netlify/functions';
import { requireAdmin } from './_lib/auth';
import { json, assertPost, parseJson } from './_lib/http';
import { createSupabaseAdmin } from './_lib/supabase';

type RoleTarget = 'seller' | 'affiliate' | 'ambassador' | 'buyer';

type RequestBody = {
  action?: string;
  batch_id?: string;
  draft_id?: string;
  roles?: RoleTarget[];
  limit?: number;
  agent_enabled?: boolean;
  monthly_user_goal?: number;
};

type DiscoveredLead = {
  role_target: RoleTarget;
  channel: string;
  display_name: string;
  public_handle: string;
  source_url: string;
  contact_path: string;
  fit_reason: string;
  action_type: 'message' | 'post' | 'reply';
  message_text: string;
};

const allowedRoles = new Set<RoleTarget>(['seller', 'affiliate', 'ambassador', 'buyer']);
const asText = (value: unknown) => String(value || '').trim();

const responseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    leads: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          role_target: { type: 'string', enum: ['seller', 'affiliate', 'ambassador', 'buyer'] },
          channel: { type: 'string' },
          display_name: { type: 'string' },
          public_handle: { type: 'string' },
          source_url: { type: 'string' },
          contact_path: { type: 'string' },
          fit_reason: { type: 'string' },
          action_type: { type: 'string', enum: ['message', 'post', 'reply'] },
          message_text: { type: 'string' },
        },
        required: ['role_target', 'channel', 'display_name', 'public_handle', 'source_url', 'contact_path', 'fit_reason', 'action_type', 'message_text'],
      },
    },
  },
  required: ['summary', 'leads'],
};

function extractResponseText(payload: any) {
  for (const item of payload?.output || []) {
    if (item?.type !== 'message') continue;
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && typeof content?.text === 'string') return content.text;
    }
  }
  return '';
}

async function discoverLeads(roles: RoleTarget[], limit: number): Promise<{ summary: string; leads: DiscoveredLead[] }> {
  const apiKey = asText(process.env.OPENAI_API_KEY);
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

  const roleList = roles.join(', ');
  const prompt = `You are Beezio's recruiting research assistant. Search the public web for up to ${limit} strong, current recruiting opportunities for these groups: ${roleList}.

Beezio is a free marketplace at https://beezio.co. Sellers can create a free branded store and offer products. Affiliates can promote eligible products without holding inventory. Ambassadors can refer sellers, affiliates, and buyers and may earn from qualifying product sales. Buyers shop participating stores and the marketplace. Do not promise income and do not reveal internal pricing, allocation, or fee formulas.

Find public businesses, creators, seller communities, affiliate communities, buyer communities, or public discussion threads where a relevant, respectful Beezio introduction is appropriate. Use only public pages. Do not collect sensitive personal information. Do not use private profiles, scraped email lists, or sources whose rules prohibit outreach. Do not invent names, handles, URLs, or contact methods. Prefer official business sites, public directories, opt-in community posting pages, and recent public discussions. For Reddit, Craigslist, Facebook groups, Instagram, X, and web forums, prepare a draft only; never claim it has been posted and identify any manual or official contact path.

Write one brief, personalized draft per lead. The sender is Alex with Beezio. Alex must never claim to be a human. The public profile identifies Alex as an automated Beezio assistant, and if asked Alex must answer honestly. Keep drafts useful, specific, non-spammy, and suitable for one-to-one review. Every lead must include the exact public source URL used.`;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: asText(process.env.RECRUITING_OPENAI_MODEL) || 'gpt-5-mini',
      reasoning: { effort: 'medium' },
      tools: [{ type: 'web_search', search_context_size: 'medium' }],
      input: prompt,
      text: {
        format: {
          type: 'json_schema',
          name: 'beezio_recruiting_leads',
          strict: true,
          schema: responseSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 600);
    throw new Error(`Recruiting research failed (${response.status}): ${detail}`);
  }

  const payload = await response.json();
  const outputText = extractResponseText(payload);
  if (!outputText) throw new Error('Recruiting research returned no usable result');
  const parsed = JSON.parse(outputText);
  const leads = (Array.isArray(parsed?.leads) ? parsed.leads : [])
    .filter((lead: any) => allowedRoles.has(lead?.role_target) && /^https?:\/\//i.test(asText(lead?.source_url)))
    .slice(0, limit);
  return { summary: asText(parsed?.summary), leads };
}

async function loadOverview(supabase: any) {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [settingsResult, batchesResult, prospectsResult, draftsResult, signupsResult] = await Promise.all([
    supabase.from('recruiting_agent_settings').select('*').limit(1).maybeSingle(),
    supabase.from('recruiting_approval_batches').select('*').order('created_at', { ascending: false }).limit(12),
    supabase.from('recruiting_prospects').select('*').order('created_at', { ascending: false }).limit(100),
    supabase.from('recruiting_outreach_drafts').select('*, recruiting_prospects(display_name,role_target,source_url,contact_path,fit_reason)').order('created_at', { ascending: false }).limit(100),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', monthStart.toISOString()),
  ]);

  for (const result of [settingsResult, batchesResult, prospectsResult, draftsResult, signupsResult]) {
    if (result.error) throw result.error;
  }

  return {
    settings: settingsResult.data,
    batches: batchesResult.data || [],
    prospects: prospectsResult.data || [],
    drafts: draftsResult.data || [],
    month_signups: signupsResult.count || 0,
  };
}

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    const admin = await requireAdmin(event);
    const body = parseJson<RequestBody>(event.body);
    const action = asText(body.action) || 'overview';
    const supabase = createSupabaseAdmin();

    if (action === 'overview') return json(200, { ok: true, ...(await loadOverview(supabase)) });

    if (action === 'discover') {
      const roles = (Array.isArray(body.roles) ? body.roles : [])
        .filter((role): role is RoleTarget => allowedRoles.has(role));
      const selectedRoles = roles.length ? roles : ['seller', 'affiliate', 'ambassador', 'buyer'] as RoleTarget[];
      const limit = Math.max(4, Math.min(20, Number(body.limit) || 12));
      const discovered = await discoverLeads(selectedRoles, limit);

      const { data: batch, error: batchError } = await supabase
        .from('recruiting_approval_batches')
        .insert({ status: 'pending', summary: discovered.summary || `Prepared ${discovered.leads.length} recruiting drafts.` })
        .select('*')
        .single();
      if (batchError) throw batchError;

      let created = 0;
      for (const lead of discovered.leads) {
        const prospectPayload = {
          role_target: lead.role_target,
          channel: asText(lead.channel).slice(0, 80) || 'web',
          display_name: asText(lead.display_name).slice(0, 180) || 'Public prospect',
          public_handle: asText(lead.public_handle).slice(0, 180) || null,
          source_url: asText(lead.source_url).slice(0, 1000),
          contact_path: asText(lead.contact_path).slice(0, 500) || null,
          fit_reason: asText(lead.fit_reason).slice(0, 1000),
          status: 'drafted',
        };
        const { data: prospect, error: prospectError } = await supabase
          .from('recruiting_prospects')
          .upsert(prospectPayload, { onConflict: 'source_url' })
          .select('id')
          .single();
        if (prospectError || !prospect) continue;

        const { data: draft, error: draftError } = await supabase
          .from('recruiting_outreach_drafts')
          .insert({
            batch_id: batch.id,
            prospect_id: prospect.id,
            agent_name: 'Alex',
            channel: prospectPayload.channel,
            action_type: lead.action_type,
            message_text: asText(lead.message_text).slice(0, 4000),
            status: 'pending',
          })
          .select('id')
          .single();
        if (draftError || !draft) continue;
        created += 1;
        await supabase.from('recruiting_activity_log').insert({ batch_id: batch.id, prospect_id: prospect.id, draft_id: draft.id, event_type: 'draft_created' });
      }

      return json(200, { ok: true, batch_id: batch.id, created, ...(await loadOverview(supabase)) });
    }

    if (action === 'approve_batch') {
      const batchId = asText(body.batch_id);
      if (!batchId) return json(400, { error: 'batch_id is required' });
      const now = new Date().toISOString();
      const { error: batchError } = await supabase.from('recruiting_approval_batches').update({ status: 'approved', approved_by: admin.userId, approved_at: now }).eq('id', batchId).eq('status', 'pending');
      if (batchError) throw batchError;
      const { error: draftsError } = await supabase.from('recruiting_outreach_drafts').update({ status: 'approved', approved_by: admin.userId, approved_at: now }).eq('batch_id', batchId).eq('status', 'pending');
      if (draftsError) throw draftsError;
      await supabase.from('recruiting_activity_log').insert({ batch_id: batchId, event_type: 'batch_approved', details: { approved_by: admin.userId } });
      return json(200, { ok: true, ...(await loadOverview(supabase)) });
    }

    if (action === 'approve_draft' || action === 'reject_draft') {
      const draftId = asText(body.draft_id);
      if (!draftId) return json(400, { error: 'draft_id is required' });
      const approved = action === 'approve_draft';
      const update = approved
        ? { status: 'approved', approved_by: admin.userId, approved_at: new Date().toISOString() }
        : { status: 'rejected', approved_by: null, approved_at: null };
      const { error } = await supabase.from('recruiting_outreach_drafts').update(update).eq('id', draftId).eq('status', 'pending');
      if (error) throw error;
      await supabase.from('recruiting_activity_log').insert({ draft_id: draftId, event_type: approved ? 'draft_approved' : 'draft_rejected' });
      return json(200, { ok: true, ...(await loadOverview(supabase)) });
    }

    if (action === 'mark_sent') {
      const draftId = asText(body.draft_id);
      if (!draftId) return json(400, { error: 'draft_id is required' });
      const now = new Date().toISOString();
      const { data: draft, error } = await supabase.from('recruiting_outreach_drafts').update({ status: 'sent', sent_at: now }).eq('id', draftId).eq('status', 'approved').select('prospect_id').maybeSingle();
      if (error) throw error;
      if (draft?.prospect_id) await supabase.from('recruiting_prospects').update({ status: 'contacted', last_contact_at: now }).eq('id', draft.prospect_id);
      await supabase.from('recruiting_activity_log').insert({ draft_id: draftId, prospect_id: draft?.prospect_id || null, event_type: 'marked_sent' });
      return json(200, { ok: true, ...(await loadOverview(supabase)) });
    }

    if (action === 'update_settings') {
      const monthlyGoal = Math.max(100, Math.min(1000000, Number(body.monthly_user_goal) || 10000));
      const { error } = await supabase.from('recruiting_agent_settings').update({ monthly_user_goal: monthlyGoal, agent_enabled: body.agent_enabled !== false }).not('id', 'is', null);
      if (error) throw error;
      return json(200, { ok: true, ...(await loadOverview(supabase)) });
    }

    return json(400, { error: 'Unknown action' });
  } catch (error: any) {
    console.error('admin-recruiting-agent error', error);
    return json(Number(error?.statusCode) || 500, { error: asText(error?.message) || 'Recruiting agent request failed' });
  }
};

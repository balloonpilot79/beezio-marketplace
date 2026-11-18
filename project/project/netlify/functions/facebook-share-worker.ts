import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { getBuyerFacingProductPrice } from '../../src/utils/buyerPrice';

type Place = { state?: string; county?: string; town?: string; city?: string };
const norm = (value?: string) => (value || '').trim().toLowerCase();
const stateNames = 'alabama:al|alaska:ak|arizona:az|arkansas:ar|california:ca|colorado:co|connecticut:ct|delaware:de|district of columbia:dc|florida:fl|georgia:ga|hawaii:hi|idaho:id|illinois:il|indiana:in|iowa:ia|kansas:ks|kentucky:ky|louisiana:la|maine:me|maryland:md|massachusetts:ma|michigan:mi|minnesota:mn|mississippi:ms|missouri:mo|montana:mt|nebraska:ne|nevada:nv|new hampshire:nh|new jersey:nj|new mexico:nm|new york:ny|north carolina:nc|north dakota:nd|ohio:oh|oklahoma:ok|oregon:or|pennsylvania:pa|rhode island:ri|south carolina:sc|south dakota:sd|tennessee:tn|texas:tx|utah:ut|vermont:vt|virginia:va|washington:wa|west virginia:wv|wisconsin:wi|wyoming:wy';
const stateCodes = Object.fromEntries(stateNames.split('|').map(pair => pair.split(':')));
const stateCode = (value?: string) => stateCodes[norm(value)] || norm(value);
const unique = (values: string[]) => {
  const keys = [...new Set(values.filter(Boolean))];
  return keys.length === 1 ? keys[0] : '';
};

export function selectPage(profile: Place, matches: Place[], pages: Record<string,string>) {
  const state = stateCode(profile.state) || unique(matches.map(row => stateCode(row.state)));
  if (!state) return pages.main;
  const local = matches.filter(row => stateCode(row.state) === state);
  const county = norm(profile.county) || unique(local.map(row => norm(row.county)));
  const town = norm(profile.city) || unique(local.filter(row => norm(row.county) === county).map(row => norm(row.town)));
  return (town && county && pages[[state,county,town].join('/')]) ||
    (county && pages[[state,county].join('/')]) || pages[state] || pages.main;
}

// Invoke from a trusted scheduler. One claim per call bounds work and avoids parallel sends of an event.
export const handler: Handler = async event => {
  const env = process.env;
  if (event.httpMethod !== 'POST' || !env.FACEBOOK_WORKER_SECRET ||
      event.headers.authorization !== 'Bearer ' + env.FACEBOOK_WORKER_SECRET) return {statusCode:403,body:''};
  const pages = JSON.parse(env.FACEBOOK_PAGE_IDS || '{}') as Record<string,string>;
  const tokens = JSON.parse(env.FACEBOOK_PAGE_TOKENS || '{}') as Record<string,string>;
  const version = env.FACEBOOK_GRAPH_VERSION || '';
  const origin = env.FACEBOOK_LISTING_ORIGIN;
  if (!origin || !/^https:\/\//.test(origin) || !/^v\d+\.\d+$/.test(version) ||
      !pages.main || Object.values(pages).some(id => !/^\d+$/.test(id) || !tokens[id])) {
    return {statusCode:503,body:'Incomplete Page configuration'};
  }
  const db = createClient(env.SUPABASE_URL!,env.SUPABASE_SERVICE_ROLE_KEY!);
  const {data: rows,error} = await db.rpc('facebook_claim_share');
  if (error) throw error;
  const job = rows?.[0];
  if (!job) return {statusCode:204,body:''};
  async function update(values: Record<string,unknown>) {
    const result = await db.from('facebook_share_attempts').update(values).eq('id',job.id).eq('status','sending').select('id').single();
    if (result.error) throw result.error;
  }
  let dispatched = false;
  try {
    const {data: product,error: pe} = await db.from('products').select('*').eq('id',job.product_id).maybeSingle();
    if (pe) throw pe;
    if (!product || product.is_active === false || ['draft','archived','deleted','inactive','pending','rejected'].includes(product.status)) {
      await update({status:'skipped',detail:'Product unavailable'});
      return {statusCode:200,body:'Skipped'};
    }
    const {data: profiles,error: le} = await db.from('profiles').select('*').or('id.eq.'+job.actor_id+',user_id.eq.'+job.actor_id);
    if (le) throw le;
    const profile = profiles?.find(row => row.id === job.actor_id) || profiles?.[0] || {};
    const zip = String(profile.zip_code || '').trim().match(/^(\d{5})(?:-\d{4})?$/)?.[1];
    let locations: Place[] = [];
    if (zip) {
      const result = await db.from('facebook_zip_locations').select('state,county,town').eq('zip',zip);
      if (result.error) throw result.error;
      locations = result.data || [];
    }
    const page = selectPage(profile,locations,pages);
    const affiliate = job.source === 'affiliate';
    const link = new URL(affiliate ? '/partner/'+job.actor_id+'/product/'+job.product_id : '/product/'+job.product_id,origin);
    if (affiliate) {
      link.searchParams.set('ref',job.actor_id);
      link.searchParams.set('uid',job.actor_id);
    }
    const price = getBuyerFacingProductPrice(product);
    const message = [product.title || product.name,Number.isFinite(price) && price>0 ? '$'+price.toFixed(2) : '',
      affiliate ? 'The sharing affiliate can earn a commission.' : '', 'Shop on Beezio'].filter(Boolean).join('\n');
    await update({page_id:page});
    const image = [product.images?.[0], product.image_url, product.image].find(value => typeof value === 'string' && /^https:\/\//i.test(value));
    const endpoint = image ? '/photos' : '/feed';
    const body = image ? {url:image, caption:message+'\n'+link.href} : {message,link:link.href};
    dispatched = true;
    const response = await fetch('https://graph.facebook.com/'+version+'/'+page+endpoint,{
      method:'POST',headers:{Authorization:'Bearer '+tokens[page]},body:new URLSearchParams(Object.entries(body).filter((pair): pair is [string,string] => typeof pair[1] === 'string')),
      signal:AbortSignal.timeout(8000),redirect:'error'
    });
    const result = await response.json();
    if (response.ok && result.id) await update({status:'published',facebook_post_id:result.post_id || result.id});
    else if (response.status >=400 && response.status<500 && result.error && !result.error.is_transient)
      await update({status:'rejected',detail:'Meta error '+String(result.error.code)});
    else await update({status:'unknown',detail:'Check Page before retrying'});
  } catch {
    await update(dispatched ? {status:'unknown',detail:'Confirm outcome on Page'} : {status:'queued',available_at:new Date(Date.now()+60_000).toISOString(),detail:'Preparation failed'});
    return {statusCode:503,body:'Attempt recorded'};
  }
  return {statusCode:200,body:'Attempt recorded'};
};

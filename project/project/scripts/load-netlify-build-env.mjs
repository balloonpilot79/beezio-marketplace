// Only browser-safe, explicitly selected configuration can enter the Vite build.
import { appendFileSync } from 'node:fs';
const site = process.env.NETLIFY_SITE_ID || 'dce9ccf9-b35a-4c99-99b0-02b5a2272d13';
const response = await fetch(`https://api.netlify.com/api/v1/accounts/6872909b86558b8c0f609f47/env?site_id=${site}&context_name=production`,{headers:{Authorization:`Bearer ${process.env.NETLIFY_AUTH_TOKEN}`}});
if (!response.ok) throw new Error(`Cannot load build configuration (${response.status})`);
const variables = await response.json();
const allowed = ['VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY','VITE_PAYPAL_CLIENT_ID'];
for (const key of allowed) {
 const variable=variables.find(v=>v.key===key);
 const value=(variable?.values.find(v=>v.context==='production') || variable?.values.find(v=>v.context==='all'))?.value;
 if (!value || /[\r\n]/.test(value)) throw new Error(`Missing public build configuration: ${key}`);
 appendFileSync(process.env.GITHUB_ENV,`${key}=${value}\n`);
}
console.log('Loaded the three approved public build settings.');

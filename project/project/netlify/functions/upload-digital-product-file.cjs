const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables for upload-digital-product-file function.');
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const BUCKET = 'digital-products-private';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Missing authentication token' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    const userToken = authHeader.replace('Bearer ', '').trim();
    const { data: userData, error: verifyError } = await supabaseAdmin.auth.getUser(userToken);
    if (verifyError || !userData?.user?.id) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid or expired session token' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    let payload;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid JSON payload' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    const path = String(payload?.path || '').trim();
    const fileData = String(payload?.fileData || '').trim();
    const contentType = String(payload?.contentType || 'application/octet-stream').trim();
    const filename = String(payload?.filename || '').trim();

    if (!path || !fileData || !filename) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing path, filename, or file data' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    const expectedPrefix = `${userData.user.id}/`;
    if (!path.startsWith(expectedPrefix) || path.includes('..')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Digital uploads must stay inside your private seller folder.' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    const buffer = Buffer.from(fileData, 'base64');
    if (!buffer.length) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Unable to decode file data' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      return {
        statusCode: 413,
        body: JSON.stringify({ error: 'File exceeds the 25 MB upload limit' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, buffer, {
        upsert: false,
        contentType,
      });

    if (uploadError) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: uploadError.message || 'Upload failed' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        bucket: BUCKET,
        path,
        filename,
        contentType,
        fileSize: buffer.length,
      }),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (error) {
    console.error('[upload-digital-product-file] Unexpected error', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Unexpected server error' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
};

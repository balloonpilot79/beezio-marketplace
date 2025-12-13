const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
  throw new Error('Missing Supabase environment variables for upload-product-image function.');
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB safety limit
const ALLOWED_BUCKETS = new Set(['product-images', 'profile-avatars', 'store-banners']);

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
    } catch (err) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid JSON payload' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    const { bucket = 'product-images', path, fileData, contentType } = payload;
    if (!path || !fileData) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing path or file data' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    if (!ALLOWED_BUCKETS.has(bucket)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Bucket not allowed' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    const buffer = Buffer.from(fileData, 'base64');
    if (!buffer || !buffer.length) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Unable to decode file data' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      return {
        statusCode: 413,
        body: JSON.stringify({ error: 'File exceeds maximum size limit' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, buffer, {
        upsert: false,
        contentType: contentType || 'application/octet-stream',
      });

    if (uploadError) {
      console.error('[upload-product-image] Storage upload failed', uploadError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: uploadError.message || 'Upload failed' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    const { data: publicData } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
    return {
      statusCode: 200,
      body: JSON.stringify({
        publicUrl: publicData?.publicUrl || null,
        path,
        bucket,
      }),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (error) {
    console.error('[upload-product-image] Unexpected error', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Unexpected server error' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
};

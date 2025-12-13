import { Handler } from '@netlify/functions';

// Netlify Functions use CJ_API_KEY (no VITE_ prefix)
const CJ_API_KEY = process.env.CJ_API_KEY || process.env.VITE_CJ_API_KEY;
const CJ_API_BASE_URL = 'https://developers.cjdropshipping.com/api2.0/v1';

// In-memory token cache (resets on cold starts, which is fine since tokens last 15 days)
let cachedAccessToken: string | null = null;
let tokenExpiryDate: string | null = null;

/**
 * Get or refresh CJ access token
 */
async function getAccessToken(): Promise<string> {
  // Check if we have a valid cached token
  if (cachedAccessToken && tokenExpiryDate) {
    const expiryTime = new Date(tokenExpiryDate).getTime();
    const now = Date.now();
    if (expiryTime > now) {
      console.log('Using cached access token');
      return cachedAccessToken;
    }
  }

  // Get new access token
  console.log('Fetching new access token from CJ');
  const response = await fetch(`${CJ_API_BASE_URL}/authentication/getAccessToken`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      apiKey: CJ_API_KEY
    })
  });

  const data = await response.json();
  
  if (!response.ok || !data.result) {
    console.error('Failed to get access token:', { status: response.status, data });
    throw new Error(`Failed to get CJ access token (${response.status}): ${data.message || 'Unknown error'}`);
  }

  cachedAccessToken = data.data.accessToken;
  tokenExpiryDate = data.data.accessTokenExpiryDate;
  
  console.log('Got new access token, expires:', tokenExpiryDate);
  return cachedAccessToken;
}

export const handler: Handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get the endpoint and method from the request body
    const { endpoint, body: requestBody, method = 'POST' } = JSON.parse(event.body || '{}');
    
    if (!endpoint) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Endpoint is required' })
      };
    }

    if (!CJ_API_KEY) {
      console.error('CJ_API_KEY not found in environment');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'CJ API key not configured' })
      };
    }

    // Get access token
    const accessToken = await getAccessToken();

    // Build URL with query params for GET requests
    let url = `${CJ_API_BASE_URL}/${endpoint}`;
    const fetchOptions: RequestInit = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'cj-access-token': accessToken
      }
    };

    if (method === 'GET' && requestBody && Object.keys(requestBody).length > 0) {
      // Convert body to query params for GET requests
      const params = new URLSearchParams();
      Object.entries(requestBody).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
      url += `?${params.toString()}`;
    } else if (method === 'POST') {
      // Include body for POST requests
      fetchOptions.body = JSON.stringify(requestBody || {});
    }

    console.log('CJ API Request:', { url, method, endpoint, hasToken: !!accessToken });

    // Make request to CJ API with access token
    const response = await fetch(url, fetchOptions);

    const data = await response.json();
    console.log('CJ API Response:', { status: response.status, ok: response.ok, success: data.result, message: data.message });

    return {
      statusCode: response.ok ? 200 : response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('CJ Proxy Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Failed to fetch from CJ API',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

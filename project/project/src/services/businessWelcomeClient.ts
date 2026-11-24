/** Retry transient delivery failures without holding up signup or dashboard loading. */
export async function requestBusinessWelcome(accessToken: string, onEmailed?: (emailed: boolean) => void): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch('/.netlify/functions/signup-welcome', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(15000),
      });
      if (response.ok) {
        if (onEmailed) {
          const result = await response.json();
          onEmailed(result.sent === true || result.reason === 'already_sent');
        }
        return true;
      }
      // Authentication failures need a fresh session rather than immediate retries.
      if (response.status < 500 && response.status !== 429) return false;
    } catch { /* A brief network interruption can be retried. */ }
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1500));
  }
  console.warn('[AuthContext] Welcome tutorial delivery pending; will retry on next visit');
  return false;
}

# Hosted signup confirmation

Set Supabase Authentication → Emails → Confirm sign up to the contents of
`confirmation.html`, with subject `Confirm your Beezio email`.

Keep Confirm email enabled and custom SMTP configured. The template opens
`/auth/verify` with a native token hash. Opening the page does not exchange the
token: the visitor must press **Confirm my email**. This prevents email previews
from consuming the single-use token. The page exchanges it with `verifyOtp` and
completes account setup only after a confirmed auth user is returned.

Legacy native and signed Beezio links remain supported. Invalid or expired links
show a native resend form, including when opened on a different device.

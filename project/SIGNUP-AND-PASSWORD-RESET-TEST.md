# Sign Up & Password Reset Test Guide

## Current Status Summary

✅ **Sign Up Flow** - Fully implemented
✅ **Password Reset Flow** - Fully implemented
⚠️ **Email Configuration** - Needs verification in Supabase

---

## Test 1: Sign Up Process

### Steps to Test Sign Up:

1. **Go to https://beezio.co**

2. **Click "Sign Up" or "Create Account"**
   - Should open the registration modal/page

3. **Fill in the registration form:**
   - **Account Type:** Select Buyer, Seller, or Affiliate
   - **Email:** Use a valid email you can access
   - **Password:** At least 6 characters
   - **Full Name:** Enter your name
   - **Phone:** (Optional)
   - **City/State/ZIP:** (Optional)

4. **Click "Create Account"**

5. **Expected Behavior:**
   - ✅ If email confirmation is **disabled** in Supabase:
     - You'll be automatically signed in
     - Redirected to appropriate dashboard (buyer/seller/affiliate)
   
   - ✅ If email confirmation is **enabled** in Supabase:
     - See message: "Account created! Please check your email to confirm your account before logging in."
     - Check your email for confirmation link
     - Click the confirmation link
     - Return to site and sign in

6. **Verify Dashboard Access:**
   - Buyer → `/dashboard/buyer`
   - Seller → `/dashboard/seller`
   - Affiliate → `/dashboard/affiliate`

### What Could Go Wrong:

❌ **"User already exists"** → Email already registered, use "Sign In" instead
❌ **"Email not confirmed"** → Check your email for confirmation link
❌ **Password too short** → Use at least 6 characters

---

## Test 2: Password Reset Process

### Steps to Test Password Reset:

#### Part A: Request Password Reset

1. **Go to https://beezio.co**

2. **Click "Sign In" or "Login"**

3. **Click "Forgot your password?"** link
   - Should switch to password reset mode

4. **Enter your email address**

5. **Click "Send Reset Email"**

6. **Expected Result:**
   - ✅ Success message: "Password reset email sent! Check your inbox."
   - ✅ Email arrives in your inbox (may take 1-2 minutes)

#### Part B: Reset Your Password

7. **Check your email**
   - Look for email from Supabase or Beezio
   - Subject: "Reset Your Password" or similar

8. **Click the reset link in the email**
   - Should redirect to: `https://beezio.co/reset-password`

9. **On the Reset Password page:**
   - You should be authenticated (no spinning, no error)
   - See form with:
     - "New password" field
     - "Confirm password" field
     - Password visibility toggle (eye icon)

10. **Enter your new password:**
    - Must be at least 6 characters
    - Enter same password in both fields

11. **Click "Update password"**

12. **Expected Result:**
    - ✅ Success message: "Password updated"
    - ✅ Green checkmark icon
    - ✅ Automatic redirect to home/dashboard after 2 seconds

13. **Sign in with new password** to verify it works

### What Could Go Wrong:

❌ **"You must be signed in to change your password"**
   - The reset link expired or wasn't clicked
   - Try requesting a new reset email

❌ **"Please use the password reset link from your email"**
   - You accessed `/reset-password` directly instead of clicking the email link
   - Check your email and click the link

❌ **"Passwords do not match"**
   - The two password fields don't match
   - Re-enter carefully

❌ **"Password must be at least 6 characters"**
   - Use a longer password

---

## Test 3: Magic Link Sign In (Alternative)

### Steps:

1. **Click "Sign In"**

2. **Enter your email**

3. **Click "Send Magic Link Instead"**

4. **Check your email for magic link**

5. **Click the magic link**

6. **Should be automatically signed in**

---

## Supabase Configuration Checklist

### ⚠️ Important: Verify these settings in your Supabase Dashboard

1. **Go to Supabase Dashboard → Authentication → URL Configuration**

2. **Redirect URLs - Make sure these are added:**
   ```
   http://localhost:5174/reset-password
   https://beezio.co/reset-password
   https://www.beezio.co/reset-password
   ```

3. **Email Templates → Reset Password:**
   - Make sure the reset link includes: `{{ .SiteURL }}/reset-password?token={{ .Token }}`

4. **Email Confirmation (Optional):**
   - Go to **Authentication → Providers → Email**
   - Toggle "Confirm email" based on your preference:
     - ✅ **Enabled:** Users must confirm email before signing in (more secure)
     - ❌ **Disabled:** Users can sign in immediately (faster signup)

---

## Known Issues & Solutions

### Issue: Reset link doesn't work
**Solution:** Add redirect URLs to Supabase (see checklist above)

### Issue: No email received
**Solutions:**
- Check spam folder
- Verify Supabase email settings are configured
- For production, consider setting up custom SMTP in Supabase

### Issue: "Email not confirmed" error
**Solution:** 
- Enable email confirmation in Supabase settings
- Or disable it for faster testing

### Issue: Can't access reset password page
**Solution:** 
- Must click the link from the email (contains authentication token)
- Cannot access `/reset-password` directly

---

## Code Files Involved

### Sign Up:
- `src/pages/SignUpPage.tsx` - Main signup page
- `src/components/AuthModal.tsx` - Modal signup form
- `src/contexts/AuthContextMultiRole.tsx` - Authentication logic

### Password Reset:
- `src/pages/ResetPasswordPage.tsx` - Password reset page
- `src/contexts/AuthContextMultiRole.tsx` - Reset password function (line 310-340)
- `src/components/AuthModal.tsx` - Forgot password link (line 350)

---

## Quick Test Checklist

- [ ] Can create new account (buyer)
- [ ] Can create new account (seller)
- [ ] Can create new account (affiliate)
- [ ] Can sign in after signup
- [ ] Can request password reset
- [ ] Receive reset email
- [ ] Can click reset link and access reset page
- [ ] Can update password successfully
- [ ] Can sign in with new password
- [ ] Magic link works as alternative

---

## Next Steps After Testing

1. ✅ **If everything works:** You're good to go!

2. ⚠️ **If email doesn't arrive:**
   - Check Supabase email settings
   - Set up custom SMTP for production (optional but recommended)
   - Check spam folder

3. ⚠️ **If reset link doesn't work:**
   - Verify redirect URLs in Supabase
   - Check browser console for errors
   - Make sure you're clicking the link from the email

Let me know what you find during testing!

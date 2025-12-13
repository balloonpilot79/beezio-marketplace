from pathlib import Path
path = Path('src/components/ImageUpload.tsx')
text = path.read_text(encoding='utf-8')
old = '''    if (!activeUserId) {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('Unable to resolve Supabase session for upload:', sessionError.message);
        onUploadError?.('Unable to verify your session. Please sign in again and retry.');
        return;
      }

      activeUserId = sessionData?.session?.user?.id || null;
    }

    if (!activeUserId) {
      console.error('No active user session found while uploading images');
      onUploadError?.('Please sign in before uploading product photos.');
      return;
    }
'''
new = '''    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error('Unable to resolve Supabase session for upload:', sessionError.message);
      onUploadError?.('Unable to verify your session. Please sign in again and retry.');
      return;
    }

    const accessToken = sessionData?.session?.access_token || null;
    if (!activeUserId) {
      activeUserId = sessionData?.session?.user?.id || null;
    }

    if (!activeUserId || !accessToken) {
      console.error('No active user session found while uploading images');
      onUploadError?.('Please sign in before uploading product photos.');
      return;
    }
'''
if old not in text:
    raise SystemExit('Target block not found for session handling')
text = text.replace(old.replace('\n', '\r\n'), new.replace('\n', '\r\n'), 1)
path.write_text(text, encoding='utf-8')

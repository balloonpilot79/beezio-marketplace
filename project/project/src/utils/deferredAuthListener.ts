import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

/** Never return asynchronous Supabase work to its lock-held auth callback. */
export function deferredAuthListener(handle: (event: AuthChangeEvent, session: Session | null) => Promise<void>) {
  const pending = new Set<ReturnType<typeof setTimeout>>();
  return {
    notify(event: AuthChangeEvent, session: Session | null): void {
      const timer = setTimeout(() => {
        pending.delete(timer);
        void handle(event, session);
      }, 0);
      pending.add(timer);
    },
    dispose() { pending.forEach(clearTimeout); pending.clear(); },
  };
}

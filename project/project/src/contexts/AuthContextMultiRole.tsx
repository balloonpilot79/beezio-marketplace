import {
  TAX_COMPLIANCE_VERSION,
  appendTaxAgreements,
  isTaxComplianceTableMissing,
  upsertTaxComplianceProfile,
} from '../services/taxCompliance';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { sendPasswordResetEmail } from '../services/transactionalEmailClient';
import { ensureProfileIdForUser } from '../utils/resolveProfileId';
import { buildDeterministicReferralCode } from '../utils/referralCode';
import { assignInfluencerReferral } from '../utils/influencerReferrals';
import {
  clearPendingRecruitAttributionForUser,
  getPendingRecruitAttributionsForUser,
} from '../utils/recruitAttribution';

const PENDING_SIGNUP_KEY = 'beezio-pending-signup-bootstrap';
const AUTH_RESTRICTION_KEY = 'beezio-auth-restriction';

type ActiveUserRestriction = {
  id: string;
  actionType: 'warning' | 'suspension' | 'ban' | 'restriction';
  reason: string;
  notes: string;
  expiresAt: string | null;
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any;
  userRoles: string[];
  currentRole: string;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string, userData: any) => Promise<any>;
  resendVerificationEmail: (email: string) => Promise<any>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<any>;
  sendMagicLink: (email: string) => Promise<any>;
  switchRole: (role: string) => Promise<boolean>;
  addRole: (role: string) => Promise<boolean>;
  hasRole: (role: string) => boolean;
  refreshProfile: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // During development/initialization, return a safe default to prevent crashes
    console.warn('useAuth called outside of AuthProvider or during initialization, returning safe defaults');
    return {
      user: null,
      session: null,
      profile: null,
      userRoles: [],
      currentRole: 'buyer',
      signIn: async () => ({ error: null }),
      signUp: async () => ({ error: null }),
      resendVerificationEmail: async () => ({ error: null }),
      signOut: async () => {},
      resetPassword: async () => ({ error: null }),
      sendMagicLink: async () => ({ error: null }),
      switchRole: async () => false,
      addRole: async () => false,
      hasRole: () => false,
      refreshProfile: async () => {},
      loading: true
    };
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [currentRole, setCurrentRole] = useState<string>('buyer');
  const ROLE_STORAGE_KEY = 'beezio-current-role';
  const [loading, setLoading] = useState(true);
  const PROFILE_FETCH_TIMEOUT_MS = 5000;
  const ROLE_FETCH_TIMEOUT_MS = 4000;
  const HYDRATION_DEDUPE_MS = 8000;
  const initialSessionHandledRef = useRef(false);
  const inflightProfileFetchRef = useRef<Promise<any> | null>(null);
  const inflightAuthHydrationRef = useRef<{ userId: string; promise: Promise<void> } | null>(null);
  const lastAuthHydrationAttemptRef = useRef<{ userId: string; at: number } | null>(null);
  const lastHydratedAuthRef = useRef<{ userId: string; at: number } | null>(null);
  const lastProfileTimeoutRef = useRef<number>(0);

  const storeRestrictionNotice = (userId: string, restriction: ActiveUserRestriction | null) => {
    try {
      if (!restriction) {
        localStorage.removeItem(AUTH_RESTRICTION_KEY);
        return;
      }
      localStorage.setItem(
        AUTH_RESTRICTION_KEY,
        JSON.stringify({
          userId,
          actionType: restriction.actionType,
          reason: restriction.reason,
          notes: restriction.notes,
          expiresAt: restriction.expiresAt,
          storedAt: Date.now(),
        })
      );
    } catch {
      // non-blocking
    }
  };

  const getStoredRestrictionNotice = () => {
    try {
      const raw = localStorage.getItem(AUTH_RESTRICTION_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as {
        userId: string;
        actionType: 'warning' | 'suspension' | 'ban' | 'restriction';
        reason: string;
        notes: string;
        expiresAt: string | null;
      };
    } catch {
      return null;
    }
  };

  // Add timeout to prevent infinite loading (allow more time for profile fetch)
  useEffect(() => {
    const timeout = setTimeout(() => {
      console.warn('AuthContext: Loading timeout reached (10s), setting loading to false');
      setLoading(false);
    }, 10000);

    return () => clearTimeout(timeout);
  }, []);

  // Fetch user roles from database
  const fetchUserRoles = async (userId: string) => {
    try {
      const { data: roles, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('is_active', true);
    
      if (error) {
        console.error('Error fetching user roles:', error);
        return [];
      }
    
      return roles?.map(r => r.role) || [];
    } catch (error) {
      console.error('Error fetching user roles:', error);
      return [];
    }
  };

  const fetchActiveUserRestriction = async (userId: string): Promise<ActiveUserRestriction | null> => {
    const uid = String(userId || '').trim();
    if (!uid) return null;

    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('user_moderation' as any)
      .select('id,action_type,reason,notes,expires_at')
      .eq('user_id', uid)
      .eq('is_active', true)
      .in('action_type', ['ban', 'suspension'])
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    const actionType = String((data as any)?.action_type || '').toLowerCase();
    if (actionType !== 'ban' && actionType !== 'suspension') return null;

    return {
      id: String((data as any)?.id || ''),
      actionType,
      reason: String((data as any)?.reason || '').trim(),
      notes: String((data as any)?.notes || '').trim(),
      expiresAt: (data as any)?.expires_at || null,
    };
  };
  const deriveRole = (profile: any) => profile?.primary_role || profile?.role || 'buyer';
  const getStoredRole = () => {
    try {
      return String(localStorage.getItem(ROLE_STORAGE_KEY) || '').toLowerCase();
    } catch {
      return '';
    }
  };

  const pickBestProfileRow = (rows: any[], authUserId: string, preferredRole?: string) => {
    const candidates = Array.isArray(rows) ? rows.filter(Boolean) : [];
    if (!candidates.length) return null;

    const normalizedPreferredRole = String(preferredRole || '').trim().toLowerCase();
    const normalizedStoredRole = getStoredRole();
    const roleRank = (row: any) => {
      const role = String(row?.primary_role || row?.role || '').trim().toLowerCase();
      if (normalizedPreferredRole && role === normalizedPreferredRole) return 5;
      if (normalizedStoredRole && role === normalizedStoredRole) return 4;
      if (role === 'seller') return 3;
      if (role === 'affiliate') return 2;
      if (role === 'influencer') return 1;
      return 0;
    };

    const exactUserIdMatches = candidates.filter((r) => String(r?.user_id || '') === String(authUserId));
    if (exactUserIdMatches.length > 0) {
      return exactUserIdMatches.sort((a, b) => roleRank(b) - roleRank(a))[0];
    }

    const exactIdMatches = candidates.filter((r) => String(r?.id || '') === String(authUserId));
    if (exactIdMatches.length > 0) {
      return exactIdMatches.sort((a, b) => roleRank(b) - roleRank(a))[0];
    }

    return candidates[0];
  };

  const PROFILE_SELECT_COLUMNS = [
    'id',
    'user_id',
    'email',
    'full_name',
    'phone',
    'city',
    'state',
    'zip_code',
    'country',
    'location',
    'role',
    'primary_role',
    'referral_code',
  ];
  const extractMissingColumnName = (message: string): string | null => {
    const msg = String(message || '');
    const pg = msg.match(/column\s+"([^"]+)"\s+of\s+relation\s+"[^"]+"\s+does\s+not\s+exist/i);
    if (pg?.[1]) return pg[1];
    const pgDot = msg.match(/column\s+([a-z0-9_]+\.[a-z0-9_]+)\s+does\s+not\s+exist/i);
    if (pgDot?.[1]) return pgDot[1].split('.').pop() || pgDot[1];
    const pgrst = msg.match(/Could not find the '([^']+)' column of '[^']+' in the schema cache/i);
    if (pgrst?.[1]) return pgrst[1];
    return null;
  };

  const isMissingColumnError = (error: any, columnName: string): boolean => {
    const message = [
      String((error as any)?.message || ''),
      String((error as any)?.details || ''),
      String((error as any)?.hint || ''),
    ].join(' ');
    const missing = extractMissingColumnName(message);
    return String(missing || '').trim() === columnName;
  };

  const selectProfilesFlexible = async (
    buildQuery: (columns: string) => any
  ): Promise<{ data: any; error: any; selected: string[] }> => {
    let selected = [...PROFILE_SELECT_COLUMNS];
    let lastError: any = null;

    for (let attempt = 0; attempt < PROFILE_SELECT_COLUMNS.length; attempt += 1) {
      const { data, error } = await buildQuery(selected.join(','));
      if (!error) return { data, error: null, selected };
      lastError = error;
      const missing = extractMissingColumnName(
        [
          String((error as any)?.message || ''),
          String((error as any)?.details || ''),
          String((error as any)?.hint || ''),
        ].join(' ')
      );
      if (missing && selected.includes(missing)) {
        selected = selected.filter((column) => column !== missing);
        continue;
      }
      break;
    }

    return { data: null, error: lastError, selected };
  };

  const ensureReferralCodeForProfile = async (profileId: string, existingCode?: string | null) => {
    const id = String(profileId || '').trim();
    if (!id) return '';
    if (String(existingCode || '').trim()) return String(existingCode).trim();

    const deterministic = buildDeterministicReferralCode(id);
    if (!deterministic) return '';

    try {
      await supabase
        .from('profiles')
        .update({ referral_code: deterministic })
        .eq('id', id)
        .is('referral_code', null);
    } catch (e) {
      console.warn('[AuthContext] ensureReferralCodeForProfile failed (non-fatal):', e);
    }
    return deterministic;
  };

  const applyPendingRecruitAttributionForUser = async (authUser: User, profileIdHint?: string | null) => {
    const authUserId = String(authUser?.id || '').trim();
    if (!authUserId) return;

    const pendingAssignments = getPendingRecruitAttributionsForUser(authUserId);
    if (!pendingAssignments.length) return;

    const targetProfileId =
      String(profileIdHint || '').trim() ||
      String(
        await ensureProfileIdForUser({
          id: authUser.id,
          email: authUser.email,
          user_metadata: authUser.user_metadata as any,
        })
      ).trim();
    if (!targetProfileId) return;

    try {
      for (const pending of pendingAssignments) {
        if (targetProfileId === pending.referrerProfileId) continue;
        const { data: existingRow } = await supabase
          .from('influencer_referrals')
          .select('influencer_profile_id')
          .eq('recruited_profile_id', targetProfileId)
          .eq('recruited_role', pending.recruitedRole)
          .maybeSingle();

        const existingReferrerId = String((existingRow as any)?.influencer_profile_id || '').trim();
        if (existingReferrerId) continue;

        await assignInfluencerReferral({
          recruitedProfileId: targetProfileId,
          recruitedRole: pending.recruitedRole,
          influencerProfileId: pending.referrerProfileId,
        });
      }

      clearPendingRecruitAttributionForUser(authUserId);
    } catch {
      // non-blocking; keep pending attribution for next auth refresh/sign-in
    }
  };

  const fetchProfileForUser = async (userId: string) => {
    const uid = String(userId || '').trim();
    if (!uid) return { profile: null, error: null };

    // Avoid duplicate in-flight requests.
    if (inflightProfileFetchRef.current) {
      try {
        const reused = await inflightProfileFetchRef.current;
        return reused as { profile: any; error: any };
      } catch (e) {
        // fall through to a fresh attempt
      }
    }

    const doFetch = (async () => {
      const preferredRole = getStoredRole();

      // First, prefer canonical ownership rows keyed by user_id. Some accounts have a buyer-style
      // row whose profiles.id equals auth.users.id plus a business row keyed by user_id.
      try {
        const byUserIdRaw = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', uid);
        if (!byUserIdRaw.error && Array.isArray(byUserIdRaw.data) && byUserIdRaw.data.length > 0) {
          return { profile: pickBestProfileRow(byUserIdRaw.data, uid, preferredRole), error: null };
        }
      } catch {
        // ignore
      }

      try {
        const byIdRaw = await supabase
          .from('profiles')
          .select('*')
          .eq('id', uid)
          .limit(1)
          .maybeSingle();
        if (!byIdRaw.error && byIdRaw.data) {
          return { profile: byIdRaw.data, error: null };
        }
        if (byIdRaw.error) {
          return { profile: null, error: byIdRaw.error };
        }
      } catch {
        // ignore
      }

      // Last resort: fall back to column-stripping reads for deployments where `select *`
      // is blocked but the narrower projection is allowed.
      try {
        const byUserId = await selectProfilesFlexible((columns) =>
          supabase
            .from('profiles')
            .select(columns)
            .eq('user_id', uid)
        );
        if (!byUserId.error && Array.isArray(byUserId.data) && byUserId.data.length > 0) {
          return { profile: pickBestProfileRow(byUserId.data, uid, preferredRole), error: null };
        }

        const byId = await selectProfilesFlexible((columns) =>
          supabase
            .from('profiles')
            .select(columns)
            .eq('id', uid)
            .maybeSingle()
        );
        if (!byId.error && byId.data) {
          return { profile: byId.data, error: null };
        }
        return { profile: null, error: byUserId.error || byId.error || null };
      } catch (e) {
        return { profile: null, error: e };
      }
    })();

    inflightProfileFetchRef.current = doFetch;
    try {
      return await doFetch;
    } finally {
      inflightProfileFetchRef.current = null;
    }
  };

  const backgroundFetchProfile = async (authUser: User, label: string) => {
    try {
      const preferredRole = getStoredRole();
      let refetch = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', authUser.id);

      let refetchProfile =
        !refetch.error && Array.isArray(refetch.data) && refetch.data.length > 0
          ? pickBestProfileRow(refetch.data, authUser.id, preferredRole)
          : null;

      if (!refetchProfile && (!refetch.error || isMissingColumnError(refetch.error, 'user_id'))) {
        refetch = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .limit(1)
          .maybeSingle();
        refetchProfile = refetch.data || null;
      }

      if (refetchProfile) {
        const safeRole = deriveRole(refetchProfile);
        setProfile({ ...refetchProfile, __is_fallback: false });
        setCurrentRole(safeRole);
        const roles = await fetchUserRoles(authUser.id);
        setUserRoles(roles.length > 0 ? roles : [safeRole]);
      }
    } catch (e) {
      console.warn(`AuthContext: ${label} background refetch failed:`, e);
    }
  };

  const ensureMinimalProfileExists = async (authUser: User) => {
    try {
      const { data: existing, error: existsError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (existsError && existsError.code !== 'PGRST116') {
        console.warn('[AuthContext] ensureMinimalProfileExists: profile lookup error:', existsError);
        return;
      }
      if (existing?.id) return;

      const email = authUser.email || '';
      const fallbackRole =
        (authUser.user_metadata as any)?.role ||
        (email === 'jason@beezio.co' || email === 'jasonlovingsr@gmail.com' || email === 'shop@beezio.co' ? 'admin' : 'buyer');

      // IMPORTANT: Do not force profiles.id to equal auth.users.id.
      // Some schemas use a separate profiles PK; we key off profiles.user_id for ownership.
      const { error: upsertError } = await supabase.from('profiles').upsert(
        {
          user_id: authUser.id,
          email: authUser.email,
          full_name: (authUser.user_metadata as any)?.full_name || (authUser.user_metadata as any)?.name || '',
          role: fallbackRole,
          primary_role: fallbackRole,
        },
        { onConflict: 'user_id' }
      );

      if (upsertError) {
        console.warn('[AuthContext] ensureMinimalProfileExists: upsert error:', upsertError);
      }
    } catch (e) {
      console.warn('[AuthContext] ensureMinimalProfileExists: unexpected error:', e);
    }
  };

  const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
    let timeoutHandle: number | undefined;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutHandle = window.setTimeout(() => {
        reject(new Error(`${label} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutHandle) window.clearTimeout(timeoutHandle);
    }
  };

  const getEmailVerificationRedirectUrl = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return origin ? `${origin}/auth/verify?flow=signup` : undefined;
  };

  const applyFallbackProfile = (authUser: User) => {
    const fallbackRole =
      (authUser.user_metadata as any)?.role ||
      (authUser.email === 'jason@beezio.co' || authUser.email === 'jasonlovingsr@gmail.com' || authUser.email === 'shop@beezio.co' ? 'admin' : 'buyer');
    // Do not assume profiles.id === auth.users.id (some schemas use a separate profiles PK).
    // Keep a minimal shape to unblock UI; write operations should resolve the canonical profile id.
    setProfile((prev: any) => {
      const preserved = prev && prev.user_id === authUser.id ? prev : {};
      return {
        ...preserved,
        // Many parts of the app (and common Supabase schemas) use profiles.id == auth.users.id.
        // Keeping `id` populated prevents downstream features from breaking when profile fetch times out.
        id: preserved?.id || authUser.id,
        user_id: authUser.id,
        email: authUser.email,
        role: fallbackRole,
        primary_role: fallbackRole,
        __is_fallback: true,
      };
    });
    setCurrentRole(fallbackRole);
    setUserRoles([fallbackRole]);
  };

  const refreshProfile = async () => {
    if (!user?.id) return;

    try {
      const result = await withTimeout(fetchProfileForUser(user.id), PROFILE_FETCH_TIMEOUT_MS, 'profiles.select (refresh)');
      const nextProfile = result?.profile || null;
      const error = (result as any)?.error || null;
      if (error && (error as any).code !== 'PGRST116') {
        console.warn('AuthContext: refreshProfile error:', error);
      }
      if (!nextProfile) return;

      const safeRole = deriveRole(nextProfile);
      setProfile({ ...nextProfile, __is_fallback: false });
      setCurrentRole(safeRole);
      const roles = await withTimeout(fetchUserRoles(user.id), ROLE_FETCH_TIMEOUT_MS, 'user_roles.select (refresh)');
      setUserRoles(roles.length > 0 ? roles : [safeRole]);
    } catch (e) {
      console.warn('AuthContext: refreshProfile timed out or failed:', e);
      // Keep existing profile in memory; do not clobber with fallback on refresh failures.
    }
  };

  const hydrateAuthenticatedSession = async (authUser: User, label: string) => {
    const userId = String(authUser?.id || '').trim();
    if (!userId) return;

    const now = Date.now();
    if (inflightAuthHydrationRef.current?.userId === userId) {
      await inflightAuthHydrationRef.current.promise;
      return;
    }

    const lastAttempt = lastAuthHydrationAttemptRef.current;
    if (lastAttempt?.userId === userId && now - lastAttempt.at < HYDRATION_DEDUPE_MS) {
      return;
    }

    const lastHydrated = lastHydratedAuthRef.current;
    if (lastHydrated?.userId === userId && now - lastHydrated.at < HYDRATION_DEDUPE_MS) {
      return;
    }

    lastAuthHydrationAttemptRef.current = { userId, at: now };
    const hydrationPromise = (async () => {
      applyFallbackProfile(authUser);
      setLoading(false);
      console.log(`AuthContext: ${label} - fetching profile for:`, userId);

      let nextProfile: any = null;
      let error: any = null;

      try {
        const result = await withTimeout(
          fetchProfileForUser(userId),
          PROFILE_FETCH_TIMEOUT_MS,
          `profiles.select (${label})`
        );
        nextProfile = result?.profile || null;
        error = (result as any)?.error || null;
      } catch (e) {
        const currentTime = Date.now();
        if (currentTime - lastProfileTimeoutRef.current > 10000) {
          console.warn(`AuthContext: ${label} profile fetch timed out or failed:`, e);
          lastProfileTimeoutRef.current = currentTime;
        }
        applyFallbackProfile(authUser);
        void (async () => {
          await ensureMinimalProfileExists(authUser);
          await backgroundFetchProfile(authUser, `profiles.select (${label})`);
        })();
        return;
      }

      if (error && (error as any).code !== 'PGRST116') {
        console.error(`AuthContext: ${label} profile error:`, error);
      }

      if (!nextProfile) {
        applyFallbackProfile(authUser);
        void (async () => {
          await ensureMinimalProfileExists(authUser);
          await backgroundFetchProfile(authUser, `profiles.select (${label})`);
        })();
        return;
      }

      const activeRestriction = await fetchActiveUserRestriction(userId);
      if (activeRestriction) {
        storeRestrictionNotice(userId, activeRestriction);
        setProfile({
          ...nextProfile,
          __is_fallback: false,
          access_status: activeRestriction.actionType,
          access_reason: activeRestriction.reason,
          access_expires_at: activeRestriction.expiresAt,
        });
        setUserRoles([]);
        setCurrentRole('buyer');
        await supabase.auth.signOut({ scope: 'local' });
        return;
      }

      storeRestrictionNotice(userId, null);

      const safeRole = deriveRole(nextProfile);
      setProfile({ ...nextProfile, __is_fallback: false });
      setCurrentRole(safeRole);
      void ensureReferralCodeForProfile(String(nextProfile.id || ''), nextProfile.referral_code);
      void applyPendingRecruitAttributionForUser(authUser, String(nextProfile.id || ''));

      const roles = await withTimeout(
        fetchUserRoles(userId),
        ROLE_FETCH_TIMEOUT_MS,
        `user_roles.select (${label})`
      );
      setUserRoles(roles.length > 0 ? roles : [safeRole]);
      lastHydratedAuthRef.current = { userId, at: Date.now() };
    })();

    inflightAuthHydrationRef.current = { userId, promise: hydrationPromise };
    try {
      await hydrationPromise;
    } finally {
      if (inflightAuthHydrationRef.current?.promise === hydrationPromise) {
        inflightAuthHydrationRef.current = null;
      }
    }
  };

  useEffect(() => {
    const getSession = async () => {
      try {
        console.log('AuthContext: Starting session fetch...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('AuthContext: Session error:', sessionError);
          setLoading(false);
          return;
        }
        
        console.log('AuthContext: Session loaded:', session?.user?.email || 'No user');
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await hydrateAuthenticatedSession(session.user, 'session bootstrap');
        }
        
        console.log('AuthContext: Loading complete');
        initialSessionHandledRef.current = true;
        setLoading(false);
      } catch (error) {
        console.error('AuthContext: Unexpected error in getSession:', error);
        initialSessionHandledRef.current = true;
        setLoading(false);
      }
    };

    getSession();

    // Handle auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          console.log('AuthContext: Auth state change:', event, session?.user?.email || 'No user');

          if (event === 'INITIAL_SESSION' && initialSessionHandledRef.current) {
            return;
          }
          if (event === 'SIGNED_IN' && !initialSessionHandledRef.current) {
            console.log('AuthContext: Skipping startup SIGNED_IN event; session bootstrap is still in progress');
            return;
          }
          
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session?.user) {
            await hydrateAuthenticatedSession(session.user, `auth change ${event.toLowerCase()}`);

            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
              console.log('AuthContext: User signed in successfully:', session.user.email);
            }
          } else {
            console.log('AuthContext: Auth state change - user signed out');
            setProfile(null);
            setUserRoles([]);
            setCurrentRole('buyer');
          }
          
          console.log('AuthContext: Auth state change complete, setting loading to false');
          setLoading(false);
        } catch (error) {
          console.error('AuthContext: Unexpected error in auth state change:', error);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const stored = getStoredRole();
    if (!stored) return;
    const normalizedRoles = userRoles.map((r) => String(r || '').toLowerCase());
    if (!normalizedRoles.includes(stored)) return;
    if (stored === String(currentRole || '').toLowerCase()) return;
    setCurrentRole(stored);
    setProfile((prev: any) => (prev ? { ...prev, primary_role: stored } : prev));
  }, [currentRole, getStoredRole, user, userRoles]);

  const signUp = async (email: string, password: string, userData: any) => {
    try {
      console.log('[AuthContext] Starting signUp for:', email);

      const initialRole = userData?.role || 'buyer';
      const fullName = userData?.fullName || '';
      const storeName = userData?.storeName || '';
      const storeSlug = userData?.storeSlug || userData?.store_subdomain || userData?.subdomain || '';
      const payoutEmail = String(userData?.paypalEmail || userData?.payoutEmail || '').trim();
      const payoutConfirmed = Boolean(userData?.paypalConfirmed || userData?.payoutConfirmed);
      const referrerProfileId = String(userData?.referrerProfileId || '').trim();
      const bundleBusinessRoles = Boolean(userData?.bundleBusinessRoles);
      const independentContractorAcknowledged = Boolean(userData?.independentContractorAcknowledged);
      const taxDeliveryAcknowledged = Boolean(userData?.taxDeliveryAcknowledged);

      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(
            PENDING_SIGNUP_KEY,
            JSON.stringify({
              email,
              role: initialRole,
              fullName,
              storeName,
              storeSlug,
              phone: userData.phone || '',
              streetAddress: userData.streetAddress || '',
              city: userData.city || '',
              state: userData.state || '',
              zipCode: userData.zipCode || '',
              paypalEmail: payoutEmail,
              paypalConfirmed: payoutConfirmed,
              referrerProfileId,
              bundleBusinessRoles,
              independentContractorAcknowledged,
              taxDeliveryAcknowledged,
              savedAt: Date.now(),
            })
          );
        }
      } catch {
        // non-blocking
      }
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: getEmailVerificationRedirectUrl(),
          data: {
            full_name: fullName,
            store_name: storeName,
            role: initialRole,
            primary_role: initialRole,
            store_slug: storeSlug,
            phone: userData.phone || null,
            street_address: userData.streetAddress || null,
            city: userData.city || null,
            state: userData.state || null,
            zip_code: userData.zipCode || null,
            paypal_email: payoutConfirmed ? payoutEmail : '',
            paypal_confirmed: payoutConfirmed,
            referrer_profile_id: referrerProfileId,
            bundle_business_roles: bundleBusinessRoles,
            independent_contractor_acknowledged: independentContractorAcknowledged,
            tax_delivery_acknowledged: taxDeliveryAcknowledged,
            tax_compliance_version: TAX_COMPLIANCE_VERSION,
          },
        },
      });

      if (error) {
        console.error('[AuthContext] SignUp error:', error);
        throw error;
      }

      if (data.user) {
        console.log('[AuthContext] User created:', data.user.id);
        try {
          if (typeof window !== 'undefined') {
            const rawPending = localStorage.getItem(PENDING_SIGNUP_KEY);
            if (rawPending) {
              const parsedPending = JSON.parse(rawPending);
              localStorage.setItem(
                PENDING_SIGNUP_KEY,
                JSON.stringify({
                  ...parsedPending,
                  userId: data.user.id,
                })
              );
            }
          }
        } catch {
          // non-blocking
        }
        
        // If Supabase returns a session immediately, load the profile for the
        // current UI. Email-confirmation signups continue without a session.
        console.log('[AuthContext] Loading profile created by signup trigger...');
        let profileData: any = null;
        let profileError: any = null;
        if (data.session) {
          const profileResult = await supabase
          .from('profiles')
          .select(PROFILE_SELECT_COLUMNS.join(','))
          .eq('user_id', data.user.id)
          .maybeSingle();
          profileData = profileResult.data;
          profileError = profileResult.error;
        }
        /* Removed legacy client-side profiles.insert path.
          .insert({
            id: data.user.id,              // ✅ FIXED: Added id column
            user_id: data.user.id,         // Also set user_id
            email,
            full_name: fullName,
            role: initialRole,             // Keep for backwards compatibility
            primary_role: initialRole,
            phone: userData.phone || null,
            bio: null,
            website: null,
            location: userData.city && userData.state ? `${userData.city}, ${userData.state}` : null,
            zip_code: userData.zipCode || null,
          })
          .select()
          .single();
        */

        if (profileError) {
          console.error('[AuthContext] Profile creation error:', profileError);
          // If profile already exists (from trigger), fetch it instead
          if (profileError.code === '23505') { // Unique constraint violation
            console.log('[AuthContext] Profile already exists, fetching...');
            const { data: existingProfile, error: fetchError } = await supabase
              .from('profiles')
              .select(PROFILE_SELECT_COLUMNS.join(','))
              .eq('id', data.user.id)
              .single();
            
            if (fetchError) {
              throw new Error(`Failed to fetch existing profile: ${fetchError.message}`);
            }

            setProfile(existingProfile);
            console.log('✅ Existing profile loaded:', existingProfile);
          } else {
            throw new Error(`Failed to create profile: ${profileError.message}`);
          }
        } else {
          // Immediately set the profile in context so Dashboard sees it
          if (profileData) {
            setProfile(profileData);
            console.log('✅ Profile created and loaded:', profileData);
          }
        }

        // Resolve canonical profile id only when the browser has a session.
        // For email-confirmation signups, the DB trigger handles setup.
        const profileId = data.session
          ? await ensureProfileIdForUser({
              id: data.user.id,
              email: data.user.email,
              user_metadata: data.user.user_metadata as any,
            })
          : String(data.user.id);
        if (profileId && data.session) {
          const ensuredCode = await ensureReferralCodeForProfile(profileId, (profileData as any)?.referral_code);
          if (ensuredCode) {
            setProfile((prev: any) => (prev?.id === profileId ? { ...prev, referral_code: ensuredCode } : prev));
          }
          try {
            await supabase.rpc('ensure_default_custom_stores_for_profile', { p_profile_id: profileId });
          } catch (storeBootstrapErr) {
            console.warn('[AuthContext] Default custom store bootstrap failed (non-fatal):', storeBootstrapErr);
          }
        }

        // Create store settings early so onboarding can be skipped when complete.
        try {
          const resolvedStoreName = storeName || (email.split('@')[0] || 'My Store');
          const resolvedSlug = String(storeSlug || '').trim();
          if (data.session && initialRole === 'seller') {
            await supabase.from('store_settings').upsert(
              {
                seller_id: profileId,
                store_name: resolvedStoreName,
                ...(resolvedSlug ? { subdomain: resolvedSlug } : {}),
              } as any,
              { onConflict: 'seller_id' }
            );
          }
          if (data.session && initialRole === 'affiliate') {
            await supabase.from('affiliate_store_settings').upsert(
              {
                affiliate_id: profileId,
                store_name: resolvedStoreName,
                ...(resolvedSlug ? { subdomain: resolvedSlug } : {}),
              } as any,
              { onConflict: 'affiliate_id' }
            );
          }
        } catch (storeErr) {
          console.warn('[AuthContext] Store settings upsert failed (non-fatal):', storeErr);
        }

        // Save payout email when provided.
        if (data.session && (initialRole === 'seller' || initialRole === 'affiliate' || initialRole === 'influencer') && payoutEmail && payoutConfirmed) {
          try {
            await supabase
              .from('paypal_accounts')
              .upsert(
                [
                  { user_id: profileId, role: 'SELLER', paypal_email: payoutEmail, is_verified: false },
                  { user_id: profileId, role: 'PARTNER', paypal_email: payoutEmail, is_verified: false },
                  { user_id: profileId, role: 'INFLUENCER', paypal_email: payoutEmail, is_verified: false },
                ] as any,
                { onConflict: 'user_id,role' }
              );

          } catch (payoutErr) {
            console.warn('[AuthContext] Payout email save/confirm failed (non-fatal):', payoutErr);
          }
        }

        if (data.session && !isBuyerAccount(initialRole)) {
          try {
            const agreementTime = new Date().toISOString();
            await upsertTaxComplianceProfile(profileId, {
              legal_name: fullName || null,
              delivery_email: email,
              street_address: String(userData.streetAddress || '').trim() || null,
              city: String(userData.city || '').trim() || null,
              state_region: String(userData.state || '').trim() || null,
              postal_code: String(userData.zipCode || '').trim() || null,
              country: 'US',
              tax_country: 'US',
              certification_name: fullName || null,
              independent_contractor_ack_at: independentContractorAcknowledged ? agreementTime : null,
              independent_contractor_version: independentContractorAcknowledged ? TAX_COMPLIANCE_VERSION : null,
              electronic_delivery_ack_at: taxDeliveryAcknowledged ? agreementTime : null,
            });
            await appendTaxAgreements(
              [
                independentContractorAcknowledged
                  ? {
                      user_id: profileId,
                      agreement_type: 'independent_contractor' as const,
                      document_version: TAX_COMPLIANCE_VERSION,
                      details: { source: 'signup' },
                    }
                  : null,
                taxDeliveryAcknowledged
                  ? {
                      user_id: profileId,
                      agreement_type: 'electronic_delivery' as const,
                      document_version: TAX_COMPLIANCE_VERSION,
                      details: { source: 'signup' },
                    }
                  : null,
              ].filter(Boolean) as any
            );
          } catch (taxErr) {
            if (!isTaxComplianceTableMissing(taxErr)) {
              console.warn('[AuthContext] Tax compliance save failed (non-fatal):', taxErr);
            }
          }
        }

        // Add initial role to user_roles table
        const rolesToAdd = [initialRole];
        
        // Insert all roles
        const roleInserts = rolesToAdd.map(role => ({
          user_id: data.user?.id,
          role: role,
          is_active: true
        }));
        
        if (data.session) {
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert(roleInserts);

          if (roleError) {
            console.error('Role creation error:', roleError);
            // Don't throw here, profile was created successfully
          }
        }

      }

      return data;
    } catch (error) {
      console.error('SignUp error:', error);
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log('[AuthContext] Starting signIn with timeout protection...');
      
      const signInPromise = supabase.auth.signInWithPassword({
        email,
        password,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Sign in timeout - please check your internet connection')), 30000)
      );

      const { data, error } = await Promise.race([signInPromise, timeoutPromise]) as any;

      if (error) {
        console.error('[AuthContext] SignIn error:', error);
        throw error;
      }

      if (data?.user) {
        await hydrateAuthenticatedSession(data.user, 'direct sign-in');
        const restrictionNotice = getStoredRestrictionNotice();
        if (restrictionNotice?.userId === data.user.id) {
          const expiryText = restrictionNotice.expiresAt
            ? ` Access returns after ${new Date(restrictionNotice.expiresAt).toLocaleString()}.`
            : '';
          throw new Error(
            `${restrictionNotice.actionType === 'ban' ? 'Account banned.' : 'Account suspended.'} ${restrictionNotice.reason || 'Please contact support.'}${expiryText}`.trim()
          );
        }
      }
      
      console.log('[AuthContext] SignIn successful');
      return data;
    } catch (error) {
      console.error('SignIn error:', error);
      throw error;
    }
  };

  const resendVerificationEmail = async (email: string) => {
    try {
      const trimmedEmail = String(email || '').trim();
      if (!trimmedEmail) {
        throw new Error('Email address is required.');
      }

      const { data, error } = await supabase.auth.resend({
        type: 'signup',
        email: trimmedEmail,
        options: {
          emailRedirectTo: getEmailVerificationRedirectUrl(),
        },
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Resend verification email error:', error);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const redirectUrl = origin ? `${origin}/reset-password` : '/reset-password';
      console.log('Sending password reset email to:', email, 'with redirect to:', redirectUrl);

      // IMPORTANT: For password reset to work properly, you must configure the redirect URLs in Supabase:
      // Go to Supabase Dashboard > Authentication > URL Configuration > Redirect URLs
      // Add: http://localhost:5174/reset-password (for local development)
      // Add: https://yourdomain.com/reset-password (for production)
      // Without this, the reset link may not redirect properly and users will just get logged in without being able to change their password.
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        console.error('Supabase resetPasswordForEmail error:', error);
        throw error;
      }

      // Optional custom Beezio-branded password reset email (skip if profile lookup fails).
      try {
        const { data: userData } = await supabase
          .from('profiles')
          .select('user_id, email')
          .eq('email', email)
          .maybeSingle();
        if (userData?.user_id) {
          const emailSent = await sendPasswordResetEmail(userData.user_id, email, { resetUrl: redirectUrl });
          if (!emailSent) {
            console.warn('Failed to send custom password reset email, but Supabase email was sent');
          }
        }
      } catch (emailErr) {
        console.warn('Custom reset email failed (non-blocking):', emailErr);
      }

      console.log('Password reset email sent successfully to:', email);
      return { success: true };
    } catch (error) {
      console.error('Reset password error:', error);
      throw error;
    }
  };

  const sendMagicLink = async (email: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
        },
      });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Magic link error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      console.log('Starting sign out process...');

      // Clear local state first
      setUser(null);
      setSession(null);
      setProfile(null);
      setUserRoles([]);
      setCurrentRole('buyer');

      // Clear ALL localStorage completely on logout
      localStorage.clear();
      
      // Clear session storage
      sessionStorage.clear();

      // Call Supabase signOut
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Supabase signOut error:', error);
        // Continue with logout even if Supabase signOut fails
      }

      console.log('Sign out successful - ALL data cleared, user logged out');

    } catch (error) {
      console.error('Sign out error:', error);
      // Even if there's an error, clear everything
      setUser(null);
      setSession(null);
      setProfile(null);
      setUserRoles([]);
      setCurrentRole('buyer');
      localStorage.clear();
      sessionStorage.clear();
    }
  };

  const switchRole = async (role: string) => {
    const normalizedTarget = String(role || '').toLowerCase();
    if (!user) {
      return false;
    }

    try {
      // Optimistically update local state so UI switches immediately.
      setCurrentRole(role);
      setProfile((prev: any) => (prev ? { ...prev, primary_role: role } : prev));
      setUserRoles((prev) => (prev.includes(normalizedTarget) ? prev : [...prev, normalizedTarget]));
      try {
        localStorage.setItem(ROLE_STORAGE_KEY, normalizedTarget);
      } catch {
        // ignore
      }

      // Update primary role in database
      const { error } = await supabase
        .from('profiles')
        .update({ 
          primary_role: role,
          updated_at: new Date().toISOString()
        })
        .or(`user_id.eq.${user.id},id.eq.${user.id}`);

      if (error) {
        console.error('Error switching role:', error);
        return true;
      }

      return true;
    } catch (error) {
      console.error('Error switching role:', error);
      return true;
    }
  };

  const addRole = async (role: string) => {
    const normalizedRole = String(role || '').toLowerCase();
    if (!user || !normalizedRole || userRoles.map((r) => String(r || '').toLowerCase()).includes(normalizedRole)) {
      return false;
    }

    try {
      // Add role to user_roles table
      const { error } = await supabase
        .from('user_roles')
        .upsert(
          {
            user_id: user.id,
            role: normalizedRole,
            is_active: true
          } as any,
          { onConflict: 'user_id,role' }
        );

      if (error) {
        console.error('Error adding role:', error);
        return false;
      }

      // Update local state
      setUserRoles((prev) => (prev.includes(normalizedRole) ? prev : [...prev, normalizedRole]));

      if (normalizedRole === 'seller' || normalizedRole === 'affiliate') {
        const currentProfileId = String((profile as any)?.id || '').trim() || user.id;
        const recruitedByInfluencerId = String((profile as any)?.recruited_by_influencer_id || '').trim();
        if (currentProfileId && recruitedByInfluencerId && currentProfileId !== recruitedByInfluencerId) {
          try {
            await assignInfluencerReferral({
              recruitedProfileId: currentProfileId,
              recruitedRole: normalizedRole as 'seller' | 'affiliate',
              influencerProfileId: recruitedByInfluencerId,
            });
          } catch (referralError) {
            console.warn('[AuthContext] addRole influencer referral attachment failed (non-fatal):', referralError);
          }
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error adding role:', error);
      return false;
    }
  };

  const hasRole = (role: string) => {
    return userRoles.includes(role);
  };

  const value = {
    user,
    session,
    profile,
    userRoles,
    currentRole,
    signIn,
    signUp,
    resendVerificationEmail,
    signOut,
    resetPassword,
    sendMagicLink,
    switchRole,
    addRole,
    hasRole,
    refreshProfile,
    loading
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../services/emailService';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any;
  userRoles: string[];
  currentRole: string;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string, userData: any) => Promise<any>;
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
  const [loading, setLoading] = useState(true);

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
  const deriveRole = (profile: any) => profile?.primary_role || profile?.role || 'buyer';

  const pickBestProfileRow = (rows: any[], authUserId: string) => {
    const candidates = Array.isArray(rows) ? rows.filter(Boolean) : [];
    if (!candidates.length) return null;

    const withStripe = candidates.find((r) => String(r?.stripe_account_id || '').trim().length > 0);
    if (withStripe) return withStripe;

    const exactId = candidates.find((r) => String(r?.id || '') === String(authUserId));
    if (exactId) return exactId;

    const exactUserId = candidates.find((r) => String(r?.user_id || '') === String(authUserId));
    if (exactUserId) return exactUserId;

    return candidates[0];
  };

  const PROFILE_SELECT = 'id,user_id,email,role,primary_role,stripe_account_id';

  const fetchProfileRowsForUser = async (authUserId: string, label: string) => {
    const fetchBy = async (column: 'id' | 'user_id', timeoutMs: number) => {
      return withTimeout(
        supabase
          .from('profiles')
          .select(PROFILE_SELECT)
          .eq(column, authUserId)
          .limit(10),
        timeoutMs,
        `${label} profiles.select by ${column}`
      );
    };

    // Avoid `.or(id.eq...,user_id.eq...)` which can force slow plans on large tables.
    // Try primary key first (fast), then fall back to user_id.
    const byId = await fetchBy('id', 12000);
    const rowsId = (byId as any)?.data;
    if (Array.isArray(rowsId) && rowsId.length) return rowsId;

    const byUserId = await fetchBy('user_id', 20000);
    const rowsUserId = (byUserId as any)?.data;
    if (Array.isArray(rowsUserId) && rowsUserId.length) return rowsUserId;

    return Array.isArray(rowsId) ? rowsId : Array.isArray(rowsUserId) ? rowsUserId : [];
  };

  const backgroundFetchProfile = async (authUser: User, label: string) => {
    try {
      const refetch = await supabase
        .from('profiles')
        .select(PROFILE_SELECT)
        .eq('user_id', authUser.id)
        .limit(1)
        .maybeSingle();

      if (refetch?.data) {
        const safeRole = deriveRole(refetch.data);
        setProfile({ ...refetch.data, __is_fallback: false });
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
        (email === 'jason@beezio.co' || email === 'jasonlovingsr@gmail.com' ? 'admin' : 'buyer');

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

  const applyFallbackProfile = (authUser: User) => {
    const fallbackRole =
      (authUser.user_metadata as any)?.role ||
      (authUser.email === 'jason@beezio.co' || authUser.email === 'jasonlovingsr@gmail.com' ? 'admin' : 'buyer');
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
      const result = await withTimeout(
        supabase
          .from('profiles')
          .select(PROFILE_SELECT)
          .or(`id.eq.${user.id},user_id.eq.${user.id}`)
          .limit(10),
        20000,
        'profiles.select (refresh)'
      );

      const nextRows = (result as any).data;
      const error = (result as any).error;
      if (error && error.code !== 'PGRST116') {
        console.warn('AuthContext: refreshProfile error:', error);
      }
      const nextProfile = Array.isArray(nextRows) ? pickBestProfileRow(nextRows, user.id) : nextRows;
      if (!nextProfile) return;

      const safeRole = deriveRole(nextProfile);
      setProfile({ ...nextProfile, __is_fallback: false });
      setCurrentRole(safeRole);
      const roles = await fetchUserRoles(user.id);
      setUserRoles(roles.length > 0 ? roles : [safeRole]);
    } catch (e) {
      console.warn('AuthContext: refreshProfile timed out or failed:', e);
      // Keep existing profile in memory; do not clobber with fallback on refresh failures.
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
          console.log('AuthContext: Fetching profile for user:', session.user.id);
          // Fetch profile
          let profile: any = null;
          let error: any = null;
          try {
            const rows = await fetchProfileRowsForUser(session.user.id, 'getSession');
            error = null;
            profile = pickBestProfileRow(rows, session.user.id);
          } catch (e) {
            console.warn('AuthContext: Profile fetch timed out or failed:', e);
            // Don't block UI on DB fetch. Apply a fallback role immediately.
            applyFallbackProfile(session.user);
            // Best-effort background repair/refetch.
            void (async () => {
              await ensureMinimalProfileExists(session.user);
              await backgroundFetchProfile(session.user, 'profiles.select');
            })();
            console.log('AuthContext: Loading complete (fallback profile)');
            setLoading(false);
            return;
          }
          
          if (error && error.code !== 'PGRST116') {
            console.error('AuthContext: Error fetching profile:', error);
          }

          // Legacy accounts may be missing a profiles row; create it and refetch.
            if (!profile) {
              // Apply fallback immediately, then attempt a DB repair in the background.
              applyFallbackProfile(session.user);
              void (async () => {
                await ensureMinimalProfileExists(session.user);
                 const refetchRows = await fetchProfileRowsForUser(session.user.id, 'getSession refetch');
                 const refetchProfile = pickBestProfileRow(refetchRows, session.user.id);
                 if (refetchProfile) {
                   const safeRole = deriveRole(refetchProfile);
                   setProfile({ ...refetchProfile, __is_fallback: false });
                  setCurrentRole(safeRole);
                  const roles = await fetchUserRoles(session.user.id);
                  setUserRoles(roles.length > 0 ? roles : [safeRole]);
                }
              })();
              console.log('AuthContext: Loading complete (fallback profile)');
              setLoading(false);
              return;
            }
          
          console.log('AuthContext: Profile loaded:', profile ? 'Yes' : 'No');
          if (profile) {
            const safeRole = deriveRole(profile);
            setProfile({ ...profile, __is_fallback: false });
            setCurrentRole(safeRole);
            
            // Fetch user roles
            const roles = await fetchUserRoles(session.user.id);
            setUserRoles(roles.length > 0 ? roles : [safeRole]);
            console.log('AuthContext: User roles:', roles);
          } else {
            console.log('AuthContext: No profile found, user may need to complete profile');
            applyFallbackProfile(session.user);
          }
        }
        
        console.log('AuthContext: Loading complete');
        setLoading(false);
      } catch (error) {
        console.error('AuthContext: Unexpected error in getSession:', error);
        setLoading(false);
      }
    };

    getSession();

    // Handle auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          console.log('AuthContext: Auth state change:', event, session?.user?.email || 'No user');
          
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session?.user) {
            console.log('AuthContext: Auth state change - fetching profile for:', session.user.id);
            // Fetch profile
            let profile: any = null;
            let error: any = null;
             try {
              const rows = await fetchProfileRowsForUser(session.user.id, 'auth change');
              error = null;
              profile = pickBestProfileRow(rows, session.user.id);
            } catch (e) {
              console.warn('AuthContext: Auth change profile fetch timed out or failed:', e);
              applyFallbackProfile(session.user);
              void backgroundFetchProfile(session.user, 'profiles.select (auth change)');
              setLoading(false);
              return;
            }
            
            if (error && error.code !== 'PGRST116') {
              console.error('AuthContext: Auth state change - profile error:', error);
            }

            if (!profile) {
              applyFallbackProfile(session.user);
              void (async () => {
                await ensureMinimalProfileExists(session.user);
                await backgroundFetchProfile(session.user, 'profiles.select (auth change)');
              })();
              setLoading(false);
              return;
            }
            
            if (profile) {
              const safeRole = deriveRole(profile);
              console.log('AuthContext: Auth state change - profile loaded for role:', safeRole);
              setProfile({ ...profile, __is_fallback: false });
              setCurrentRole(safeRole);
              
              // Fetch user roles
              const roles = await fetchUserRoles(session.user.id);
              setUserRoles(roles.length > 0 ? roles : [safeRole]);
            } else {
              console.log('AuthContext: Auth state change - no profile found');
              applyFallbackProfile(session.user);
            }

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

  const signUp = async (email: string, password: string, userData: any) => {
    try {
      console.log('[AuthContext] Starting signUp for:', email);

      const initialRole = userData?.role || 'buyer';
      const fullName = userData?.fullName || '';
      const storeName = userData?.storeName || '';
      const referralCode = String(userData?.referralCode || userData?.referral_code || '').trim();

      const attachRecruiter = async (profileId: string) => {
        const cleaned = referralCode.trim();
        if (!cleaned) return;
        if (!profileId) return;

        try {
          const { data: recruiter } = await supabase
            .from('profiles')
            .select('id, primary_role, role')
            .or(`referral_code.ilike.${cleaned},username.ilike.${cleaned},id.eq.${cleaned}`)
            .maybeSingle();

          const recruiterId = recruiter?.id ? String((recruiter as any).id) : '';
          if (!recruiterId || recruiterId === profileId) return;

          const recruiterRole = String((recruiter as any)?.primary_role || (recruiter as any)?.role || '').toLowerCase();
          if (recruiterRole !== 'affiliate' && recruiterRole !== 'fundraiser') return;

          try {
            await supabase
              .from('profiles')
              .update({ referred_by_affiliate_id: recruiterId, referral_code_used: cleaned } as any)
              .eq('id', profileId)
              .is('referred_by_affiliate_id', null);
          } catch {
            await supabase
              .from('profiles')
              .update({ referred_by_affiliate_id: recruiterId } as any)
              .eq('id', profileId)
              .is('referred_by_affiliate_id', null);
          }
        } catch {
          // non-fatal
        }
      };
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            store_name: storeName,
            role: initialRole,
          },
        },
      });

      if (error) {
        console.error('[AuthContext] SignUp error:', error);
        throw error;
      }

      if (data.user) {
        console.log('[AuthContext] User created:', data.user.id);
        
        // Wait for auth system to fully propagate
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Create profile with BOTH id and user_id
        console.log('[AuthContext] Creating profile...');
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
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

        if (profileError) {
          console.error('[AuthContext] Profile creation error:', profileError);
          // If profile already exists (from trigger), fetch it instead
          if (profileError.code === '23505') { // Unique constraint violation
            console.log('[AuthContext] Profile already exists, fetching...');
            const { data: existingProfile, error: fetchError } = await supabase
              .from('profiles')
              .select(PROFILE_SELECT)
              .eq('id', data.user.id)
              .single();
            
            if (fetchError) {
              throw new Error(`Failed to fetch existing profile: ${fetchError.message}`);
            }
            
            await attachRecruiter(String((existingProfile as any)?.id || data.user.id)).catch(() => {});
            setProfile(existingProfile);
            console.log('✅ Existing profile loaded:', existingProfile);
          } else {
            throw new Error(`Failed to create profile: ${profileError.message}`);
          }
        } else {
          // Immediately set the profile in context so Dashboard sees it
          if (profileData) {
            await attachRecruiter(String((profileData as any)?.id || data.user.id)).catch(() => {});
            setProfile(profileData);
            console.log('✅ Profile created and loaded:', profileData);
          }
        }

        // Add initial role to user_roles table
        const rolesToAdd = [initialRole];
        
        // If user is a fundraiser, automatically add seller and affiliate roles
        if (initialRole === 'fundraiser') {
          rolesToAdd.push('seller', 'affiliate');
        }
        
        // Insert all roles
        const roleInserts = rolesToAdd.map(role => ({
          user_id: data.user?.id,
          role: role,
          is_active: true
        }));
        
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert(roleInserts);

        if (roleError) {
          console.error('Role creation error:', roleError);
          // Don't throw here, profile was created successfully
        }

        // Send welcome email
        try {
          await sendWelcomeEmail(
            data.user.id,
            email,
            userData.fullName || email.split('@')[0]
          );
          console.log('Welcome email sent successfully');
        } catch (emailError) {
          console.error('Error sending welcome email:', emailError);
          // Don't throw here, user account was created successfully
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
      
      console.log('[AuthContext] SignIn successful');
      return data;
    } catch (error) {
      console.error('SignIn error:', error);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      // First, check if user exists
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('user_id, email')
        .eq('email', email)
        .single();

      if (userError || !userData) {
        // For security, don't reveal if email exists or not
        // Just return success to prevent email enumeration
        console.log('Password reset requested for non-existent email:', email);
        return { success: true };
      }

      const redirectUrl = '/reset-password';
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

      // Also send our custom Beezio-branded password reset email
      // Note: In production, you'd configure Supabase to use custom SMTP to avoid duplicate emails
      const emailSent = await sendPasswordResetEmail(userData.user_id, email, { resetUrl: redirectUrl });

      if (!emailSent) {
        console.warn('Failed to send custom password reset email, but Supabase email was sent');
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
    if (!user || !userRoles.includes(role)) {
      return false;
    }

    try {
      // Update primary role in database
      const { error } = await supabase
        .from('profiles')
        .update({ 
          primary_role: role,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error switching role:', error);
        return false;
      }

      // Update local state
      setCurrentRole(role);
      setProfile({ ...profile, primary_role: role });
      
      return true;
    } catch (error) {
      console.error('Error switching role:', error);
      return false;
    }
  };

  const addRole = async (role: string) => {
    if (!user || userRoles.includes(role)) {
      return false;
    }

    try {
      // Add role to user_roles table
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: role,
          is_active: true
        });

      if (error) {
        console.error('Error adding role:', error);
        return false;
      }

      // Update local state
      setUserRoles([...userRoles, role]);
      
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

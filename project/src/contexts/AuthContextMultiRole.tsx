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

  // Add timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      console.warn('AuthContext: Loading timeout reached (5s), setting loading to false');
      setLoading(false);
    }, 5000); // 5 second timeout (reduced from 10s)

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
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle();
          
          if (error && error.code !== 'PGRST116') {
            console.error('AuthContext: Error fetching profile:', error);
          }
          
          console.log('AuthContext: Profile loaded:', profile ? 'Yes' : 'No');
          if (profile) {
            setProfile(profile);
            setCurrentRole(profile.primary_role || profile.role || 'buyer');
            
            // Fetch user roles
            const roles = await fetchUserRoles(session.user.id);
            setUserRoles(roles.length > 0 ? roles : [profile.primary_role || profile.role || 'buyer']);
            console.log('AuthContext: User roles:', roles);
          } else {
            console.log('AuthContext: No profile found, user may need to complete profile');
            setProfile(null);
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
            const { data: profile, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('user_id', session.user.id)
              .maybeSingle();
            
            if (error && error.code !== 'PGRST116') {
              console.error('AuthContext: Auth state change - profile error:', error);
            }
            
            if (profile) {
              console.log('AuthContext: Auth state change - profile loaded for role:', profile.role);
              setProfile(profile);
              setCurrentRole(profile.primary_role || profile.role || 'buyer');
              
              // Fetch user roles
              const roles = await fetchUserRoles(session.user.id);
              setUserRoles(roles.length > 0 ? roles : [profile.primary_role || profile.role || 'buyer']);
            } else {
              console.log('AuthContext: Auth state change - no profile found');
              setProfile(null);
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
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        console.error('[AuthContext] SignUp error:', error);
        throw error;
      }

      if (data.user) {
        console.log('[AuthContext] User created:', data.user.id);
        
        // Wait for auth system to fully propagate
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const initialRole = userData.role || 'buyer';
        
        // Create profile with BOTH id and user_id
        console.log('[AuthContext] Creating profile...');
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,              // ✅ FIXED: Added id column
            user_id: data.user.id,         // Also set user_id
            email,
            full_name: userData.fullName || '',
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
              .select('*')
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
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
    loading
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

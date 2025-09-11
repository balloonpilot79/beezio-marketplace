import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { sendWelcomeEmail } from '../services/emailService';

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
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Fetch profile
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .maybeSingle();
        
        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching profile:', error);
        }
        
        if (profile) {
          setProfile(profile);
          setCurrentRole(profile.primary_role || profile.role || 'buyer');
          
          // Fetch user roles
          const roles = await fetchUserRoles(session.user.id);
          setUserRoles(roles.length > 0 ? roles : [profile.primary_role || profile.role || 'buyer']);
        }
      }
      
      setLoading(false);
    };

    getSession();

    // Handle auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.email);
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch profile
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle();
          
          if (error && error.code !== 'PGRST116') {
            console.error('Error fetching profile:', error);
          }
          
          if (profile) {
            setProfile(profile);
            setCurrentRole(profile.primary_role || profile.role || 'buyer');
            
            // Fetch user roles
            const roles = await fetchUserRoles(session.user.id);
            setUserRoles(roles.length > 0 ? roles : [profile.primary_role || profile.role || 'buyer']);
          }

          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            console.log('User signed in:', session.user.email);
          }
        } else {
          setProfile(null);
          setUserRoles([]);
          setCurrentRole('buyer');
        }
        
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, userData: any) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Wait a moment for the user to be fully created in auth
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const initialRole = userData.role || 'buyer';
        
        // Create profile with primary role
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: data.user.id,
            email,
            full_name: userData.fullName || '',
            role: initialRole, // Keep for backwards compatibility
            primary_role: initialRole,
            phone: userData.phone || null,
            bio: null,
            website: null,
            location: userData.city && userData.state ? `${userData.city}, ${userData.state}` : null,
            zip_code: userData.zipCode || null,
          });

        if (profileError) {
          console.error('Profile creation error:', profileError);
          throw new Error(`Failed to create profile: ${profileError.message}`);
        }

        // Add initial role to user_roles table
        const rolesToAdd = [initialRole];
        
        // If user is a fundraiser, automatically add seller and affiliate roles
        if (initialRole === 'fundraiser') {
          rolesToAdd.push('seller', 'affiliate');
        }
        
        // Insert all roles
        const roleInserts = rolesToAdd.map(role => ({
          user_id: data.user.id,
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

  const signOut = async () => {
    try {
      console.log('Starting sign out process...');

      // Clear local state first
      setUser(null);
      setSession(null);
      setProfile(null);
      setUserRoles([]);
      setCurrentRole('buyer');

      // Clear all Supabase-related storage
      localStorage.removeItem('supabase.auth.token');
      localStorage.removeItem('sb-yemgssttxhkgrivuodbz-auth-token');

      // Clear any other auth-related localStorage keys
      Object.keys(localStorage).forEach(key => {
        if (key.includes('supabase') || key.includes('auth')) {
          localStorage.removeItem(key);
        }
      });

      sessionStorage.clear();

      // Call Supabase signOut
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Supabase signOut error:', error);
        // Continue with logout even if Supabase signOut fails
      }

      console.log('Sign out successful - redirecting...');

      // Use React Router navigation instead of window.location.href for better SPA behavior
      window.location.href = '/';

    } catch (error) {
      console.error('Error during sign out:', error);

      // Force cleanup even on error
      setUser(null);
      setSession(null);
      setProfile(null);
      setUserRoles([]);
      setCurrentRole('buyer');
      localStorage.clear();
      sessionStorage.clear();

      // Still redirect even on error
      window.location.href = '/';
    }
  };

  const resetPassword = async (email: string) => {
    let redirectUrl;

    if (window.location.hostname === 'localhost') {
      // Use current port for localhost
      redirectUrl = `${window.location.origin}/reset-password`;
    } else if (window.location.hostname.includes('beezio.co')) {
      redirectUrl = 'https://beezio.co/reset-password';
    } else {
      redirectUrl = `${window.location.origin}/reset-password`;
    }
    }
      
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Reset password error:', error);
      throw error;
    }
  };

  const sendMagicLink = async (email: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithOtp({ 
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Magic link error:', error);
      throw error;
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

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string, userData: any) => Promise<any>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<any>;
  sendMagicLink: (email: string) => Promise<any>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .maybeSingle();
        
        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching profile:', error);
        }
        setProfile(profile);
      }
      
      setLoading(false);
    };

    getSession();

        // Handle auth state changes (including magic link returns)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.email);
        console.log('Current user before change:', user?.email);
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch or create user profile
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle();
          
          if (error && error.code !== 'PGRST116') {
            console.error('Error fetching profile:', error);
          }
          setProfile(profile);

          // Handle successful login/signup events
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            // Let the AuthModal handle the redirect instead of doing it here
            console.log('User signed in:', session.user.email);
          }
        } else {
          // User signed out
          console.log('User signed out, clearing profile');
          setProfile(null);
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
        
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: data.user.id,
            email,
            full_name: userData.fullName || '',
            role: userData.role || 'buyer',
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
      
      // Clear the Supabase session
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Supabase signOut error:', error);
        throw error;
      }
      
      // Clear local state
      setUser(null);
      setSession(null);
      setProfile(null);
      
      // Clear any localStorage/sessionStorage items
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.clear();
      
      // Force page reload to clear all state
      window.location.href = '/';
      
      console.log('Sign out successful');
    } catch (error) {
      console.error('Error during sign out:', error);
      // Even if there's an error, clear local state
      setUser(null);
      setSession(null);
      setProfile(null);
      window.location.href = '/';
    }
  };

  const resetPassword = async (email: string) => {
    // Determine the correct redirect URL based on environment
    let redirectUrl;
    
    if (window.location.hostname === 'localhost') {
      // Development environment
      redirectUrl = 'http://localhost:5173/reset-password';
    } else if (window.location.hostname.includes('beezio.co')) {
      // Production environment
      redirectUrl = 'https://beezio.co/reset-password';
    } else {
      // Fallback to current origin
      redirectUrl = `${window.location.origin}/reset-password`;
    }
      
    console.log('Password reset redirect URL:', redirectUrl);
    
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    if (error) throw error;
    return data;
  };

  const sendMagicLink = async (email: string) => {
    // Determine the correct redirect URL for magic links
    let redirectUrl;
    
    if (window.location.hostname === 'localhost') {
      redirectUrl = 'http://localhost:5173/dashboard';
    } else if (window.location.hostname.includes('beezio.co')) {
      redirectUrl = 'https://beezio.co/dashboard';
    } else {
      redirectUrl = `${window.location.origin}/dashboard`;
    }
    
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    if (error) throw error;
    return data;
  };

  const value = {
    user,
    session,
    profile,
    signIn,
    signUp,
    signOut,
    resetPassword,
    sendMagicLink,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
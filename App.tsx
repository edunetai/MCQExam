import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './services/supabase';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import type { Profile } from './types';
import AuthPage from './pages/AuthPage';
import AdminDashboard from './pages/AdminDashboard';
import StudentDashboard from './pages/StudentDashboard';
import { Spinner } from './components/Spinner';
import { logAuditEvent } from './services/logging';

const SupabaseWarning: React.FC = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900 text-center p-4">
        <h1 className="text-3xl font-bold text-red-500 mb-4">Supabase Not Configured</h1>
        <p className="text-lg text-slate-700 dark:text-slate-300">
            The application cannot start because Supabase credentials are missing.
        </p>
        <p className="text-md mt-2 text-slate-600 dark:text-slate-400">
            Please update <code className="bg-slate-200 dark:bg-slate-700 p-1 rounded mx-1">services/supabase.ts</code> with your project's URL and anon key.
        </p>
    </div>
);

const SchemaErrorWarning: React.FC<{ message: string }> = ({ message }) => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900 text-center p-4">
        <h1 className="text-3xl font-bold text-red-500 mb-4">Database Schema Error</h1>
        <p className="text-lg text-slate-700 dark:text-slate-300">
            The application cannot connect to the required database tables.
        </p>
        <p className="text-md mt-2 text-slate-600 dark:text-slate-400">
            <strong>Details:</strong> {message}
        </p>
        <p className="text-md mt-4 text-slate-600 dark:text-slate-400">
            Please run the full SQL script from <code className="bg-slate-200 dark:bg-slate-700 p-1 rounded mx-1">supabase.md</code> in your Supabase project's SQL Editor to create the necessary tables.
        </p>
    </div>
);

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  if (!supabase) {
    return <SupabaseWarning />;
  }

  if (schemaError) {
    return <SchemaErrorWarning message={schemaError} />;
  }

  const getProfile = useCallback(async (user: User) => {
    try {
      setLoading(true);
      const { data, error, status } = await supabase
        .from('profiles')
        .select(`*`)
        .eq('id', user.id)
        .single();

      if (error && status !== 406) {
        if (error.message.includes("does not exist")) {
            setSchemaError(`The core 'profiles' table is missing.`);
            return;
        }
        throw error;
      }

      if (data) {
        setProfile(data);
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error fetching profile:', error.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        setSession(session);
        if (event === 'SIGNED_IN' && session?.user) {
          logAuditEvent('user_login');
        }
        if (session?.user) {
          await getProfile(session.user);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // Initial check
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session?.user) {
        await getProfile(session.user);
      } else {
        setLoading(false);
      }
    };
    checkUser();

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [getProfile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <Spinner />
      </div>
    );
  }

  if (!session || !profile) {
    return <AuthPage />;
  }

  if (profile.role === 'admin') {
    return <AdminDashboard user={session.user} profile={profile} />;
  } else {
    return <StudentDashboard user={session.user} profile={profile} />;
  }
};

export default App;
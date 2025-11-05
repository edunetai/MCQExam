import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { Logo } from '../components/Icons';
import { Spinner } from '../components/Spinner';

const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase!.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error } = await supabase!.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          university_id: universityId,
        },
      },
    });
    if (error) setError(error.message);
    else if (!data.user) setError("Registration failed. Please try again.");
    setLoading(false);
  };

  const formStyle = "w-full bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const buttonStyle = "w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-700 disabled:bg-indigo-400 transition duration-300 flex justify-center items-center";

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8">
        <div className="flex justify-center items-center mb-6">
          <Logo className="w-12 h-12 text-indigo-600" />
          <h1 className="ml-4 text-3xl font-bold text-slate-800 dark:text-slate-200">MCQ Platform</h1>
        </div>

        <h2 className="text-xl text-center font-semibold text-slate-600 dark:text-slate-400 mb-6">
          {isLogin ? 'Welcome Back' : 'Create Student Account'}
        </h2>
        
        {error && <p className="bg-red-100 text-red-700 p-3 rounded-md mb-4 text-center">{error}</p>}

        <form onSubmit={isLogin ? handleLogin : handleRegister}>
          <div className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <input type="text" placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} required className={formStyle} />
                </div>
                <div>
                  <input type="text" placeholder="University ID" value={universityId} onChange={(e) => setUniversityId(e.target.value)} required className={formStyle} />
                </div>
              </>
            )}
            <div>
              <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} required className={formStyle} />
            </div>
            <div>
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required className={formStyle} />
            </div>
          </div>
          
          <div className="mt-6">
            <button type="submit" disabled={loading} className={buttonStyle}>
              {loading ? <Spinner /> : (isLogin ? 'Login' : 'Register')}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center">
          <button onClick={() => { setIsLogin(!isLogin); setError(null); }} className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
            {isLogin ? 'Need an account? Register' : 'Already have an account? Login'}
          </button>
        </div>
        <p className="text-xs text-slate-500 text-center mt-4">Admin logs in here with provided credentials.</p>
      </div>
    </div>
  );
};

export default AuthPage;

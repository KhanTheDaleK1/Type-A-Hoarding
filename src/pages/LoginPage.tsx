import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Box, LogIn, UserPlus } from 'lucide-react';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const savedTheme = localStorage.getItem('hoarding_theme');
    if (!savedTheme) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    login(email, 'fake-token');
    navigate('/');
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <div className="w-full max-w-md bg-bg-secondary p-8 rounded-3xl border border-border shadow-2xl">
        <header className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-accent mb-4 text-white">
            <Box size={28} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text-h uppercase">Type-A Hoarding</h1>
          <p className="text-sm opacity-50 mt-1">
            {isRegister ? 'Create your private collection archive' : 'Sign in to your collections'}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider opacity-50 mb-1 ml-1">Email</label>
            <input 
              type="email" 
              required
              className="w-full rounded-xl border border-border bg-bg p-3 text-sm focus:border-accent outline-none"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider opacity-50 mb-1 ml-1">Password</label>
            <input 
              type="password" 
              required
              className="w-full rounded-xl border border-border bg-bg p-3 text-sm focus:border-accent outline-none"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit"
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-accent p-3.5 text-white font-bold hover:bg-accent-hover transition-all mt-2 shadow-lg shadow-accent/20"
          >
            {isRegister ? <UserPlus size={18} /> : <LogIn size={18} />}
            <span>{isRegister ? 'Register' : 'Sign In'}</span>
          </button>
        </form>

        <div className="mt-8 text-center border-t border-border pt-6">
          <button 
            onClick={() => setIsRegister(!isRegister)}
            className="text-xs font-bold text-accent hover:underline"
          >
            {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Register"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

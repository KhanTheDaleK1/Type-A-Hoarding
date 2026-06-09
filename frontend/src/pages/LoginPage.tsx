import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, UserPlus } from 'lucide-react';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // TODO: Connect to Cloudflare Worker API
    // For now, simulate a successful login
    console.log('Logging in with:', email);
    login(email, 'fake-jwt-token');
    navigate('/');
  };

  return (
    <div className="login-page flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-md rounded-2xl bg-bg-secondary p-8 shadow-xl">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2">Type-A-Hoarding</h1>
          <p className="text-gray-500">{isRegister ? 'Create an account to start syncing' : 'Sign in to access your collections'}</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email Address</label>
            <input 
              type="email" 
              required
              className="w-full rounded-lg border border-border bg-bg p-3"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input 
              type="password" 
              required
              className="w-full rounded-lg border border-border bg-bg p-3"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent p-3 text-white font-semibold hover:bg-accent-hover transition-colors"
          >
            {isRegister ? <UserPlus size={20} /> : <LogIn size={20} />}
            {isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsRegister(!isRegister)}
            className="text-sm text-accent hover:underline"
          >
            {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

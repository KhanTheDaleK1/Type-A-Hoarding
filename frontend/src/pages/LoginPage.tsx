import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, UserPlus, ShieldCheck, Box, Github } from 'lucide-react';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Ensure dark mode is active on the login page for that "Pro" look
  useEffect(() => {
    const savedTheme = localStorage.getItem('hoarding_theme');
    if (!savedTheme) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Simulate successful login
    // In the GitHub sync version, we primarily care about the local experience
    login(email, 'fake-jwt-token');
    navigate('/');
  };

  return (
    <div className="login-page flex min-h-[90vh] items-center justify-center p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-bg-secondary border border-border shadow-2xl flex flex-col md:flex-row">
        
        {/* Left Side: Branding/Visual */}
        <div className="bg-accent p-8 text-white flex flex-col justify-between md:w-5/12">
          <div>
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center mb-6">
              <Box size={28} />
            </div>
            <h1 className="text-2xl font-black leading-tight mb-2 tracking-tighter">TYPE-A<br/>HOARDING</h1>
            <div className="w-12 h-1 bg-white/40 rounded-full mb-6"></div>
            <p className="text-sm font-medium opacity-80 leading-relaxed">
              Professional-grade collection management for the obsessive curator.
            </p>
          </div>
          
          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest opacity-60">
              <ShieldCheck size={16} /> Private & Secure
            </div>
            <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest opacity-60">
              <Github size={16} /> GitHub Synced
            </div>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="p-8 flex-grow bg-bg">
          <header className="mb-8">
            <h2 className="text-2xl font-bold mb-1">
              {isRegister ? 'Begin Your Hoard' : 'Welcome Back'}
            </h2>
            <p className="text-sm opacity-50">
              {isRegister ? 'Start cataloging with extreme precision.' : 'Access your curated archives.'}
            </p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-1.5 ml-1">Email Identifier</label>
              <input 
                type="email" 
                required
                className="w-full rounded-xl border border-border bg-bg-secondary p-4 text-sm focus:border-accent outline-none transition-all shadow-inner"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@archive.com"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-1.5 ml-1">Secure Key</label>
              <input 
                type="password" 
                required
                className="w-full rounded-xl border border-border bg-bg-secondary p-4 text-sm focus:border-accent outline-none transition-all shadow-inner"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
              />
            </div>

            <button 
              type="submit"
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-accent p-4 text-white font-bold hover:bg-accent-hover transition-all shadow-lg shadow-accent/25 mt-2 active:scale-[0.98]"
            >
              {isRegister ? <UserPlus size={20} /> : <LogIn size={20} />}
              <span>{isRegister ? 'Create Profile' : 'Authorize Entry'}</span>
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-border text-center">
            <button 
              onClick={() => setIsRegister(!isRegister)}
              className="text-xs font-bold text-accent uppercase tracking-widest hover:opacity-70 transition-opacity"
            >
              {isRegister ? 'Already Authorized? Sign In' : "No Profile? Request Access"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

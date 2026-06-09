import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Box, ArrowRight } from 'lucide-react';

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
    login(email, 'fake-jwt-token');
    navigate('/');
  };

  return (
    <div className="bg-mesh -mx-4 -my-8 px-4 py-8 overflow-hidden">
      <div className="w-full max-w-md glass rounded-[2.5rem] p-8 md:p-12 animate-fade-in relative">
        {/* Subtle Decorative Element */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-accent/20 rounded-full blur-[80px]" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-accent/10 rounded-full blur-[80px]" />

        <header className="text-center mb-10 relative">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent mb-6 shadow-2xl shadow-accent/40">
            <Box size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-white uppercase mb-2">
            Type-A
          </h1>
          <div className="h-1 w-8 bg-accent mx-auto rounded-full" />
        </header>

        <form onSubmit={handleSubmit} className="space-y-6 relative">
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 ml-1">
              Archival Identity
            </label>
            <input 
              type="email" 
              required
              className="input-modern"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="archive@identity.com"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 ml-1">
              Access Key
            </label>
            <input 
              type="password" 
              required
              className="input-modern"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••••••"
            />
          </div>

          <button 
            type="submit"
            className="group w-full flex items-center justify-between gap-3 rounded-2xl bg-white p-5 text-black font-black text-sm uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-2xl"
          >
            <span>{isRegister ? 'Initialize' : 'Authorize'}</span>
            <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center group-hover:bg-accent transition-colors">
              <ArrowRight size={18} />
            </div>
          </button>
        </form>

        <footer className="mt-12 pt-8 border-t border-white/5 text-center relative">
          <button 
            onClick={() => setIsRegister(!isRegister)}
            className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30 hover:text-accent transition-colors"
          >
            {isRegister ? 'Switch to Authorization' : 'Request New Identity'}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default LoginPage;

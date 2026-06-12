import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Box, LogIn, UserPlus, GitBranch, Globe, Apple, Settings } from 'lucide-react';
import { syncService } from '../db/sync';

const getQueryParam = (name: string): string | null => {
  const urlSearch = new URLSearchParams(window.location.search);
  if (urlSearch.has(name)) return urlSearch.get(name);
  
  const hash = window.location.hash;
  const qIndex = hash.indexOf('?');
  if (qIndex !== -1) {
    const hashSearch = new URLSearchParams(hash.substring(qIndex));
    if (hashSearch.has(name)) return hashSearch.get(name);
  }
  return null;
};

const getApiUrl = (path: string) => {
  const base = localStorage.getItem('hoarding_api_url') || '';
  return `${base}${path}`;
};

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState<string | null>(null);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [apiUrl, setApiUrl] = useState(() => localStorage.getItem('hoarding_api_url') || '');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSaveApiUrl = () => {
    const cleanUrl = apiUrl.trim().replace(/\/$/, '');
    setApiUrl(cleanUrl);
    localStorage.setItem('hoarding_api_url', cleanUrl);
    alert('Connection settings saved successfully!');
    setShowServerConfig(false);
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('hoarding_theme');
    if (!savedTheme) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }

    const code = getQueryParam('code');
    if (code) {
      handleCallback(code);
    }
  }, []);

  const handleCallback = async (code: string) => {
    setLoadingMsg('Authenticating with GitHub...');
    try {
      const response = await fetch(getApiUrl('/api/github/callback'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code })
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to exchange code');
      }

      const token = data.token;
      
      // Fetch user profile from GitHub
      setLoadingMsg('Fetching GitHub user profile...');
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json'
        }
      });

      if (!userResponse.ok) {
        throw new Error('Failed to fetch user profile from GitHub');
      }

      const userData = await userResponse.json();
      const owner = userData.login;
      const email = userData.email || `${owner}@github.com`;

      // Log in in AuthContext
      login(email, token);

      // Save GitHub Sync Config
      const existingConfig = syncService.getConfig();
      syncService.saveConfig({
        token,
        owner,
        repo: existingConfig?.repo || 'hoard-data',
        path: existingConfig?.path || 'hoard_backup.json'
      });

      // Clear the query params from the URL to keep it clean
      const cleanUrl = window.location.origin + window.location.pathname + window.location.hash.split('?')[0];
      window.history.replaceState({}, document.title, cleanUrl);

      navigate('/');

    } catch (err: any) {
      console.error(err);
      alert(`GitHub Login failed: ${err.message || err}`);
      setLoadingMsg(null);
      
      const cleanUrl = window.location.origin + window.location.pathname + window.location.hash.split('?')[0];
      window.history.replaceState({}, document.title, cleanUrl);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    login(email, 'fake-token');
    navigate('/');
  };

  const handleSocialLogin = async (provider: string) => {
    if (provider === 'github') {
      setLoadingMsg('Connecting to GitHub...');
      try {
        const response = await fetch(getApiUrl('/api/github/config'));
        if (!response.ok) {
          throw new Error('Backend failed to return config');
        }
        const data = await response.json();
        if (!data.success || !data.clientId) {
          throw new Error('GitHub Client ID not configured on the backend');
        }

        const redirectUri = window.location.origin + window.location.pathname;
        const githubUrl = `https://github.com/login/oauth/authorize?client_id=${data.clientId}&scope=repo&redirect_uri=${encodeURIComponent(redirectUri)}`;
        window.location.href = githubUrl;

      } catch (err: any) {
        console.error(err);
        alert(`GitHub Login configuration error: ${err.message || err}`);
        setLoadingMsg(null);
      }
    } else {
      alert(`${provider} login coming soon! Currently focusing on GitHub-only backend.`);
    }
  };

  if (loadingMsg) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center p-4">
        <div className="w-full max-w-md bg-bg-secondary p-8 rounded-3xl border border-border shadow-2xl flex flex-col items-center justify-center space-y-4 py-16">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-text-h uppercase tracking-wider text-center">{loadingMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <div className="w-full max-w-md bg-bg-secondary p-8 rounded-3xl border border-border shadow-2xl relative">
        <button 
          onClick={() => setShowServerConfig(!showServerConfig)}
          className="absolute top-6 right-6 p-2 text-text opacity-50 hover:opacity-100 hover:bg-bg rounded-xl transition-all animate-pulse"
          title="Server Settings"
        >
          <Settings size={20} />
        </button>

        {showServerConfig ? (
          <div className="space-y-6">
            <header className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-accent mb-4 text-white">
                <Settings size={28} />
              </div>
              <h2 className="text-xl font-bold text-text-h uppercase">Server Settings</h2>
              <p className="text-xs opacity-50 mt-1">Configure your backend API connection</p>
            </header>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider opacity-50 mb-1 ml-1">Backend API URL</label>
                <input 
                  type="text" 
                  placeholder="e.g. https://api.beechem.site"
                  className="w-full rounded-xl border border-border bg-bg p-3 text-sm focus:border-accent outline-none"
                  value={apiUrl}
                  onChange={e => setApiUrl(e.target.value)}
                />
                <p className="text-[10px] opacity-40 uppercase font-black mt-2 leading-relaxed px-1">
                  Leave blank if your API server is running on the same domain or locally on port 3000.
                </p>
              </div>
              
              <button 
                onClick={handleSaveApiUrl}
                className="w-full p-3.5 rounded-xl bg-accent text-white font-bold hover:bg-accent-hover transition-all shadow-lg shadow-accent/20"
              >
                Save Settings
              </button>
            </div>
          </div>
        ) : (
          <>
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

            <div className="mt-8 space-y-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div>
                <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest"><span className="bg-bg-secondary px-4 opacity-40">Or continue with</span></div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <button 
                  onClick={() => handleSocialLogin('github')}
                  className="flex items-center justify-center p-3 rounded-xl border border-border bg-bg hover:bg-bg-secondary transition-all"
                >
                  <GitBranch size={20} />
                </button>
                <button 
                  onClick={() => handleSocialLogin('google')}
                  className="flex items-center justify-center p-3 rounded-xl border border-border bg-bg hover:bg-bg-secondary transition-all"
                >
                  <Globe size={20} />
                </button>
                <button 
                  onClick={() => handleSocialLogin('apple')}
                  className="flex items-center justify-center p-3 rounded-xl border border-border bg-bg hover:bg-bg-secondary transition-all"
                >
                  <Apple size={20} />
                </button>
              </div>
            </div>

            <div className="mt-8 text-center border-t border-border pt-6">
              <button 
                onClick={() => setIsRegister(!isRegister)}
                className="text-xs font-bold text-accent hover:underline"
              >
                {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Register"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LoginPage;

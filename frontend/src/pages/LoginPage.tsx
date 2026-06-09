import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Box, ArrowRight, ShieldCheck, Cloud, 
  ChevronLeft, ChevronRight, Mail, Lock, User
} from 'lucide-react';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const { login } = useAuth();
  const navigate = useNavigate();

  const slides = [
    {
      badge: 'ARCHIVAL GRADE',
      title: 'Aura Arc Armchair',
      desc: 'Architecturally balanced curves with rich bouclé fabrics. Perfected over semesters of ergonomic and visual iterations.',
      value: '$1,450',
      icon: <Box size={48} className="text-accent" />
    },
    {
      badge: 'LIMITED RELEASE',
      title: 'Solis Chronograph',
      desc: 'A statement of time. Fully customizable mechanical calibration, hand-polished sapphire crystal, waterproof mesh wrap.',
      value: '$3,120',
      icon: <Box size={48} className="text-teal-400" />
    },
    {
      badge: 'CURATED',
      title: 'Elysian Clay Vessel',
      desc: 'Sculpted manually by ceramicists in Kyoto. Matte, textured, organic geometry designed to catch sunset rays beautifully.',
      value: '$890',
      icon: <Box size={48} className="text-amber-500" />
    }
  ];

  useEffect(() => {
    const savedTheme = localStorage.getItem('hoarding_theme');
    if (!savedTheme) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }

    const interval = setInterval(() => {
      setActiveSlide(s => (s + 1) % slides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    login(email, 'fake-jwt-token');
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row -mx-4 -my-8 transition-colors duration-300">
      
      {/* Left Side: Editorial Showcase */}
      <div className="relative w-full lg:w-[55%] xl:w-[60%] bg-zinc-950 hidden lg:flex flex-col justify-between p-12 overflow-hidden text-white border-r border-zinc-900">
        {/* Background Radial Glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(170,59,255,0.08),transparent_60%)] pointer-events-none"></div>
        
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-accent rounded-full flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-accent/30">T</div>
            <span className="font-editorial text-2xl tracking-widest font-semibold uppercase">Type-A</span>
          </div>
          <div className="text-[10px] tracking-[0.3em] uppercase opacity-40 font-bold">Hoarding v1.0.4</div>
        </div>

        <div className="relative z-10 my-auto h-[400px] flex items-center">
          {slides.map((slide, i) => (
            <div 
              key={i} 
              className={`carousel-item absolute inset-0 flex flex-col justify-center ${activeSlide === i ? 'active' : ''}`}
            >
              <div className="grid grid-cols-12 gap-8 items-center">
                <div className="col-span-7 space-y-5">
                  <span className="inline-block px-3 py-1 bg-accent/20 text-accent border border-accent/30 rounded-full text-[10px] font-bold tracking-widest uppercase">
                    {slide.badge}
                  </span>
                  <h2 className="font-editorial text-5xl xl:text-6xl leading-tight font-normal italic">
                    {slide.title}
                  </h2>
                  <p className="text-zinc-400 text-sm leading-relaxed font-light max-w-md">
                    {slide.desc}
                  </p>
                  <div className="flex items-center gap-4 pt-4 border-t border-zinc-800 w-fit pr-8">
                    <span className="text-2xl font-editorial text-white font-semibold">{slide.value}</span>
                    <span className="text-[10px] uppercase tracking-widest opacity-30 font-bold">Estimated Value</span>
                  </div>
                </div>
                <div className="col-span-5 flex justify-center">
                  <div className="floating-element w-64 h-64 bg-zinc-900/50 rounded-full flex items-center justify-center p-6 border border-zinc-800 relative shadow-2xl">
                    <div className="absolute inset-0 bg-accent/5 rounded-full blur-2xl" />
                    {slide.icon}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex gap-2">
            {slides.map((_, i) => (
              <button 
                key={i}
                onClick={() => setActiveSlide(i)}
                className={`h-1 rounded-full transition-all duration-500 ${activeSlide === i ? 'w-10 bg-accent' : 'w-3 bg-zinc-800 hover:bg-zinc-700'}`}
              />
            ))}
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => setActiveSlide(s => (s - 1 + slides.length) % slides.length)}
              className="p-3 border border-zinc-800 rounded-full hover:bg-zinc-900 transition text-zinc-500 hover:text-white"
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              onClick={() => setActiveSlide(s => (s + 1) % slides.length)}
              className="p-3 border border-zinc-800 rounded-full hover:bg-zinc-900 transition text-zinc-500 hover:text-white"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Right Side: Form Column */}
      <div className="flex-1 flex flex-col justify-between p-8 sm:p-16 bg-white dark:bg-[#09090b] transition-colors duration-300">
        
        <div className="flex items-center justify-between w-full mb-12">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="h-8 w-8 bg-accent rounded-full flex items-center justify-center font-bold text-sm text-white">T</div>
            <span className="font-editorial text-xl tracking-wider font-semibold uppercase">Type-A</span>
          </div>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-3 px-4 py-2 bg-zinc-100 dark:bg-zinc-900 rounded-full border border-zinc-200 dark:border-zinc-800">
               <ShieldCheck size={14} className="text-zinc-400" />
               <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Secure Tunnel Active</span>
            </div>
          </div>
        </div>

        <div className="w-full max-w-sm mx-auto space-y-10 my-auto animate-fade-in">
          <div className="space-y-3">
            <h1 className="font-editorial text-4xl sm:text-5xl font-normal tracking-tight text-zinc-900 dark:text-white">
              {isRegister ? 'Begin Your Hoard' : 'Authorize Entry'}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm font-light leading-relaxed">
              {isRegister 
                ? 'Join the circle of obsessive curators and unlock archival-grade management tools.' 
                : 'Access your curated archives and manage your private digital catalog.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegister && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold tracking-[0.2em] text-zinc-500 dark:text-zinc-400 uppercase ml-1">Identity Name</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-zinc-400">
                    <User size={16} />
                  </span>
                  <input type="text" required className="input-editorial bg-zinc-50 dark:bg-zinc-900/50" placeholder="Collector Name" />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold tracking-[0.2em] text-zinc-500 dark:text-zinc-400 uppercase ml-1">Archival Identifier</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-zinc-400">
                  <Mail size={16} />
                </span>
                <input 
                  type="email" 
                  required 
                  className="input-editorial bg-zinc-50 dark:bg-zinc-900/50" 
                  placeholder="name@archive.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold tracking-[0.2em] text-zinc-500 dark:text-zinc-400 uppercase ml-1">Secure Key</label>
                {!isRegister && <button type="button" className="text-[10px] font-bold uppercase tracking-widest text-accent hover:underline">Lost Key?</button>}
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-zinc-400">
                  <Lock size={16} />
                </span>
                <input 
                  type="password" 
                  required 
                  className="input-editorial bg-zinc-50 dark:bg-zinc-900/50" 
                  placeholder="••••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full mt-6 flex items-center justify-between px-6 py-5 bg-zinc-900 dark:bg-accent hover:bg-black dark:hover:bg-accent-hover text-white rounded-2xl transition-all font-bold text-sm uppercase tracking-[0.2em] shadow-xl active:scale-[0.98]"
            >
              <span>{isRegister ? 'Initialize Identity' : 'Authorize Entrance'}</span>
              <ArrowRight size={20} />
            </button>
          </form>

          <div className="text-center pt-2">
            <button 
              onClick={() => setIsRegister(!isRegister)} 
              className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 hover:text-accent transition-colors"
            >
              {isRegister ? 'Already Configured? Sign In' : 'New Collector? Create Profile'}
            </button>
          </div>
        </div>

        <div className="mt-12 flex flex-col sm:flex-row items-center justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-600 gap-4 pt-8 border-t border-zinc-100 dark:border-zinc-900/80">
          <div>&copy; 2026 Type-A Hoarding. All rights reserved.</div>
          <div className="flex gap-6">
             <a href="#" className="flex items-center gap-2 hover:text-accent transition-colors"><Cloud size={12} /> Source Control</a>
             <a href="#" className="hover:text-accent transition-colors">Legal Archive</a>
          </div>
        </div>

      </div>

    </div>
  );
};

export default LoginPage;

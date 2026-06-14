import { useEffect } from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import CollectionView from './pages/CollectionView'
import ItemDetail from './pages/ItemDetail'
import Settings from './pages/Settings'
import LoginPage from './pages/LoginPage'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { seedDatabase } from './db/db'
import { useAutoSync } from './hooks/useAutoSync'
import './index.css'

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

function AppContent() {
  useAutoSync();

  useEffect(() => {
    // Auto-migrate old local IP URLs to the Cloudflare public URL
    const oldApiUrl = localStorage.getItem('hoarding_api_url');
    if (oldApiUrl && (oldApiUrl.includes('localhost') || oldApiUrl.includes('10.1.24.146'))) {
      localStorage.setItem('hoarding_api_url', 'https://hoardbackend.beechem.site');
    }

    // Apply persisted theme and accent
    const theme = localStorage.getItem('hoarding_theme') || 'light';
    const accent = localStorage.getItem('hoarding_accent') || 'purple';
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-accent', accent);

    seedDatabase().catch(err => {
      console.error('Database seeding failed:', err);
    });
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/collection/:id" element={<ProtectedRoute><CollectionView /></ProtectedRoute>} />
      <Route path="/item/:id" element={<ProtectedRoute><ItemDetail /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen">
          <main className="container mx-auto px-4 py-8">
            <AppContent />
          </main>
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App

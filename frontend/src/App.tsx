import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import CollectionView from './pages/CollectionView'
import ItemDetail from './pages/ItemDetail'
import Settings from './pages/Settings'
import LoginPage from './pages/LoginPage'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { seedDatabase } from './db/db'
import './index.css'

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

function AppContent() {
  useEffect(() => {
    seedDatabase();
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
      <Router basename="/Type-A-Hoarding">
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
          <main className="container mx-auto px-4 py-8">
            <AppContent />
          </main>
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App

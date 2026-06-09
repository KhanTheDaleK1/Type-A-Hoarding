import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import CollectionView from './pages/CollectionView'
import ItemDetail from './pages/ItemDetail'
import Settings from './pages/Settings'
import { seedDatabase } from './db/db'
import './index.css'

function App() {
  useEffect(() => {
    seedDatabase();
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/collection/:id" element={<CollectionView />} />
            <Route path="/item/:id" element={<ItemDetail />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App

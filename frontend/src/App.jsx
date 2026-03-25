import { BrowserRouter, Routes, Route, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import RequirePermission from './components/RequirePermission'
import Navbar from './components/Navbar.jsx'

// Pages
import Login from './pages/Login.jsx'
import ChangePassword from './pages/ChangePassword.jsx'
import Profile from './pages/Profile.jsx'
import Admin from './pages/Admin.jsx'
import Inventory from './pages/Inventory.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Home from './pages/Home.jsx'
import Help from './pages/Help.jsx'
import Checkout from './pages/Checkout.jsx'
import CheckIn from './pages/Checkin.jsx'

// Persistent layout: Navbar stays mounted across all page navigations
function AppLayout() {
  return (
    <>
      <Navbar />
      <Outlet />
    </>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />

          {/* Protected route without navbar (password change) */}
          <Route
            path="/change-password"
            element={
              <ProtectedRoute>
                <ChangePassword />
              </ProtectedRoute>
            }
          />

          {/* Protected routes with persistent navbar */}
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/" element={<Home />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/checkin" element={
            <RequirePermission permission="barcode:scan_in">
              <CheckIn />
            </RequirePermission>
          } />
            <Route path="/inventory" element={
              <RequirePermission permission="inventory:view">
                <Inventory />
              </RequirePermission>
            } />
            <Route path="/dashboard" element={
              <RequirePermission permission="dashboard:view">
                <Dashboard />
              </RequirePermission>
            } />
            <Route path="/help" element={<Help />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/admin" element={
              <ProtectedRoute adminOnly>
                <Admin />
              </ProtectedRoute>
            } />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App

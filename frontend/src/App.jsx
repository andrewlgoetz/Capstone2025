import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Inventory from './pages/Inventory.jsx'
import Navbar from './components/Navbar.jsx'
import Dashboard from "./pages/Dashboard.jsx";
import Home from './pages/Home.jsx';
import Help from './pages/Help.jsx'
import Login from './pages/Login.jsx'
import Admin from './pages/Admin.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'

function App() {

  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Home />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/help" element={<Help />} />
          <Route path="/admin" element={<Admin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App

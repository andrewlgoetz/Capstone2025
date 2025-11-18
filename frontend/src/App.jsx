import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Inventory from './pages/Inventory.jsx'
import Navbar from './components/Navbar.jsx'
import Landing from './pages/Landing'
import Dashboard from "./pages/Dashboard";

function App() {

  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { useRef, useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin, hasPermission } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setMenuOpen(false);
  };

  const navLinks = [
    { to: "/", label: "Home" },
    ...(hasPermission('inventory:view') ? [{ to: "/inventory", label: "Inventory" }] : []),
    ...(hasPermission('dashboard:view') ? [{ to: "/dashboard", label: "Dashboard" }] : []),
    ...(isAdmin() ? [{ to: "/admin", label: "Admin" }] : []),
    { to: "/help", label: "Help" },
  ];

  return (
    <nav className="bg-slate-900 shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <RouterLink to="/" className="text-xl font-semibold text-white tracking-tight hover:text-gray-300 transition">
            Inventory Tracking System
          </RouterLink>

          <div className="flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.to;
              return (
                <RouterLink
                  key={link.to}
                  to={link.to}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition duration-150 ease-in-out ${
                    isActive
                      ? 'bg-slate-700 text-white shadow-md'
                      : 'text-gray-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {link.label}
                </RouterLink>
              );
            })}

            {/* User dropdown */}
            <div className="relative ml-2" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-300 rounded-md hover:bg-slate-700 hover:text-white transition"
              >
                <AccountCircleIcon fontSize="small" />
                <span>{user?.name}</span>
                <svg className="w-3 h-3 ml-0.5 opacity-60" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 overflow-hidden">
                  <button
                    className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-gray-50 transition"
                    onClick={() => { navigate('/profile'); setMenuOpen(false); }}
                  >
                    Profile
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition"
                    onClick={handleLogout}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

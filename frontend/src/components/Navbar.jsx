import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { Button, Menu, MenuItem } from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    handleMenuClose();
  };

  const navLinks = [
    { to: "/", label: "Home" },
    { to: "/inventory", label: "Inventory" },
    { to: "/dashboard", label: "Dashboard" },
    ...(isAdmin() ? [{ to: "/admin", label: "Admin" }] : []),
  ];

  return (
    <nav className="bg-slate-900 shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <RouterLink to="/" className="text-xl font-semibold text-white tracking-tight hover:text-gray-300 transition">
            Inventory Tracking System
          </RouterLink>

          <div className="flex items-center space-x-4">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.to;
              return (
                <RouterLink
                  key={link.to}
                  to={link.to}
                  className={`
                    px-3 py-2 text-sm font-medium rounded-md transition duration-150 ease-in-out
                    ${isActive
                      ? 'bg-slate-700 text-white shadow-md'
                      : 'text-gray-300 hover:bg-slate-700 hover:text-white'
                    }
                  `}
                >
                  {link.label}
                </RouterLink>
              );
            })}

            {/* User Menu */}
            <Button
              onClick={handleMenuOpen}
              className="text-white"
              startIcon={<AccountCircleIcon />}
              style={{ color: 'white', textTransform: 'none' }}
            >
              {user?.name}
            </Button>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
            >
              <MenuItem onClick={() => { navigate('/profile'); handleMenuClose(); }}>
                Profile
              </MenuItem>
              <MenuItem onClick={handleLogout}>
                Logout
              </MenuItem>
            </Menu>
          </div>
        </div>
      </div>
    </nav>
  );
}



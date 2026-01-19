import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const navLinks = [
    { to: "/", label: "Home" },
    { to: "/inventory", label: "Inventory" },
    { to: "/dashboard", label: "Dashboard" },
    { to: "/help", label: "Help" },
    { to: "/admin", label: "Admin" },
  ];

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="bg-slate-900 shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <RouterLink to={user ? "/" : "/login"} className="text-xl font-semibold text-white tracking-tight hover:text-gray-300 transition">
            Inventory Tracking System
          </RouterLink>

          <div className="flex space-x-4 items-center">
            {user && navLinks.map((link) => {
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

            {user ? (
              <button
                type="button"
                onClick={handleLogout}
                className="px-3 py-2 text-sm font-medium rounded-md text-gray-300 hover:bg-slate-700 hover:text-white transition"
              >
                Sign out
              </button>
            ) : (
              <RouterLink
                to="/login"
                className={`px-3 py-2 text-sm font-medium rounded-md transition duration-150 ease-in-out ${
                  location.pathname === '/login'
                    ? 'bg-slate-700 text-white shadow-md'
                    : 'text-gray-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                Sign in
              </RouterLink>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

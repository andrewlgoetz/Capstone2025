import { Link as RouterLink, useLocation } from "react-router-dom";

export default function Navbar() {
  const location = useLocation();

  const navLinks = [
    { to: "/", label: "Home" },
    { to: "/dashboard", label: "Dashboard" },
    { to: "/inventory", label: "Inventory" },
    { to: "/reports", label: "Reports" },
  ];

  return (
    <nav className="bg-slate-900 shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Title */}
          <RouterLink to="/" className="text-xl font-semibold text-white tracking-tight hover:text-gray-300 transition">
            Inventory Tracking System
          </RouterLink>
          
          {/* Navigation Links */}
          <div className="flex space-x-4">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.to;
              return (
                <RouterLink
                  key={link.to}
                  to={link.to}
                  className={`
                    px-3 py-2 text-sm font-medium rounded-md transition duration-150 ease-in-out
                    ${isActive
                      ? 'bg-slate-700 text-white shadow-md' // Active state: darker background, white text
                      : 'text-gray-300 hover:bg-slate-700 hover:text-white' // Inactive state: lighter text, hover effect
                    }
                  `}
                >
                  {link.label}
                </RouterLink>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}

// import { AppBar, Toolbar, Typography, Button, Box } from "@mui/material";
// import { Link as RouterLink, useLocation } from "react-router-dom";

// export default function Navbar() {
//   return (
//     <AppBar position="static" sx={{ backgroundColor: "#bb76c0ff" }}>
//       <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
//         <Typography
//           variant="h5"
//           component={RouterLink}
//           to="/"
//           sx={{ color: "white", textDecoration: "none", fontWeight: 400 }}
//         >
//           Inventory Tracking System
//         </Typography>
//         <Box>
//           <Button component={RouterLink} to="/" color="inherit">
//             Home
//           </Button>
//           <Button component={RouterLink} to="/dashboard" color="inherit">
//             Dashboard
//           </Button>
//           <Button component={RouterLink} to="/inventory" color="inherit">
//             Inventory
//           </Button>
//           <Button component={RouterLink} to="/reports" color="inherit">
//             Reports
//           </Button>
//         </Box>
//       </Toolbar>
//     </AppBar>
//   );
// }

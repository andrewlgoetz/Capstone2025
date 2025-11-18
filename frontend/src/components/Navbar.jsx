import { AppBar, Toolbar, Typography, Button, Box } from "@mui/material";
import { Link as RouterLink, useLocation } from "react-router-dom";

export default function Navbar() {
  return (
    <AppBar position="static" sx={{ backgroundColor: "#bb76c0ff" }}>
      <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
        <Typography
          variant="h5"
          component={RouterLink}
          to="/"
          sx={{ color: "white", textDecoration: "none", fontWeight: 400 }}
        >
          Inventory Tracking System
        </Typography>
        <Box>
          <Button component={RouterLink} to="/" color="inherit">
            Home
          </Button>
          <Button component={RouterLink} to="/dashboard" color="inherit">
            Dashboard
          </Button>
          <Button component={RouterLink} to="/inventory" color="inherit">
            Inventory
          </Button>
          <Button component={RouterLink} to="/reports" color="inherit">
            Reports
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
}

import { NavLink } from 'react-router-dom'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'

const Navbar = () => {
  return (
    <AppBar position="static">
      <Toolbar>
        <Typography 
          variant="h6" 
          component={NavLink}
          to="/"
          sx={{ 
            flexGrow: 1, 
            fontWeight: 600,
            textDecoration: 'none',
            color: 'inherit',
            '&:hover': {
              opacity: 0.9
            }
          }}
        >
          StockScope
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button 
            color="inherit" 
            component={NavLink} 
            to="/"
            sx={{
              '&.active': {
                fontWeight: 'bold',
              }
            }}
          >
            Home
          </Button>
          <Button 
            color="inherit" 
            component={NavLink} 
            to="/dashboard"
            sx={{
              '&.active': {
                fontWeight: 'bold',
              }
            }}
          >
            Dashboard
          </Button>
          <Button 
            color="inherit" 
            component={NavLink} 
            to="/login"
            sx={{
              '&.active': {
                fontWeight: 'bold',
              }
            }}
          >
            Login
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  )
}

export default Navbar

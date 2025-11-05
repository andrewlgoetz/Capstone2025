import { NavLink } from 'react-router-dom'
import styles from './Navbar.module.css'

const Navbar = () => {
  return (
    <header className={styles.navbar}>
      <NavLink to="/" className={styles.brand}>
        StockScope
      </NavLink>

      <nav className={styles.links} aria-label="Primary navigation">
        <NavLink to="/" className={({ isActive }) =>
          `${styles.link} ${isActive ? styles.active : ''}`
        }>
          Home
        </NavLink>
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `${styles.link} ${isActive ? styles.active : ''}`
          }
        >
          Dashboard
        </NavLink>
        <NavLink
          to="/login"
          className={({ isActive }) =>
            `${styles.link} ${isActive ? styles.active : ''}`
          }
        >
          Login
        </NavLink>
      </nav>
    </header>
  )
}

export default Navbar

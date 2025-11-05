import { Link } from 'react-router-dom'
import styles from './Landing.module.css'

const Landing = () => {
  return (
    <section className={styles.landing}>
      <div className={styles.heroText}>
        <p className={styles.eyebrow}>Inventory, elevated</p>
        <h1 className={styles.title}>
          Keep every product accounted for with confidence.
        </h1>
        <p className={styles.subtitle}>
          Monitor stock in real time, anticipate shortages, and empower your
          team with intuitive tools that keep operations running smoothly.
        </p>

        <div className={styles.actions}>
          <Link to="/dashboard" className={styles.primaryAction}>
            View dashboard
          </Link>
          <Link to="/login" className={styles.secondaryAction}>
            Sign in
          </Link>
        </div>
      </div>

      <div className={styles.heroPanel}>
        <div className={styles.panelContent}>
          <h2>At a glance</h2>
          <ul>
            <li>
              <strong>12</strong>
              <span>locations reporting low inventory</span>
            </li>
            <li>
              <strong>4.3k</strong>
              <span>active SKUs synced overnight</span>
            </li>
            <li>
              <strong>98%</strong>
              <span>on-time restock rate this month</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}

export default Landing

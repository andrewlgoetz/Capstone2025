import InventoryTable from '../../components/InventoryTable'
import styles from './Dashboard.module.css'

const Dashboard = () => {
  return (
    <section className={styles.dashboard}>
      <header className={styles.header}>
        <h1 className={styles.title}>Inventory Dashboard</h1>
        <p className={styles.subtitle}>
          Track stock levels, recent activity, and product performance in one
          place.
        </p>
      </header>

      <InventoryTable />
    </section>
  )
}

export default Dashboard

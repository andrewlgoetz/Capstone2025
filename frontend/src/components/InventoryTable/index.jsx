import styles from './InventoryTable.module.css'

const sampleInventory = [
  {
    id: 'SKU-1201',
    name: 'Wireless barcode scanner',
    category: 'Hardware',
    stock: 24,
    reorderPoint: 15,
    status: 'Healthy',
  },
  {
    id: 'SKU-3380',
    name: 'Thermal shipping labels (500 pack)',
    category: 'Supplies',
    stock: 8,
    reorderPoint: 20,
    status: 'Restock soon',
  },
  {
    id: 'SKU-8845',
    name: 'Handheld POS terminal',
    category: 'Hardware',
    stock: 3,
    reorderPoint: 10,
    status: 'Critical',
  },
]

const statusClass = {
  Healthy: 'statusHealthy',
  'Restock soon': 'statusWarning',
  Critical: 'statusCritical',
}

const InventoryTable = () => {
  return (
    <div className={styles.wrapper}>
      <div className={styles.headerRow}>
        <h2>Top products</h2>
        <p className={styles.caption}>Snapshot of stock levels across key SKUs.</p>
      </div>

      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">SKU</th>
            <th scope="col">Product</th>
            <th scope="col">Category</th>
            <th scope="col">On hand</th>
            <th scope="col">Reorder point</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {sampleInventory.map((item) => (
            <tr key={item.id}>
              <td>{item.id}</td>
              <td>
                <span className={styles.primaryText}>{item.name}</span>
              </td>
              <td>{item.category}</td>
              <td>{item.stock}</td>
              <td>{item.reorderPoint}</td>
              <td>
                <span className={`${styles.status} ${styles[statusClass[item.status]]}`}>
                  {item.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default InventoryTable

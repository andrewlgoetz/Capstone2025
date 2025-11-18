import styles from './InventoryTable.module.css'

// Backward-compatible default sample (used by Dashboard)
const defaultItems = [
  { id: 'SKU-1201', name: 'Wireless barcode scanner', category: 'Hardware', stock: 24, reorderPoint: 15, status: 'Healthy' },
  { id: 'SKU-3380', name: 'Thermal shipping labels (500 pack)', category: 'Supplies', stock: 8, reorderPoint: 20, status: 'Restock soon' },
  { id: 'SKU-8845', name: 'Handheld POS terminal', category: 'Hardware', stock: 3, reorderPoint: 10, status: 'Critical' },
]

const statusClass = {
  Healthy: 'statusHealthy',
  'Restock soon': 'statusWarning',
  Critical: 'statusCritical',
}

// Generic, reusable inventory table
// Props:
// - title?: string
// - caption?: string
// - columns?: Array<{ key: string, header: string, render?: (row) => ReactNode }>
// - items?: any[]
const InventoryTable = ({ title = 'Top products', caption = 'Snapshot of stock levels across key SKUs.', columns, items }) => {
  const rows = items ?? defaultItems

  // Default column set (for Dashboard compatibility)
  const cols = columns ?? [
    { key: 'id', header: 'SKU' },
    { key: 'name', header: 'Product', render: (r) => <span className={styles.primaryText}>{r.name}</span> },
    { key: 'category', header: 'Category' },
    { key: 'stock', header: 'On hand' },
    { key: 'reorderPoint', header: 'Reorder point' },
    { key: 'status', header: 'Status', render: (r) => (
      <span className={`${styles.status} ${styles[statusClass[r.status] ?? 'statusHealthy']}`}>{r.status}</span>
    ) },
  ]

  return (
    <div className={styles.wrapper}>
      <div className={styles.headerRow}>
        <h2>{title}</h2>
        {caption ? <p className={styles.caption}>{caption}</p> : null}
      </div>

      <table className={styles.table}>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.key} scope="col">{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.id ?? idx}>
              {cols.map((c) => (
                <td key={c.key}>{c.render ? c.render(row) : row[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default InventoryTable

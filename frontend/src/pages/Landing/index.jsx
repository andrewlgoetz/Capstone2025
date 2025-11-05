import React, { useMemo, useState } from 'react'
import InventoryTable from '../../components/InventoryTable'
import styles from './Landing.module.css'

const Icon = {
  Plus: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}><path d="M12 5v14M5 12h14"/></svg>
  ),
  Alert: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}><path d="M12 9v4"/><path d="M12 17h.01"/><path d="m10.29 3.86-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.71-3.14l-8-14a2 2 0 0 0-3.42 0Z"/></svg>
  ),
  Clock: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
  ),
  Box: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}><path d="m21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.73Z"/><path d="M3.27 6.96 12 12l8.73-5.04"/><path d="M12 22V12"/></svg>
  ),
  Search: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
  ),
  ChevronDown: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}><path d="m6 9 6 6 6-6"/></svg>
  ),
}

const sampleItems = [
  { id: 'A-1001', name: 'Pasta (1 lb)', category: 'Dry Goods', qty: 46, unit: 'box', expires: '2026-02-01', location: 'Aisle 1', barcode: '076783001234' },
  { id: 'A-1002', name: 'Canned Beans', category: 'Canned', qty: 12, unit: 'can', expires: '2026-07-12', location: 'Aisle 3', barcode: '041497043210' },
  { id: 'A-1020', name: 'Diapers (M)', category: 'Care', qty: 5, unit: 'pack', expires: '2027-01-30', location: 'Aisle 7', barcode: '889123456789' },
  { id: 'A-1100', name: 'Milk (2%)', category: 'Perishables', qty: 18, unit: 'carton', expires: '2025-11-20', location: 'Cooler', barcode: '036000291452' },
]

const Landing = () => {
  const [query, setQuery] = useState('')
  const [filterLabel, setFilterLabel] = useState('none')
  const [showFABMenu, setShowFABMenu] = useState(false)

  const lowStock = useMemo(() => sampleItems.filter((i) => i.qty <= 10), [])
  const expiringSoon = useMemo(() => sampleItems.filter((i) => i.category === 'Perishables'), [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let arr = sampleItems
    if (q) {
      arr = arr.filter((i) =>
        [i.name, i.category, i.location, i.barcode].some((v) => String(v).toLowerCase().includes(q))
      )
    }
    if (filterLabel !== 'none') {
      // simple demo filter: show perishables only
      arr = arr.filter((i) => i.category === 'Perishables')
    }
    return arr
  }, [query, filterLabel])

  const columns = [
    { key: 'name', header: 'Item', render: (r) => <span className={styles.cellStrong}>{r.name}</span> },
    { key: 'category', header: 'Category', render: (r) => (
      <span className={`${styles.tag} ${r.category === 'Perishables' ? styles.tagEmerald : styles.tagGray}`}>{r.category}</span>
    ) },
    { key: 'qty', header: 'Qty' },
    { key: 'unit', header: 'Unit' },
    { key: 'expires', header: 'Expires' },
    { key: 'location', header: 'Location' },
    { key: 'barcode', header: 'Barcode', render: (r) => <span className={styles.muted}>{r.barcode}</span> },
    { key: 'actions', header: 'Actions', render: () => (
      <div className={styles.rowActions}>
        <button className={styles.btnGhost}>Adjust</button>
        <button className={styles.btnGhost}>Move</button>
        <button className={styles.btnGhost}>Details</button>
      </div>
    ) },
  ]

  return (
    <div className={styles.container}>
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarTitle}>Homepage</div>
          <nav className={styles.sidebarNav}>
            <div className={styles.sidebarLink}>• Scan</div>
            <div>
              <div className={styles.sidebarLink}>• Inventory</div>
              <div className={styles.sidebarSubLinks}>
                <div className={styles.sidebarLine} />
                <div className={styles.sidebarLine} />
                <div className={styles.sidebarLine} />
              </div>
            </div>
            <div className={styles.sidebarLink}>• Dashboard</div>
            <div className={styles.sidebarLink}>• Admin</div>
          </nav>
        </aside>

        <main className={styles.main}>
          <header className={styles.headerBar}>
            <div className={styles.headerInner}>
              <h1 className={styles.headerTitle}>Hamilton Food Support</h1>
              <div className={styles.locationChip}>
                <span className={styles.muted}>Location :</span>
                <span className={styles.locationName}>Main Warehouse</span>
                <Icon.ChevronDown className={styles.iconSm} />
              </div>
            </div>
          </header>

          <div className={styles.content}>
            <section className={styles.statGrid}>
              <StatPill icon={<Icon.Alert className={styles.iconMd} />} title="Low Stock" value={lowStock.length} badge="Under 10" />
              <StatPill icon={<Icon.Clock className={styles.iconMd} />} title="Expiring Soon" value={expiringSoon.length} badge="Perishables" />
              <StatPill icon={<Icon.Box className={styles.iconMd} />} title="TBD" value="—" />
            </section>

            <section className={styles.middleGrid}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}>Inventory</h2>
                  <div className={styles.toolbar}>
                    <div className={styles.searchWrap}>
                      <Icon.Search className={styles.searchIcon} />
                      <input
                        className={styles.searchInput}
                        placeholder="Search name, category, ..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </div>
                    <button className={styles.btnChip} onClick={() => setFilterLabel(filterLabel === 'none' ? 'demo' : 'none')}>
                      Filter : {filterLabel}
                    </button>
                  </div>
                </div>

                <InventoryTable title="" caption="" items={filtered} columns={columns} />

                <div className={styles.tableFooter}>
                  <span className={styles.muted}>Showing 1–24 of 124</span>
                  <div className={styles.pagination}>
                    <button className={styles.btnGhost}>Prev</button>
                    <button className={`${styles.btnGhost} ${styles.btnPrimary}`}>1</button>
                    <button className={styles.btnGhost}>2</button>
                    <button className={styles.btnGhost}>3</button>
                    <button className={styles.btnGhost}>Next</button>
                  </div>
                </div>
              </div>

              <div className={styles.card}>
                <div className={styles.rightHeader}>
                  <h3 className={styles.cardTitle}>Forecast Preview</h3>
                  <span className={styles.rightCaption}>Upcoming 30 days</span>
                </div>
                <div className={styles.rightGrid}>
                  <CardBox title="Demand" />
                  <CardBox title="Shortages" />
                  <CardBox title="Top Categories" />
                </div>
              </div>
            </section>

            <section className={styles.card}>
              <h3 className={styles.cardTitle}>Dashboard Preview</h3>
              <div className={styles.bottomGrid}>
                <PlaceholderChart title="By Category" />
                <PlaceholderChart title="Low Stock over time" />
                <PlaceholderChart title="Incoming vs. Outgoing" />
              </div>
            </section>
          </div>

          <div className={styles.fabWrap}>
            <div className={styles.fabInner}>
              {showFABMenu && (
                <div className={styles.fabMenu}>
                  <FABItem label="Scan" />
                  <FABItem label="Update inventory" />
                  <FABItem label="...Edit" />
                </div>
              )}
              <button className={styles.fabButton} onClick={() => setShowFABMenu(!showFABMenu)} aria-label="main actions">
                <Icon.Plus className={styles.iconLg} />
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

function StatPill({ icon, title, value, badge }) {
  return (
    <div className={styles.statPill}>
      <div className={styles.statIcon}>{icon}</div>
      <div className={styles.statBody}>
        <div className={styles.statTitle}>{title}</div>
        <div className={styles.statValue}>{value}</div>
      </div>
      {badge ? <span className={styles.badge}>{badge}</span> : null}
    </div>
  )
}

function CardBox({ title }) {
  return (
    <div className={styles.cardBox}>
      <div className={styles.cardBoxHead}>{title}</div>
      <div className={styles.cardBoxBody}>Chart or Stats</div>
    </div>
  )
}

function PlaceholderChart({ title }) {
  return (
    <div className={styles.chartBox}>
      <div className={styles.cardBoxHead}>{title}</div>
      <div className={styles.chartBody}>chart placeholder</div>
    </div>
  )
}

function FABItem({ label }) {
  return (
    <button className={styles.btnList}>{label}</button>
  )
}

export default Landing

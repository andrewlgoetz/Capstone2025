import { useState } from "react";

const sections = [
  { id: "overview", label: "Overview" },
  { id: "dashboard", label: "Dashboard" },
  { id: "inventory", label: "Inventory" },
  { id: "scanning", label: "Scanning" },
  { id: "checkout", label: "Checkout" },
  { id: "item-manager", label: "Item Manager" },
  { id: "admin", label: "Admin" },
  { id: "troubleshooting", label: "Troubleshooting" },
];

const Card = ({ title, children }) => (
  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
    <h2 className="text-lg font-semibold text-slate-800 mb-4 pb-3 border-b border-gray-100">{title}</h2>
    {children}
  </div>
);

const Item = ({ label, children }) => (
  <div className="mb-3 last:mb-0">
    <span className="font-medium text-slate-700">{label}</span>
    <span className="text-slate-500"> — </span>
    <span className="text-slate-600">{children}</span>
  </div>
);

const Badge = ({ children, color = "slate" }) => {
  const colors = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-green-100 text-green-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    indigo: "bg-indigo-100 text-indigo-700",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  );
};

const Help = () => {
  const [activeSection, setActiveSection] = useState("overview");

  const scrollTo = (id) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-10 flex gap-8">

        {/* Sidebar */}
        <aside className="hidden lg:block w-52 shrink-0">
          <div className="sticky top-24">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Contents</p>
            <nav className="flex flex-col gap-1">
              {sections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => scrollTo(s.id)}
                  className={`text-left px-3 py-1.5 rounded-lg text-sm transition ${
                    activeSection === s.id
                      ? "bg-slate-900 text-white font-medium"
                      : "text-slate-500 hover:text-slate-800 hover:bg-gray-100"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">Help Guide</h1>
            <p className="text-slate-500 mt-2">Everything you need to know about using the Inventory Tracking System.</p>
          </div>

          {/* Overview */}
          <div id="overview" className="scroll-mt-24">
            <Card title="Overview">
              <p className="text-slate-600 mb-4">
                The Inventory Tracking System is a tool for food banks to manage their inventory in real time.
                Staff can scan items in and out using the mobile app, manage inventory through the web portal,
                run patron checkouts, and monitor stock levels through the dashboard.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Dashboard", desc: "Stock overview & trends", color: "indigo" },
                  { label: "Inventory", desc: "Browse & manage items", color: "green" },
                  { label: "Checkout", desc: "Patron item checkout", color: "amber" },
                  { label: "Admin", desc: "Users & permissions", color: "slate" },
                ].map((f) => (
                  <div key={f.label} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <Badge color={f.color}>{f.label}</Badge>
                    <p className="text-xs text-slate-500 mt-1.5">{f.desc}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Dashboard */}
          <div id="dashboard" className="scroll-mt-24">
            <Card title="Dashboard">
              <p className="text-slate-600 mb-4">
                The dashboard gives a real-time snapshot of your inventory health. Widgets update automatically as items are scanned in and out.
              </p>
              <Item label="Low Stock">Items at or below the low stock threshold are highlighted so you can restock before running out.</Item>
              <Item label="Expiring Soon">Items within 30 days of expiry are surfaced so nothing goes to waste.</Item>
              <Item label="Inventory by Category">A breakdown of quantity across all active categories.</Item>
              <Item label="Stock Trend">A chart showing inbound vs. outbound movement over the past weeks.</Item>
              <Item label="Recent Activity">A live feed of the latest inventory movements across all locations.</Item>
            </Card>
          </div>

          {/* Inventory */}
          <div id="inventory" className="scroll-mt-24">
            <Card title="Inventory Management">
              <p className="text-slate-600 mb-4">
                The Inventory page lets you browse, search, filter, and edit all items in your food bank.
              </p>
              <Item label="Search">Type in the search bar to filter items by name.</Item>
              <Item label="Category filter">Use the category dropdown to narrow down to a specific category.</Item>
              <Item label="Low stock filter">Toggle the low stock button to show only items below the threshold.</Item>
              <Item label="Expiry filters">Click "Expiry filters" to expand date range controls or pick a quick preset (e.g. expiring in the next 30 days).</Item>
              <Item label="Items view">The default view shows each item as a row in a table, sortable by any column.</Item>
              <Item label="By Category view">Switch to the "By Category" tab to see items grouped by category, with totals and low-stock counts per group. Click a category row to expand it.</Item>
              <Item label="Edit / Delete">Use the edit (pencil) or delete (trash) icons on each row to modify or remove an item. Requires the appropriate permissions.</Item>
              <Item label="Movement Log">Click the movement log icon on an item to see its full inbound/outbound history.</Item>
            </Card>
          </div>

          {/* Scanning */}
          <div id="scanning" className="scroll-mt-24">
            <Card title="Scanning (Mobile App)">
              <p className="text-slate-600 mb-4">
                Scanning is done through the mobile app. Use the camera to scan barcodes when receiving or distributing items.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-green-800 mb-2">Scan In (Add)</p>
                  <ul className="text-sm text-green-700 space-y-1.5 list-disc list-inside">
                    <li>Tap <strong>Scan IN</strong> and point the camera at the barcode.</li>
                    <li>If the item already exists, you'll be asked how many units to add.</li>
                    <li>If it's new, item details are pre-filled from Open Food Facts. Review the name and category, then confirm.</li>
                    <li>After adding, you can save the item to Quick Items for faster access next time.</li>
                  </ul>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-red-800 mb-2">Scan Out (Remove)</p>
                  <ul className="text-sm text-red-700 space-y-1.5 list-disc list-inside">
                    <li>Tap <strong>Scan OUT</strong> and scan the item's barcode.</li>
                    <li>Enter the quantity to remove and confirm.</li>
                    <li>The app will not allow you to remove more than the available quantity.</li>
                  </ul>
                </div>
              </div>
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <strong>Tip:</strong> Select your location at the top of the screen before scanning — items will be recorded against that location.
              </div>
            </Card>
          </div>

          {/* Checkout */}
          <div id="checkout" className="scroll-mt-24">
            <Card title="Checkout">
              <p className="text-slate-600 mb-4">
                The Checkout screen (available on both web and mobile) lets you record items given to a patron in a single transaction.
              </p>
              <Item label="Patron ID">Enter the patron's ID (e.g. student card number). This field is required.</Item>
              <Item label="Patron Type">Optionally select the patron type (Undergraduate, Graduate, Faculty, Staff, Community, Other).</Item>
              <Item label="Add items">Search by item name or scan a barcode to add items to the cart. Adjust quantities with the + / − controls.</Item>
              <Item label="Complete Checkout">Once the cart is ready, tap Complete Checkout. All items are recorded as outbound movements.</Item>
              <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-600">
                Each checkout is logged with the patron ID, patron type, items, quantities, and the staff member who served them.
              </div>
            </Card>
          </div>

          {/* Item Manager */}
          <div id="item-manager" className="scroll-mt-24">
            <Card title="Item Manager">
              <p className="text-slate-600 mb-4">
                The Item Manager (accessible from the Inventory page) lets authorised users manage categories and view the full activity log.
              </p>
              <Item label="Categories tab">View all active and inactive categories. Add a new category by typing a name and clicking Add. Edit a category name inline, or deactivate/reactivate it with the toggle buttons.</Item>
              <Item label="Activity Log tab">A full audit log of all inventory changes — what was changed, by whom, and when. Filterable by item type and action.</Item>
              <div className="mt-4 bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm text-indigo-800">
                <strong>Note:</strong> Categories added here become available in the category dropdowns across the app (web and mobile) immediately.
              </div>
            </Card>
          </div>

          {/* Admin */}
          <div id="admin" className="scroll-mt-24">
            <Card title="Admin">
              <p className="text-slate-600 mb-4">
                The Admin page is only visible to administrators and is used to manage users and their access levels.
              </p>
              <Item label="Add user">Create a new account with a name, email, role, and assigned locations. A temporary password is set on creation.</Item>
              <Item label="Edit user">Update a user's name, role, or location assignments.</Item>
              <Item label="Deactivate user">Deactivating a user prevents them from logging in without deleting their history.</Item>
              <Item label="Roles & Permissions">Each role has a set of permissions that control what a user can see and do. Contact your system administrator to adjust role permissions.</Item>
            </Card>
          </div>

          {/* Troubleshooting */}
          <div id="troubleshooting" className="scroll-mt-24">
            <Card title="Troubleshooting">
              <Item label="401 Unauthorized">Your session has expired. Sign out and sign back in.</Item>
              <Item label="Item name or category missing after barcode scan">The barcode may not be in the Open Food Facts database. Fill in the details manually and submit.</Item>
              <Item label="Categories not showing up in dropdown">Categories may have been deactivated. An admin can reactivate them in the Item Manager.</Item>
              <Item label="Quantity shows as incorrect">Check the movement log for that item to see all recent changes. An adjustment can be made from the inventory edit dialog.</Item>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Help;

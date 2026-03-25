import { useState } from "react";

const sections = [
  { id: "overview", label: "Overview" },
  { id: "inventory", label: "Inventory" },
  { id: "dashboard", label: "Dashboard" },
  { id: "scanning", label: "Scanning" },
  { id: "checkin-checkout", label: "Check In & Checkout" },
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
            <p className="text-slate-500 mt-2">Everything you need to know about using the Inventory Tracking System (ITS).</p>
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
                  { label: "Inventory", desc: "Browse & manage items", color: "green" },
                  { label: "Dashboard", desc: "Stock overview & trends", color: "indigo" },
                  { label: "Check In & Checkout", desc: "Donations in, patrons out", color: "amber" },
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
              <Item label="Edit / Delete">Use the edit (pencil) or delete (trash) icons on each row to modify or remove an item. Requires the appropriate permissions.</Item>
              <Item label="Movement Log">Click Movement Log to open a full audit log of all item movements. Use the Movement Report button inside to download a CSV summary of inbound and outbound activity for a selected date range.</Item>
              <Item label="Export CSV">Download the current inventory as a CSV file for use in Excel or other tools.</Item>
            </Card>
          </div>

          {/* Dashboard */}
          <div id="dashboard" className="scroll-mt-24">
            <Card title="Dashboard">
              <p className="text-slate-600 mb-4">
                The dashboard gives a real-time snapshot of your inventory health. Widgets update automatically as items are scanned in and out.
              </p>
              <Item label="Stock Levels">A chart showing current stock levels. Hover over a bar to see its details.</Item>
              <Item label="Inventory by Category">A pie chart that breaks down quantity across all active categories. Hover over a category to see its details.</Item>
              <Item label="Low Stock">Items at or below the low stock threshold are highlighted so you can restock before running out.</Item>
              <Item label="Expiring Soon">Use slider to adjust expiration date threshold to see items that are expiring soon.</Item>
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

          {/* Check In & Checkout */}
          <div id="checkin-checkout" className="scroll-mt-24">
            <Card title="Check In & Checkout">
              <p className="text-slate-600 mb-4">
                Both flows follow the same pattern — scan or search for items, build a cart, fill in the required details, and submit.
              </p>
              <div className="grid sm:grid-cols-2 gap-4 mb-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-green-800 mb-2">Check In — Recording donations</p>
                  <ul className="text-sm text-green-700 space-y-1 list-disc list-inside">
                    <li>Enter donor name (required) and donor type.</li>
                    <li>Scan or search items to add to the cart.</li>
                    <li>New items are created automatically from barcode data.</li>
                    <li>Recorded as inbound movements.</li>
                  </ul>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-amber-800 mb-2">Checkout — Serving patrons</p>
                  <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                    <li>Enter patron ID (required) and patron type.</li>
                    <li>Scan or search items to add to the cart.</li>
                    <li>Cannot exceed available quantity per item.</li>
                    <li>Recorded as outbound movements.</li>
                  </ul>
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-600">
                Both transactions are fully logged — who did it, when, which items, and at which location.
              </div>
            </Card>
          </div>

          {/* Item Manager */}
          <div id="item-manager" className="scroll-mt-24">
            <Card title="Item Manager">
              <p className="text-slate-600 mb-4">
                The Item Manager (accessible from the Inventory page) lets authorised users manage categories and view the full activity log.
              </p>
              <Item label="Categories tab">View all active and inactive categories. Add a new category by typing a name and clicking Add. Edit a category name inline, or deactivate/reactivate it with the toggle buttons. When a staff member assigns "Other" to an item and adds a note describing what it is, it appears here as a category request for review, allowing authorised users to create a proper category and reassign the item.</Item>
              <Item label="Activity Log tab">A full audit log of all inventory changes — what was changed, by whom, and when. Filterable by item type and action.</Item>
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

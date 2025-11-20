import React from "react";

const Help = () => {
  return (
    <div className="max-w-4xl mx-auto p-6 help-page">
      <h1 className="text-5xl font-extrabold mb-10 text-center">
        Help Guide
      </h1>

      <div className="prose prose-lg leading-relaxed">

        {/* Overview */}
        <h2 className="text-3xl font-bold mt-10 mb-4">Overview</h2>
        <p>
          <strong>What it does:</strong> This application helps food banks track
          inventory by scanning barcodes, adding new items, adjusting quantities,
          and viewing inventory dashboards.
        </p>

        {/* Scanning */}
        <h2 className="text-3xl font-bold mt-10 mb-4">Scanning</h2>
        <p>
          <strong>How to start:</strong> Use the floating action button
          (bottom-right) to open the scanner. Choose <em>Scan In</em> to add or
          update items, or <em>Scan Out</em> to remove items from inventory.
        </p>

        {/* Scan In */}
        <h2 className="text-3xl font-bold mt-10 mb-4">Scan In (Add / Update)</h2>
        <ul className="ml-8 list-disc space-y-2">
          <li><strong>Scan:</strong> Open the scanner and scan the item's barcode.</li>
          <li><strong>Existing item:</strong> If recognized, you’ll see an <em>Increase quantity</em> dialog.</li>
          <li>
            <strong>New item:</strong> If not found, the app auto-fills data using Open Food Facts. Review and confirm.
          </li>
          <li><strong>Location:</strong> New items default to <em>Main Warehouse</em>.</li>
        </ul>

        {/* Scan Out */}
        <h2 className="text-3xl font-bold mt-10 mb-4">Scan Out (Remove)</h2>
        <ul className="ml-8 list-disc space-y-2">
          <li><strong>Scan or select:</strong> Scan the item or pick it manually.</li>
          <li><strong>Confirm quantity:</strong> Enter the quantity to remove; the app prevents invalid values.</li>
        </ul>

        {/* Manual Management */}
        <h2 className="text-3xl font-bold mt-10 mb-4">Manual Inventory Management</h2>
        <ul className="ml-8 list-disc space-y-2">
          <li>View and edit all items from the <strong>Inventory</strong> page.</li>
          <li>Editable fields: <strong>name, category, unit, quantity, expiration date</strong>.</li>
        </ul>

        {/* Categories */}
        <h2 className="text-3xl font-bold mt-10 mb-4">Categories and Units</h2>
        <p>
          <strong>Dropdowns:</strong> Choose from the provided options or select <em>CUSTOM</em> to type your own.
        </p>

        {/* Backend */}
        <h2 className="text-3xl font-bold mt-10 mb-4">Data & Backend</h2>
        <p>
          The frontend communicates with backend endpoints to create/update items.
          Duplicate barcodes automatically increase the existing item’s quantity.
        </p>

        {/* Troubleshooting */}
        <h2 className="text-3xl font-bold mt-10 mb-4">Troubleshooting</h2>
        <ul className="ml-8 list-disc space-y-2">
          <li>
            <strong>Camera stays on:</strong> Close the scanner. If it stays on, refresh the page.
          </li>
          <li>
            <strong>Scan failures:</strong> Check browser console logs or backend terminal logs.
          </li>
        </ul>

        {/* Contact */}
        <h2 className="text-3xl font-bold mt-10 mb-4">Contact / Contribute</h2>
        <p>
          This project is actively developed. Submit issues or pull requests in the repository.
        </p>

      </div>
    </div>
  );
};

export default Help;

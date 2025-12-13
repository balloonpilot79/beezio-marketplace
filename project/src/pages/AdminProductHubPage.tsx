import React from 'react';
import { Link } from 'react-router-dom';

const AdminProductHubPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#101820] text-white py-6">
        <div className="max-w-5xl mx-auto px-4">
          <h1 className="text-3xl font-bold mb-2">Admin Product Hub</h1>
          <p className="text-gray-300">
            Add products to the marketplace with Beezio-controlled pricing and affiliate payouts.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">CJ Dropshipping (Automated)</h2>
          <p className="text-gray-700 mb-4">
            Import real CJ products, set markup + affiliate commission per item, and enable CJ fulfillment after checkout.
          </p>
          <Link
            to="/admin/cj-import"
            className="inline-flex items-center px-5 py-3 rounded-lg bg-[#ffcb05] text-black font-semibold hover:bg-[#e0b000] transition-colors"
          >
            Open CJ Import
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Bulk Add Products (Spreadsheet)</h2>
          <p className="text-gray-700 mb-4">
            Upload many products at once and set affiliate commission per item. Use this for products you will fulfill outside CJ.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/admin/bulk-products"
              className="inline-flex items-center px-5 py-3 rounded-lg bg-[#101820] text-[#ffcb05] font-semibold hover:bg-black transition-colors"
            >
              Bulk Upload
            </Link>
            <Link
              to="/add-product"
              className="inline-flex items-center px-5 py-3 rounded-lg border border-gray-300 text-gray-900 font-semibold hover:bg-gray-50 transition-colors"
            >
              Add Products Manually
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Other Suppliers</h2>
          <p className="text-gray-700">
            Adding additional dropshipping/fulfillment providers is possible only if the provider offers an API for product import and order creation/tracking.
            Tell me which supplier(s) you want next (e.g. Printful/Printify) and we’ll wire them end-to-end.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminProductHubPage;

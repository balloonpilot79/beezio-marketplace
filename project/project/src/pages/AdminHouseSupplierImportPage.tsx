import React from 'react';
import { ExternalLink, FileSpreadsheet, ShieldCheck } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import AdminUrlProductImporter from '../components/AdminUrlProductImporter';

type SupplierId = 'blanka' | 'roastify' | 'supliful';

const SUPPLIERS: Record<SupplierId, {
  name: string;
  brand: string;
  storefrontSlug: string;
  supplierUrl: string;
  placeholder: string;
  description: string;
  accessNote: string;
  automationNote: string;
}> = {
  blanka: {
    name: 'Blanka',
    brand: 'MareBelle',
    storefrontSlug: 'marebelle',
    supplierUrl: 'https://app.blankabrand.com/',
    placeholder: 'https://app.blankabrand.com/products/...',
    description: 'Bring a Blanka beauty product into MareBelle. Beezio will try public metadata first; authenticated portal pages can continue through manual entry while preserving the supplier URL.',
    accessNote: 'Blanka can provide paid-plan CSV exports. Its direct API requires Blanka VIP access and an API key from their merchant-success team.',
    automationNote: 'Keep fulfillment manual until the MareBelle catalog and live-order checks are complete.',
  },
  roastify: {
    name: 'Roastify',
    brand: 'RedTail',
    storefrontSlug: 'redtail',
    supplierUrl: 'https://merchant.roastify.app/',
    placeholder: 'https://merchant.roastify.app/products/...',
    description: 'Bring a Roastify coffee product into RedTail. Verify the coffee, grind variants, Roastify SKU, wholesale cost, bag image, markup, and affiliate commission before publishing.',
    accessNote: 'Roastify offers Test and Live API keys on Base and Pro plans. The first launch remains manual so a supplier charge can never be triggered by an unverified Beezio order.',
    automationNote: 'Preserve Roastify SKUs exactly. Whole Bean and Ground should remain separate variants when the supplier provides both.',
  },
  supliful: {
    name: 'Supliful',
    brand: 'Loving Nutrition',
    storefrontSlug: 'loving-nutrition',
    supplierUrl: 'https://app.supliful.com/',
    placeholder: 'https://app.supliful.com/catalog/...',
    description: 'Bring a Supliful wellness product into Loving Nutrition. Confirm the supplier SKU, ingredients, directions, warnings, label images, wholesale cost, and fulfillment fee before publishing.',
    accessNote: 'Supliful pricing is visible after sign-in. Its documented custom-store automation uses Shopify as a secure fulfillment bridge on a Pro plan.',
    automationNote: 'Supplement claims and labels must be reviewed manually. Do not describe dietary supplements as FDA approved.',
  },
};

const AdminHouseSupplierImportPage: React.FC = () => {
  const { supplierId = '' } = useParams<{ supplierId: string }>();
  const supplier = SUPPLIERS[supplierId as SupplierId];
  if (!supplier) return <Navigate to="/admin/products" replace />;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-[#101820] px-4 py-8 text-white">
        <div className="mx-auto max-w-6xl">
          <Link to="/admin/products" className="text-sm font-bold text-[#ffcb05]">← Admin Product Hub</Link>
          <div className="mt-4 text-xs font-black uppercase tracking-[0.22em] text-slate-400">{supplier.brand} supplier workflow</div>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">{supplier.name} Product Import</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Only the Beezio admin account can use this page. Products stay in review until pricing, brand placement, images, variants, and fulfillment details are confirmed.</p>
        </div>
      </div>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-7">
        <AdminUrlProductImporter
          supplierName={supplier.name}
          destinationStorefrontSlug={supplier.storefrontSlug}
          heading={`Add a ${supplier.name} product to ${supplier.brand}`}
          description={supplier.description}
          placeholder={supplier.placeholder}
        />

        <div className="grid gap-5 md:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-lg font-black text-slate-950"><ShieldCheck className="h-5 w-5 text-emerald-600" /> Supplier access</div>
            <p className="mt-3 text-sm leading-6 text-slate-700">{supplier.accessNote}</p>
            <a href={supplier.supplierUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#101820] px-4 py-3 text-sm font-black text-[#ffcb05]">
              Open {supplier.name} <ExternalLink className="h-4 w-4" />
            </a>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-lg font-black text-slate-950"><FileSpreadsheet className="h-5 w-5 text-amber-600" /> Bulk and fulfillment</div>
            <p className="mt-3 text-sm leading-6 text-slate-700">{supplier.automationNote}</p>
            <Link to="/admin/bulk-products" className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-900">
              Open spreadsheet import
            </Link>
          </section>
        </div>
      </main>
    </div>
  );
};

export default AdminHouseSupplierImportPage;

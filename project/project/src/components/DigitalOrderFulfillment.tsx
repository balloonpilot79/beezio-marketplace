type DigitalOrder = {
  orderNumber: string;
  customerEmail?: string | null;
  items: Array<{
    id: string;
    title: string;
    digitalDeliveryStatus?: string;
    downloadCount?: number;
    firstAccessAt?: string | null;
  }>;
};

export default function DigitalOrderFulfillment({ order }: { order: DigitalOrder }) {
  return <section aria-label={`Digital delivery for ${order.orderNumber}`} className="border-t border-gray-200 bg-blue-50/40 p-5">
    <h4 className="font-semibold text-gray-900">Digital delivery</h4>
    <p className="mt-2 text-sm text-gray-700">Files are made available electronically in the buyer’s account after confirmed payment. No parcel, shipping label, or tracking number is required.</p>
    {order.customerEmail && <p className="mt-2 break-all text-sm text-gray-700">Buyer: {order.customerEmail}</p>}
    <div className="mt-4 space-y-3">{order.items.map(item => <div key={item.id} className="rounded-lg border border-blue-200 bg-white p-4">
      <div className="font-medium text-gray-900">{item.title}</div>
      <div className="mt-2 text-sm font-semibold text-blue-900">{item.digitalDeliveryStatus || 'Preparing download'}</div>
      <div className="mt-1 text-sm text-gray-600">Downloads recorded: {item.downloadCount || 0}</div>
      {item.firstAccessAt && <div className="mt-1 text-sm text-gray-600">First accessed: {new Date(item.firstAccessAt).toLocaleString()}</div>}
    </div>)}</div>
  </section>;
}

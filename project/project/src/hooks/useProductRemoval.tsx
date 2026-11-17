import { useId, useRef, useState } from 'react';
import { archiveProductById } from '../utils/archiveProduct';

type RemovalRequest = {
  productId: string;
  title: string;
  sellerId?: string;
  onRemoved: () => void;
};

export const useProductRemoval = () => {
  const [request, setRequest] = useState<RemovalRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const titleId = useId();

  const requestRemoval = (next: RemovalRequest) => {
    if (submitting.current) return;
    setError('');
    setRequest(next);
  };

  const cancel = () => {
    if (!submitting.current) setRequest(null);
  };

  const confirmRemoval = async () => {
    if (!request || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await archiveProductById({ productId: request.productId, sellerId: request.sellerId });
      request.onRemoved();
      setRequest(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove this product. Please try again.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const removalDialog = request ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={busy}
        onKeyDown={(event) => {
          if (event.key === 'Escape') cancel();
          // Keep keyboard navigation within the modal's two action buttons.
          if (event.key === 'Tab') {
            const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
            const target = event.target;
            if (event.shiftKey && target === buttons[0]) {
              event.preventDefault();
              buttons[buttons.length - 1]?.focus();
            } else if (!event.shiftKey && target === buttons[buttons.length - 1]) {
              event.preventDefault();
              buttons[0]?.focus();
            }
          }
        }}
        className="w-full max-w-md rounded-2xl bg-white p-6 text-gray-900 shadow-xl"
      >
        <h2 id={titleId} className="text-xl font-bold">Remove product?</h2>
        <p className="mt-3 break-words font-semibold">{request.title}</p>
        <p className="mt-2 text-sm text-gray-600">This product will leave your active products and marketplace listings. Promoter links and payout history will be kept.</p>
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" autoFocus disabled={busy} onClick={cancel} className="rounded-lg border border-gray-300 px-4 py-2 font-semibold disabled:opacity-50">Cancel</button>
          <button type="button" disabled={busy} onClick={confirmRemoval} className="rounded-lg bg-red-700 px-4 py-2 font-semibold text-white hover:bg-red-800 disabled:opacity-50">{busy ? 'Removing…' : 'Remove product'}</button>
        </div>
      </div>
    </div>
  ) : null;

  return { requestRemoval, removalDialog, removingProductId: busy ? request?.productId || '' : '' };
};

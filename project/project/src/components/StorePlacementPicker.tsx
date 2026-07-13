import React, { useEffect, useState } from 'react';
import { FolderPlus, Home, LayoutGrid } from 'lucide-react';
import {
  createStoreCollection,
  EMPTY_STORE_PLACEMENT,
  loadStorePlacementOptions,
  StoreCollection,
  StorePageOption,
  StorePlacementSelection,
} from '../utils/storeProductPlacement';

type StorePlacementPickerProps = {
  ownerId: string;
  ownerType: 'seller' | 'affiliate';
  value: StorePlacementSelection;
  onChange: (value: StorePlacementSelection) => void;
};

const StorePlacementPicker: React.FC<StorePlacementPickerProps> = ({ ownerId, ownerType, value, onChange }) => {
  const [collections, setCollections] = useState<StoreCollection[]>([]);
  const [pages, setPages] = useState<StorePageOption[]>([]);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!ownerId) return;
    setLoading(true);
    setError(null);
    void loadStorePlacementOptions(ownerId, ownerType)
      .then((result) => {
        if (cancelled) return;
        setCollections(result.collections);
        setPages(result.pages);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to load store destinations.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ownerId, ownerType]);

  const toggleId = (key: 'collectionIds' | 'pageIds', id: string) => {
    const current = new Set(value[key] || []);
    if (current.has(id)) current.delete(id);
    else current.add(id);
    onChange({ ...value, [key]: Array.from(current) });
  };

  const handleCreateCollection = async () => {
    if (creating || !newCollectionName.trim()) return;
    try {
      setCreating(true);
      setError(null);
      const collection = await createStoreCollection(ownerId, newCollectionName);
      setCollections((current) => [...current, collection]);
      onChange({ ...value, collectionIds: [...new Set([...value.collectionIds, collection.id])] });
      setNewCollectionName('');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create collection.');
    } finally {
      setCreating(false);
    }
  };

  if (!ownerId) return null;

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-start gap-3">
        <LayoutGrid className="mt-0.5 h-5 w-5 text-slate-700" />
        <div>
          <h4 className="font-semibold text-slate-900">Choose where this product appears</h4>
          <p className="text-xs text-slate-600">It always appears in All Products. Choose any additional locations below.</p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading your store sections...</p>
      ) : (
        <div className="space-y-4">
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
            <input
              type="checkbox"
              checked={value.featureOnHomepage}
              onChange={(event) => onChange({ ...value, featureOnHomepage: event.target.checked })}
              className="rounded border-slate-300"
            />
            <Home className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium text-slate-900">Featured Products on the homepage</span>
          </label>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Collections</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {collections.map((collection) => (
                <label key={collection.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={value.collectionIds.includes(collection.id)}
                    onChange={() => toggleId('collectionIds', collection.id)}
                    className="rounded border-slate-300"
                  />
                  {collection.name}
                </label>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={newCollectionName}
                onChange={(event) => setNewCollectionName(event.target.value)}
                placeholder="New collection name"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void handleCreateCollection()}
                disabled={creating || !newCollectionName.trim()}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                <FolderPlus className="h-4 w-4" />
                Create
              </button>
            </div>
          </div>

          {pages.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Custom pages</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {pages.map((page) => (
                  <label key={page.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={value.pageIds.includes(page.id)}
                      onChange={() => toggleId('pageIds', page.id)}
                      className="rounded border-slate-300"
                    />
                    {page.page_title}
                  </label>
                ))}
              </div>
            </div>
          )}

          {!value.featureOnHomepage && value.collectionIds.length === 0 && value.pageIds.length === 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              No extra location selected. This product will be saved in All Products and listed as Unorganized in your dashboard.
            </p>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
};

export { EMPTY_STORE_PLACEMENT };
export type { StorePlacementSelection };
export default StorePlacementPicker;

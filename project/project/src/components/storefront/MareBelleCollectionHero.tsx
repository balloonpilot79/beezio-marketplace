import { Link } from 'react-router-dom';
import { normalizeProductImages } from '../../utils/imageHelpers';

export default function MareBelleCollectionHero({ products, productBasePath }: { products: any[]; productBasePath: string }) {
  const shirts = products.filter(product => /shirt/i.test(String(product.title || '')) && normalizeProductImages(product.images).length > 0).slice(0, 3);
  return (
    <div className="grid gap-6 bg-[#e8dfcd] p-6 sm:p-8 lg:grid-cols-[0.8fr_1.2fr] lg:p-10">
      <div className="flex flex-col justify-center">
        <img src="/marebelle-editorial-logo.png" alt="MareBelle horse logo" className="h-20 w-20 rounded-xl object-contain" />
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.25em] text-[#6c512c]">Equestrian-inspired style</p>
        <h1 className="mt-3 font-serif text-5xl font-semibold tracking-tight text-[#080808]">MareBelle</h1>
        <p className="mt-5 max-w-sm text-base leading-7 text-[#463b2c]">For the love of horses. Explore horse-inspired and western shirts from our current collection.</p>
      </div>
      {shirts.length > 0 && <div className="grid grid-cols-3 items-center gap-3 sm:gap-5">
        {shirts.map(product => <Link key={product.id} to={`${productBasePath}/${product.id}`} className="min-w-0 overflow-hidden rounded-xl border border-[#c9a462]/40 bg-[#faf7f1] p-2 shadow-sm sm:p-3">
          <img src={normalizeProductImages(product.images)[0]} alt={product.title} className="aspect-[3/4] w-full rounded-lg object-contain" />
          <p className="mt-3 line-clamp-2 text-xs font-semibold leading-5 text-[#080808]">{product.title}</p>
        </Link>)}
      </div>}
    </div>
  );
}

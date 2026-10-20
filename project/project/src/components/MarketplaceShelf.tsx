import React, { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

/** A bounded product row that advertises horizontal browsing on touch screens. */
export default function MarketplaceShelf({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  const rail = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ overflow: false, start: true, end: false });

  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    const update = () => setPosition({
      overflow: element.scrollWidth > element.clientWidth + 2,
      start: element.scrollLeft <= 2,
      end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2,
    });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    element.addEventListener('scroll', update, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener('scroll', update);
    };
  }, [children]);

  const move = (direction: number) => {
    const element = rail.current;
    if (!element) return;
    element.scrollBy({
      left: direction * Math.max(184, element.clientWidth * 0.8),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  };

  return (
    <div className="marketplace-shelf">
      {position.overflow && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-500">Swipe or use arrows to see more</span>
          <div className="flex gap-1">
            <button type="button" aria-label={`Previous products in ${label}`} aria-controls={id} disabled={position.start} onClick={() => move(-1)} className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-800 disabled:opacity-30">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button type="button" aria-label={`Next products in ${label}`} aria-controls={id} disabled={position.end} onClick={() => move(1)} className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-800 disabled:opacity-30">
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <div id={id} ref={rail} role="region" aria-label={`${label} products`} tabIndex={0} className="marketplace-shelf-scroll">
        <div className="marketplace-shelf-track">{children}</div>
      </div>
    </div>
  );
}

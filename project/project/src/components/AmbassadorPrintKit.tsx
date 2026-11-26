import { Link } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import './AmbassadorPrintKit.css';

const designs = [
  { id: 'market-card', name: 'Market Vendor Card', type: 'card', theme: 'gold', headline: 'Sell online between markets', description: 'Open a free Beezio store for the things you sell.' },
  { id: 'maker-card', name: 'Independent Maker Card', type: 'card', theme: 'green', headline: 'Give your handmade goods a home', description: 'Open a free online store on Beezio.' },
  { id: 'booth-flyer', name: 'Flea Market Booth Flyer', type: 'flyer', theme: 'gold', headline: 'Keep selling after the market closes', description: 'Whether you sell vintage finds, handmade goods, or collectibles, you can list them in your own free Beezio store.' },
  { id: 'local-flyer', name: 'Local Seller Flyer', type: 'flyer', theme: 'blue', headline: 'Open your own online shop', description: 'Give shoppers a place to find your products between markets. Start with a free Beezio store and add the items you already sell.' },
] as const;

type Design = (typeof designs)[number];

function Artwork({ design, inviteUrl, preview = false }: { design: Design; inviteUrl: string; preview?: boolean }) {
  return (
    <div className={`ambassador-art ambassador-art--${design.type} ambassador-art--${design.theme}`} aria-hidden={preview || undefined}>
      <div className="ambassador-art-copy">
        <p className="ambassador-art-brand">Beezio</p>
        <p className="ambassador-art-headline">{design.headline}</p>
        <p className="ambassador-art-description">{design.description}</p>
      </div>
      <div className="ambassador-art-scan">
        <QRCodeSVG value={inviteUrl} size={144} level="M" marginSize={4} title={preview ? undefined : 'Scan to open a free Beezio store'} />
        <p>Scan to open a free store</p>
      </div>
      <div className="ambassador-art-fineprint">
        <p className="ambassador-art-link">{inviteUrl}</p>
        <p>I may earn rewards from qualifying sales.</p>
      </div>
    </div>
  );
}

export default function AmbassadorPrintKit({ inviteUrl, printDesign }: { inviteUrl: string; printDesign?: string | null }) {
  const design = designs.find(item => item.id === printDesign);

  if (design && inviteUrl) {
    const isCard = design.type === 'card';
    return (
      <div className="ambassador-print-page">
        <div className="ambassador-print-toolbar">
          <Link to="/business/invites#print-kit" className="font-semibold underline">Back to designs</Link>
          <h1 className="text-xl font-bold">{design.name}</h1>
          <p className="text-sm text-slate-600">
            Print on US Letter at 100% scale, or select Save as PDF. {isCard ? 'Cut along the dotted lines for six 3.5 × 2-inch cards.' : 'Print one flyer per sheet.'}
          </p>
          <button type="button" onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#101820] px-4 text-sm font-bold text-white">
            <Printer size={16} aria-hidden="true" /> Print or save PDF
          </button>
        </div>
        <div className="ambassador-print-overflow">
          <div className={`ambassador-print-sheet ambassador-print-sheet--${design.type}`} aria-label={design.name}>
            {Array.from({ length: isCard ? 6 : 1 }, (_, index) => (
              <Artwork key={index} design={design} inviteUrl={inviteUrl} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <section id="print-kit" aria-labelledby="print-kit-title" className="mt-6 scroll-mt-28 rounded-2xl border border-amber-200 bg-white p-4 sm:p-6">
      <h2 id="print-kit-title" className="text-xl font-bold text-slate-950">Ambassador Print Kit</h2>
      <p className="mt-2 text-sm leading-6 text-slate-700">
        Hand out cards to vendors or display a flyer at your booth. Each design uses your own referral QR code to open seller signup.
      </p>
      {inviteUrl ? (
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {designs.map(item => (
            <article key={item.id} className="flex min-w-0 flex-col gap-3 rounded-xl border border-slate-200 p-3">
              <h3 className="font-bold text-slate-950">{item.name}</h3>
              <div className="ambassador-art-preview flex-1"><Artwork design={item} inviteUrl={inviteUrl} preview /></div>
              <Link to={`/business/invites?print=${item.id}`} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-2 font-semibold text-amber-900 underline">
                <Printer size={16} aria-hidden="true" /> Print or save {item.type === 'card' ? 'cards' : 'flyer'}
              </Link>
            </article>
          ))}
        </div>
      ) : <p role="status" className="mt-4 text-sm text-slate-600">Your designs will be available once your referral link is ready.</p>}
    </section>
  );
}

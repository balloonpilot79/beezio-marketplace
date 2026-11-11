import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Users, Link2, Megaphone, ShoppingBag, ShieldCheck, CheckCircle2 } from 'lucide-react';

const steps = [
  { title: 'Join Beezio', text: 'Create your free Beezio account and get started.', icon: Users },
  { title: 'Get your referral link', text: 'Use your available referral tools to introduce people to Beezio.', icon: Link2 },
  { title: 'Share the marketplace', text: 'Invite shoppers, sellers, and affiliates to discover Beezio.', icon: Megaphone },
  { title: 'Earn on qualifying sales', text: 'Eligible purchases can generate ambassador commissions under the program terms.', icon: ShoppingBag },
];

export default function AmbassadorPage() {
  const pageUrl = 'https://beezio.co/ambassadors';
  const shareText = 'Discover the free BZO Ambassador Program. Introduce people to Beezio and earn commissions from qualifying sales. No guaranteed income.';
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    document.title = 'BZO Ambassador Program | Beezio';
    const description = 'Become a BZO Ambassador. Help shoppers, sellers and affiliates discover Beezio and earn commissions on qualifying sales. Free to join; no income guaranteed.';
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    const oldDescription = meta?.content;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }
    meta.content = description;
    return () => { document.title = 'Beezio | Free Websites. More Ways to Sell & Earn.'; if (meta && oldDescription !== undefined) meta.content = oldDescription; };
  }, []);
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'BZO Ambassador Program | Beezio', text: shareText, url: pageUrl }); return; }
      catch (error) { if ((error as Error)?.name === 'AbortError') return; }
    }
    await copyLink();
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
    } catch {
      window.prompt('Copy the BZO Ambassador page link:', pageUrl);
    }
  };
  const encodedUrl = encodeURIComponent(pageUrl);
  const encodedText = encodeURIComponent(shareText + ' ' + pageUrl);
  const channels = [
    { name: 'Facebook', url: 'https://www.facebook.com/sharer/sharer.php?u=' + encodedUrl },
    { name: 'WhatsApp', url: 'https://api.whatsapp.com/send?text=' + encodedText },
    { name: 'X', url: 'https://twitter.com/intent/tweet?text=' + encodedText },
    { name: 'LinkedIn', url: 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodedUrl },
    { name: 'Email', url: 'mailto:?subject=' + encodeURIComponent('BZO Ambassador Program') + '&body=' + encodedText },
    { name: 'Text message', url: 'sms:?body=' + encodedText },
  ];
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <section className="bg-[#101820] !text-white px-5 py-16 md:py-24">
        <div className="max-w-5xl mx-auto">
          <span className="inline-block rounded-full bg-[#ffcb05] px-4 py-2 text-sm font-extrabold text-[#101820]">BZO AMBASSADOR PROGRAM</span>
          <h1 className="mt-6 max-w-3xl text-4xl md:text-6xl font-extrabold leading-tight !text-white">Help grow Beezio.<br/><span className="text-[#ffcb05]">Earn from qualifying sales.</span></h1>
          <p className="mt-6 max-w-2xl text-lg !text-gray-200">Beezio brings shoppers, independent sellers, and affiliates together in one online marketplace. Ambassadors help introduce people to the platform and can earn commissions tied to eligible product sales.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/join" className="inline-flex items-center gap-2 rounded-xl bg-[#ffcb05] px-6 py-4 font-bold text-[#101820] hover:bg-yellow-300">Join Beezio <ArrowRight size={19}/></Link>
            <a href="#how-it-works" className="rounded-xl border border-white px-6 py-4 font-semibold !text-white hover:bg-white/10" style={{ color: "#ffffff", WebkitTextFillColor: "#ffffff" }}>How it works</a>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-5xl px-5 py-14">
        <h2 className="text-3xl font-extrabold">What is a BZO Ambassador?</h2>
        <p className="mt-4 max-w-3xl text-lg text-gray-700">An ambassador helps people discover Beezio: shoppers looking for products, sellers looking for a free storefront, and affiliates who want to promote participating merchandise. Ambassadors grow the marketplace; affiliates focus on promoting individual products.</p>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {[
            ['Introduce people', 'Share Beezio with your audience, friends, and business connections.'],
            ['Support real commerce', 'Help independent businesses and creators reach more potential customers.'],
            ['Earn on eligible purchases', 'Commissions depend on qualifying sales and the applicable program rules.'],
          ].map(([heading, body]) => <div key={heading} className="rounded-2xl border border-gray-200 p-6 shadow-sm"><CheckCircle2 className="text-amber-500" size={28}/><h3 className="mt-3 text-xl font-bold">{heading}</h3><p className="mt-2 text-gray-600">{body}</p></div>)}
        </div>
      </section>
      <section id="how-it-works" className="bg-[#101820] px-5 py-14 !text-white">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-extrabold !text-white">How it works</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-4">{steps.map((step, index) => <div key={step.title} className="rounded-xl border border-yellow-500/40 bg-white/5 p-5"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ffcb05] font-extrabold text-[#101820]">{index+1}</span><step.icon className="mt-5 text-[#ffcb05]" size={28}/><h3 className="mt-3 text-xl font-bold !text-white">{step.title}</h3><p className="mt-2 !text-gray-200">{step.text}</p></div>)}</div>
        </div>
      </section>
      <section className="mx-auto max-w-5xl px-5 py-14">
        <h2 className="text-3xl font-extrabold">Why join?</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">{['Free Beezio account','No product inventory or shipping required for ambassador promotion','Share online on your own schedule','Help independent sellers and creators find customers'].map(x=><p key={x} className="flex gap-3 text-gray-700"><ShieldCheck className="shrink-0 text-green-700"/>{x}</p>)}</div>
        <p className="mt-7 rounded-xl bg-amber-50 p-5 text-sm text-gray-700">Important: Beezio is an independent, commission-based opportunity, not a salaried position. Signing people up alone does not guarantee payment. Earnings depend on qualifying product sales and program terms; no income is guaranteed. Review the applicable terms before participating.</p>
      </section>
      <section className="bg-[#ffcb05] px-5 py-14 text-center">
        <div className="mx-auto max-w-3xl"><h2 className="text-3xl font-extrabold">Ready to help grow Beezio?</h2><p className="mt-3 text-lg">We're looking for our first group of active BZO Ambassadors. There is no artificial 25-person cap.</p><Link to="/join" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#101820] px-7 py-4 font-bold !text-white hover:bg-gray-800">Create your Beezio account <ArrowRight size={20}/></Link><p className="mt-3 text-sm">Use the existing Beezio signup flow. Ambassador enrollment and referral eligibility are subject to the program's account setup and terms.</p></div>
      </section>
      <section className="mx-auto max-w-5xl px-5 py-10" aria-label="Share the BZO Ambassador Program">
        <h2 className="text-2xl font-extrabold !text-[#101820]">Know someone who could be a BZO Ambassador?</h2>
        <p className="mt-2 text-gray-700">Share this page in a tap. No signup required to view it.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={share} className="rounded-xl bg-[#101820] px-5 py-3 font-bold !text-white" style={{color:'#ffffff', WebkitTextFillColor:'#ffffff'}}>Share to any app</button>
          <button type="button" onClick={copyLink} className="rounded-xl border-2 border-[#101820] bg-[#ffcb05] px-5 py-3 font-bold !text-[#101820]" style={{color:'#101820', WebkitTextFillColor:'#101820'}}>{copied ? 'Link copied!' : 'Copy link'}</button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {channels.map(channel => <a key={channel.name} href={channel.url} target={channel.name === 'Email' || channel.name === 'Text message' ? undefined : '_blank'} rel="noopener noreferrer" className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-center font-semibold !text-[#101820]" style={{color:'#101820', WebkitTextFillColor:'#101820'}}>{channel.name}</a>)}
        </div>
        <p className="mt-4 break-all text-sm text-gray-600">{pageUrl}</p>
      </section>
    </div>
  );
}

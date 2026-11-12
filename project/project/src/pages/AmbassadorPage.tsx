import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Users, Link2, Megaphone, ShoppingBag, ShieldCheck, CheckCircle2 } from 'lucide-react';

const steps = [
  { title: 'Join Beezio', text: 'Create your free Beezio account and get started.', icon: Users },
  { title: 'Get your referral link', text: 'Use your available referral tools to introduce people to Beezio.', icon: Link2 },
  { title: 'Share the marketplace', text: 'Invite shoppers, sellers, and affiliates to discover Beezio.', icon: Megaphone },
  { title: 'Earn on qualifying sales', text: 'Eligible purchases can generate ambassador commissions under the program terms.', icon: ShoppingBag },
];

export default function AmbassadorPage({ sideIncome = false }: { sideIncome?: boolean }) {
  const pageTitle = sideIncome ? 'Earn Extra Income by Referring | Beezio' : 'Beezio Ambassador Program | Beezio';
  const pageUrl = sideIncome ? 'https://beezio.co/earn-by-referring' : 'https://beezio.co/ambassadors';
  const shareText = sideIncome ? 'Looking to earn extra side income? Refer sellers and affiliates to Beezio. When they make qualifying sales, you can earn too. Free to join; earnings are not guaranteed.' : 'Discover the free Beezio Ambassador Program. Introduce people to Beezio and earn commissions from qualifying sales. No guaranteed income.';
  const [copied, setCopied] = useState(false);
  const [imageSharing, setImageSharing] = useState(false);
  const [imageMessage, setImageMessage] = useState('');
  const imageUrl = '/share/beezio-ambassador-v1.jpg';
  const shareImage = async () => {
    setImageSharing(true);
    setImageMessage('');
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error('Image unavailable');
      const file = new File([await response.blob()], 'beezio-ambassador.jpg', { type: 'image/jpeg' });
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], title: pageTitle, text: shareText + ' ' + pageUrl });
      } else {
        setImageMessage('Use Download JPEG below to save the image, then attach it to your post.');
      }
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') setImageMessage('Use Download JPEG below to save and share the image.');
    } finally {
      setImageSharing(false);
    }
  };
  useEffect(() => {
    document.title = pageTitle;
    const description = sideIncome ? 'Earn referral commissions from qualifying sales by the sellers and affiliates you introduce to Beezio. Free to join. No inventory required; earnings are not guaranteed.' : 'Become a Beezio Ambassador. Help shoppers, sellers and affiliates discover Beezio and earn commissions on qualifying sales. Free to join; no income guaranteed.';
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    const oldDescription = meta?.content;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }
    meta.content = description;
    return () => { document.title = 'Beezio | Free Websites. More Ways to Sell & Earn.'; if (meta && oldDescription !== undefined) meta.content = oldDescription; };
  }, [pageTitle, sideIncome]);
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: pageTitle, text: shareText, url: pageUrl }); return; }
      catch (error) { if ((error as Error)?.name === 'AbortError') return; }
    }
    await copyLink();
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
    } catch {
      window.prompt('Copy the Beezio Ambassador page link:', pageUrl);
    }
  };
  const encodedUrl = encodeURIComponent(pageUrl);
  const encodedText = encodeURIComponent(shareText + ' ' + pageUrl);
  const channels = [
    { name: 'Facebook', url: 'https://www.facebook.com/sharer/sharer.php?u=' + encodedUrl },
    { name: 'WhatsApp', url: 'https://api.whatsapp.com/send?text=' + encodedText },
    { name: 'X', url: 'https://twitter.com/intent/tweet?text=' + encodedText },
    { name: 'LinkedIn', url: 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodedUrl },
    { name: 'Email', url: 'mailto:?subject=' + encodeURIComponent('Beezio Ambassador Program') + '&body=' + encodedText },
    { name: 'Text message', url: 'sms:?body=' + encodedText },
  ];
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <section className="bg-[#101820] !text-white px-5 py-16 md:py-24">
        <div className="max-w-5xl mx-auto">
          <span className="inline-block rounded-full bg-[#ffcb05] px-4 py-2 text-sm font-extrabold text-[#101820]">{sideIncome ? 'EXTRA INCOME. REAL SALES.' : 'BEEZIO AMBASSADOR PROGRAM'}</span>
          <h1 className="mt-6 max-w-3xl text-4xl md:text-6xl font-extrabold leading-tight !text-white">{sideIncome ? 'Looking to earn extra side income?' : 'Help grow Beezio.'}<br/><span className="text-[#ffcb05]">{sideIncome ? 'When they sell, you can earn too.' : 'Earn from qualifying sales.'}</span></h1>
          <p className="mt-6 max-w-2xl text-lg !text-gray-200">{sideIncome ? 'Introduce sellers and affiliates to Beezio using your referral link. When they sign up through your link and make qualifying sales, you can earn referral commissions. Help them get started, cheer on their success, and earn as their sales grow.' : 'Beezio brings shoppers, independent sellers, and affiliates together in one online marketplace. Ambassadors help introduce people to the platform and can earn commissions tied to eligible product sales.'}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup?role=influencer" className="inline-flex items-center gap-2 rounded-xl bg-[#ffcb05] px-6 py-4 font-bold text-[#101820] hover:bg-yellow-300">{sideIncome ? 'Sign up free today' : 'Join Beezio'} <ArrowRight size={19}/></Link>
            <a href="#how-it-works" className="rounded-xl border border-white px-6 py-4 font-semibold !text-white hover:bg-white/10" style={{ color: "#ffffff", WebkitTextFillColor: "#ffffff" }}>How it works</a>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-5xl px-5 py-14">
        <h2 className="text-3xl font-extrabold">{sideIncome ? 'You make the introduction. They make the sales.' : 'What is a Beezio Ambassador?'}</h2>
        <p className="mt-4 max-w-3xl text-lg text-gray-700">{sideIncome ? 'Know someone with products to sell? Or someone who enjoys recommending great finds? Introduce them to Beezio. Sellers open a free store and list their products. Affiliates promote participating products. As their qualifying sales happen, your eligible referral relationship can keep earning commissions under the program terms.' : 'An ambassador helps people discover Beezio: shoppers looking for products, sellers looking for a free storefront, and affiliates who want to promote participating merchandise. Ambassadors grow the marketplace; affiliates focus on promoting individual products.'}</p>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {[
            [sideIncome ? 'Refer sellers' : 'Introduce people', sideIncome ? 'Introduce creators, resellers, and independent businesses who want a free online store.' : 'Share Beezio with your audience, friends, and business connections.'],
            [sideIncome ? 'Refer affiliates' : 'Support real commerce', sideIncome ? 'Know someone who loves sharing products? They can promote participating items without holding inventory.' : 'Help independent businesses and creators reach more potential customers.'],
            [sideIncome ? 'Beezio pays your commission' : 'Earn on eligible purchases', sideIncome ? 'Your eligible referral commissions are paid by Beezio. There is no extra referral charge to the sellers or affiliates you introduce.' : 'Commissions depend on qualifying sales and the applicable program rules.'],
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
        <div className="mx-auto max-w-3xl"><h2 className="text-3xl font-extrabold">{sideIncome ? 'Their next sale could be your next commission.' : 'Ready to help grow Beezio?'}</h2><p className="mt-3 text-lg">{sideIncome ? 'Join free, get your referral link, and start introducing sellers and affiliates to Beezio today.' : "We're looking for our first group of active Beezio Ambassadors. There is no artificial 25-person cap."}</p><Link to="/signup?role=influencer" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#101820] px-7 py-4 font-bold !text-white hover:bg-gray-800">Create your Beezio account <ArrowRight size={20}/></Link><p className="mt-3 text-sm">Use the existing Beezio signup flow. Ambassador enrollment and referral eligibility are subject to the program's account setup and terms.</p></div>
      </section>
      <section className="mx-auto max-w-5xl px-5 py-10" aria-label="Share the Beezio Ambassador Program">
        <h2 className="text-2xl font-extrabold !text-[#101820]">{sideIncome ? 'Know someone looking for a side income opportunity?' : 'Know someone who could be a Beezio Ambassador?'}</h2>
        <p className="mt-2 text-gray-700">Share this page in a tap. No signup required to view it.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={share} className="rounded-xl bg-[#101820] px-5 py-3 font-bold !text-white" style={{color:'#ffffff', WebkitTextFillColor:'#ffffff'}}>Share to any app</button>
          <button type="button" onClick={copyLink} className="rounded-xl border-2 border-[#101820] bg-[#ffcb05] px-5 py-3 font-bold !text-[#101820]" style={{color:'#101820', WebkitTextFillColor:'#101820'}}>{copied ? 'Link copied!' : 'Copy link'}</button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {channels.map(channel => <a key={channel.name} href={channel.url} target={channel.name === 'Email' || channel.name === 'Text message' ? undefined : '_blank'} rel="noopener noreferrer" className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-center font-semibold !text-[#101820]" style={{color:'#101820', WebkitTextFillColor:'#101820'}}>{channel.name}</a>)}
        </div>
        <p className="mt-4 break-all text-sm text-gray-600">{pageUrl}</p>
        <div className="mt-8 rounded-2xl border border-gray-200 p-5">
          <h3 className="text-xl font-extrabold !text-[#101820]">Share a picture, too</h3>
          <p className="mt-2 text-gray-700">Save this JPEG for your posts, or share the image directly from a supported phone app. Include the page link in your caption so people can join.</p>
          <a href={imageUrl} target="_blank" rel="noopener noreferrer" aria-label="Open the full Beezio Ambassador JPEG">
            <img src={imageUrl} alt="Beezio: When they sell, you can earn too. Refer sellers and affiliates. Earn on qualifying sales. Free to join, no inventory required. Earnings are not guaranteed." width="1734" height="907" loading="lazy" className="mt-4 h-auto w-full rounded-xl" />
          </a>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href={imageUrl} download="beezio-ambassador.jpg" className="rounded-xl bg-[#ffcb05] px-5 py-3 font-bold !text-[#101820]">Download JPEG</a>
            <button type="button" onClick={shareImage} disabled={imageSharing} className="rounded-xl bg-[#101820] px-5 py-3 font-bold !text-white disabled:opacity-60">{imageSharing ? 'Preparing image…' : 'Share JPEG'}</button>
          </div>
          <p className="mt-3 text-sm text-gray-600">On iPhone, if the image opens instead of downloading, touch and hold it to save it to Photos. Link previews use this picture on platforms that support them.</p>
          <p role="status" className="mt-2 text-sm text-gray-700">{imageMessage}</p>
        </div>
      </section>
    </div>
  );
}

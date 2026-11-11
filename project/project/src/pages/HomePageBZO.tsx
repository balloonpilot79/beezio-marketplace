import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Globe,
  Megaphone,
  Package,
  Store,
} from "lucide-react";
import { pricingExplanation } from "../components/brand/BeezioBrand";
import { catalogRotationSlot, rotateCatalog } from "../utils/catalogRotation";
import { fetchMarketplaceCatalog } from "../utils/marketplaceCatalog";
import { prepareHomeProducts, type HomeProduct } from "../utils/homeCatalog";
import { usePublicStores } from "../hooks/usePublicStores";
import "../styles/beezio-home.css";

const money = (amount: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    amount,
  );

function ProductImage({
  product,
  eager = false,
}: {
  product: HomeProduct;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return product.image && !failed ? (
    <img
      src={product.image}
      alt={product.title}
      loading={eager ? "eager" : "lazy"}
      onError={() => setFailed(true)}
    />
  ) : (
    <div className="hm-image-placeholder">
      <Package size={36} aria-hidden="true" />
      <span>View product details</span>
    </div>
  );
}

const paths = [
  {
    title: "Sell your products.",
    label: "For sellers",
    text: "Open a free store, list your items, and fulfill your orders. Choose which products affiliates can promote.",
    signup: "/signup?role=seller",
    href: "/sellers",
    action: "Start selling",
    icon: Store,
    tone: "seller",
  },
  {
    title: "Promote products as an affiliate.",
    label: "For affiliates",
    text: "Choose products to recommend. Earn a commission when your promotion leads to a qualifying sale. The seller fulfills the order.",
    signup: "/signup?role=affiliate",
    href: "/affiliates",
    action: "Become an affiliate",
    icon: Globe,
    tone: "affiliate",
  },
  {
    title: "Refer people as a Beezio Ambassador.",
    label: "For ambassadors",
    text: "Invite sellers and affiliates with your referral link and earn from their qualifying sales.",
    signup: "/signup?role=influencer",
    href: "/ambassadors",
    action: "Become an ambassador",
    icon: Megaphone,
    tone: "influencer",
  },
];

export default function HomePageBZO() {
  const { stores, loading: storesLoading } = usePublicStores();
  const [products, setProducts] = useState<HomeProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [rotationSlot] = useState(() => catalogRotationSlot());
  const [category, setCategory] = useState("All");
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    setLoading(true);
    setError(false);
    (async () => {
      try {
        const rows = await fetchMarketplaceCatalog(controller.signal);
        if (active) setProducts(prepareHomeProducts(rows));
      } catch {
        if (active) setError(true);
      } finally {
        window.clearTimeout(timeout);
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);
  const categories = useMemo(
    () =>
      rotateCatalog(Array.from(new Set(products.map((product) => product.category))).map((id) => ({ id })), rotationSlot).map(({ id }) => id).slice(
        0,
        7,
      ),
    [products, rotationSlot],
  );
  const selected =
    category === "All"
      ? rotateCatalog(products.filter((product) => product.available), rotationSlot)
      : rotateCatalog(products.filter((product) => product.available && product.category === category), rotationSlot);
  const spotlight = rotateCatalog(products.filter((product) => product.available), rotationSlot).slice(0, 4);

  return (
    <div className="hm-page">
      <div className="hm-wrap">
        <section className="hm-hero">
          <div className="hm-hero-copy">
            <p className="hm-kicker">Shop independent sellers</p>
            <h1>
              Find something worth <span>bringing home.</span>
            </h1>
            <p className="hm-hero-description">
              Shop clothing, gifts, and everyday favorites from independent sellers.
            </p>
            <div className="hm-actions">
              <Link to="/marketplace" className="bz-button bz-button-gold">
                Shop the Marketplace <ArrowRight size={17} />
              </Link>
              <Link to="/account/signup" className="hm-hero-secondary">
                Create Buyer Account <ArrowRight size={17} />
              </Link>
              <Link to="/signup" className="hm-hero-secondary">
                Create Business Account <ArrowRight size={17} />
              </Link>
            </div>
            <p className="hm-hero-note">
              <Check size={14} /> PayPal checkout. See delivery and return details before you buy.
            </p>
            <nav aria-label="Shopping links" className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold">
              <Link to="/stores" className="underline">Discover stores</Link>
              <Link to="/support" className="underline">Contact support</Link>
              <Link to="/returns" className="underline">Returns</Link>
              <Link to="/how-it-works" className="underline">How Beezio works</Link>
              <Link to="/ambassadors" className="underline">Beezio Ambassador Program</Link>
            </nav>
          </div>
          <div className="hm-spotlight">
            <div className="hm-spotlight-heading">
              <span>Featured finds</span>
              <a href="#shop">
                Shop the finds <ArrowRight size={15} />
              </a>
            </div>
            {spotlight.length ? (
              <div className="hm-spotlight-grid">
                {spotlight.map((product) => (
                  <Link
                    key={product.id}
                    to={`/product/${encodeURIComponent(product.id)}`}
                    className="hm-spotlight-product"
                  >
                    <div className="hm-spotlight-image">
                      <ProductImage product={product} eager />
                    </div>
                    <span>{product.title}</span>
                    <strong>{money(product.price)}</strong>
                    <span>Sold by {product.seller}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <Link to="/store/marebelle" className="hm-brand-feature">
                <img
                  src="/marebelle-editorial-logo.png"
                  alt="Discover MareBelle’s horse-inspired clothing collection"
                />
                <span>
                  Independent brands. Made to discover. <ArrowRight size={18} />
                </span>
              </Link>
            )}
          </div>
        </section>
        <section id="shop" className="hm-shop">
          <div className="hm-section-heading">
            <div>
              <p className="hm-kicker">Find your next favorite</p>
              <h2>Shop Beezio sellers</h2>
              <p>See who’s selling each item, what it costs, and how it’s delivered. No business account needed.</p>
            </div>
            <Link to="/marketplace" className="hm-all-link">
              Shop all products <ArrowRight size={17} />
            </Link>
          </div>
          <div
            id="categories"
            className="hm-categories"
            role="group"
            aria-label="Filter homepage products by category"
          >
            {["All", ...categories].map((name) => (
              <button
                key={name}
                type="button"
                aria-pressed={category === name}
                onClick={() => setCategory(name)}
              >
                {name === "All" ? "All finds" : name}
              </button>
            ))}
          </div>
          {loading ? (
            <div
              className="hm-product-grid"
              role="status"
              aria-label="Loading products"
            >
              {Array.from({ length: 5 }, (_, index) => (
                <div className="hm-skeleton" key={index}>
                  <div />
                  <span />
                  <span />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="hm-catalog-message" role="status">
              <Package size={28} />
              <h3>Let’s get those products loaded.</h3>
              <p>The catalog is taking a little longer than usual.</p>
              <button
                type="button"
                className="bz-button bz-button-ink"
                onClick={() => setAttempt((value) => value + 1)}
              >
                Try again
              </button>
              <Link to="/marketplace">
                Open the marketplace <ArrowRight size={16} />
              </Link>
            </div>
          ) : selected.length ? (
            <div className="hm-product-grid">
              {selected.slice(0, 10).map((product) => (
                <Link
                  key={product.id}
                  to={`/product/${encodeURIComponent(product.id)}`}
                  className="hm-product-card"
                >
                  <div className="hm-product-image">
                    <ProductImage product={product} />
                    {!product.available && (
                      <span className="hm-stock-label">Out of stock</span>
                    )}
                  </div>
                  <div className="hm-product-info">
                    <p className="hm-product-seller">{product.seller}</p>
                    <h3>{product.title}</h3>
                    <div className="hm-product-bottom">
                      <strong>{money(product.price)}</strong>
                      <span aria-hidden="true">
                        <ArrowRight size={17} />
                      </span>
                    </div>
                    <p className="hm-product-detail">
                      See product & delivery details
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="hm-catalog-message">
              <h3>New finds are on their way.</h3>
              <p>Explore our stores, or bring your own products to Beezio.</p>
              <Link to="/marketplace" className="bz-button bz-button-ink">
                Explore the marketplace
              </Link>
            </div>
          )}
          {selected.length > 10 && (
            <Link
              to={
                category === "All"
                  ? "/marketplace"
                  : `/marketplace?q=${encodeURIComponent(category)}`
              }
              className="bz-button bz-button-ink hm-more"
            >
              See more products <ArrowRight size={17} />
            </Link>
          )}
        </section>
        <section id="stores" className="hm-stores-section" aria-labelledby="home-stores-title">
          <div className="hm-section-heading">
            <div>
              <p className="hm-kicker">Discover stores</p>
              <h2 id="home-stores-title">Shop Beezio storefronts</h2>
            </div>
            <Link to="/stores" className="hm-all-link">
              Browse all stores <ArrowRight size={17} />
            </Link>
          </div>
          {storesLoading && <p role="status">Loading stores…</p>}
          <div className="hm-store-grid">
            {stores.slice(0, 3).map(store => (
              <Link key={store.slug} to={`/store/${encodeURIComponent(store.slug)}`} className="hm-store-card">
                {store.image
                  ? <img src={store.image} alt="" loading="lazy" />
                  : <div className="hm-store-image-placeholder"><Store size={36} aria-hidden="true" /></div>}
                <div>
                  <h3>{store.name}</h3>
                  <p>Visit store <ArrowRight size={16} aria-hidden="true" /></p>
                </div>
              </Link>
            ))}
          </div>
        </section>
        <section
          id="start"
          aria-label="Start your business on Beezio"
          className="hm-business-paths"
        >
          {paths.map(
            ({ label, title, text, href, signup, action, icon: Icon, tone }) => (
              <article className={`hm-path hm-path-${tone}`} key={label}>
                <div className="hm-path-top">
                  <Icon size={20} aria-hidden="true" />
                  <p className="hm-kicker">{label}</p>
                </div>
                <h2>{title}</h2>
                <p>{text}</p>
                <div className="hm-path-actions">
                  <Link to={signup}>{action}<ArrowRight size={15} /></Link>
                  <Link to={href} className="hm-path-learn">How it works</Link>
                </div>
              </article>
            ),
          )}
        </section>
        <section className="hm-quick-start" aria-labelledby="how-sales-work-title">
          <div>
            <p className="hm-kicker">How Beezio works</p>
            <h2 id="how-sales-work-title">One marketplace. Clear ways to earn.</h2>
            <p>A seller lists a product, sets what they receive, and chooses whether to offer an affiliate reward. An affiliate shares it using a tracked link or their store. A customer places an order, the seller fulfills it, and eligible earnings are paid after the hold and payout requirements are met.</p>
            <p>It’s free to join. Sellers set what they receive. Affiliates and Ambassadors earn on qualifying sales.</p>
          </div>
          <Link to="/faq" className="bz-button bz-button-ink">Read about payouts <ArrowRight size={17} /></Link>
        </section>
        <section className="hm-quick-start" aria-labelledby="quick-start-title">
          <div>
            <p className="hm-kicker">Your first store starts here</p>
            <h2 id="quick-start-title">Create an account. Choose products. Share your store.</h2>
            <p>Start as an affiliate with products already on Beezio, or list your own as a seller. Add your branding when you’re ready.</p>
          </div>
          <Link to="/signup?role=affiliate" className="bz-button bz-button-ink">Start my free store <ArrowRight size={17} /></Link>
        </section>
        <section className="hm-earn-banner">
          <div className="hm-earn-icon">
            <Globe size={32} aria-hidden="true" />
          </div>
          <div>
            <p className="hm-kicker">Turn recommendations into commissions</p>
            <h2>Affiliates are at the heart of Beezio.</h2>
            <p>
              Your recommendations connect shoppers with great products and
              help sellers reach new customers. Build your free affiliate
              website, share products you believe in, and earn commissions on
              qualifying sales. No inventory to buy or orders to ship.
            </p>
          </div>
          <Link to="/affiliates" className="bz-button bz-button-gold">
            Explore affiliate earning <ArrowRight size={17} />
          </Link>
        </section>
        <section className="hm-build">
          <div className="hm-build-preview">
            <div className="hm-browser-bar">
              <i />
              <i />
              <i />
              <span>Your brand. Your website.</span>
            </div>
            <img
              src="/marebelle-storefront-example.png"
              alt="Example of a custom website built with Beezio"
              loading="lazy"
            />
            <div className="hm-build-stamp">
              <Globe size={20} />
              <span>
                Designed by you.
                <br />
                <strong>Powered by Beezio.</strong>
              </span>
            </div>
          </div>
          <div className="hm-build-copy">
            <p className="hm-kicker">For sellers & affiliates</p>
            <h2>
              Sell what you have. <em>Grow at your own pace.</em>
            </h2>
            <p>
              Open a free store for one item or a whole collection. Add your branding,
              sell directly to shoppers, and choose which products affiliates can promote.
            </p>
            <ul>
              <li>
                <Check size={16} /> No seller fees. No listing fees or monthly subscriptions.
              </li>
              <li>
                <Check size={16} /> Affiliates can sell your products through
                their stores
              </li>
              <li>
                <Check size={16} /> Manage products, orders, and earnings in
                your Business Center
              </li>
            </ul>
            <Link to="/signup" className="bz-button bz-button-gold">
              Start your free website <ArrowRight size={17} />
            </Link>
            <p className="hm-build-note">
              Free websites for sellers AND affiliates. Designed by you.
            </p>
          </div>
        </section>
        <section className="hm-influencer">
          <div>
            <p className="hm-kicker">For influencers & community builders</p>
            <h2>
              Your connections.
              <br />
              Ongoing earning potential.
            </h2>
            <p>
              When a seller or affiliate signs up with your referral code or
              link, you can keep earning from their qualifying sales on Beezio
              while their account and referral remain eligible.
            </p>
            <p>
              Build a network of active sellers and affiliates, and grow your
              earning potential as their sales grow. No inventory to buy or
              orders to ship. Commissions come from qualifying sales, not
              signups; income is not guaranteed.
            </p>
          </div>
          <Link to="/ambassadors" className="bz-button bz-button-ink">
            See how influencer earnings work <ArrowRight size={17} />
          </Link>
        </section>
        <details className="hm-pricing">
          <summary>What does it cost to join Beezio?</summary>
          <p>{pricingExplanation}</p>
          <p>
            Affiliate and influencer earnings come from eligible sales. Earnings
            are not guaranteed and are subject to returns and payout terms.
          </p>
          <Link to="/how-it-works">
            Understand the Beezio model <ArrowRight size={16} />
          </Link>
        </details>
      </div>
    </div>
  );
}

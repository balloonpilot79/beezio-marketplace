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
    text: "Build your own free online store, list your products, and fulfill your orders. Choose which products affiliates can promote.",
    signup: "/signup?role=seller",
    href: "/sellers",
    action: "Start selling",
    icon: Store,
    tone: "seller",
  },
  {
    title: "Promote products as an affiliate.",
    label: "For affiliates",
    text: "Build your own free storefront with products from Beezio sellers. Earn commissions on qualifying sales you bring in, while the seller fulfills the order.",
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
              Beezio is a free online marketplace where you can shop, build your own online store, sell your products, and earn commissions promoting products from other sellers.
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
                  : `/marketplace?category=${encodeURIComponent(category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))}`
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
              <p className="hm-kicker">Store examples</p>
              <h2 id="home-stores-title">Featured stores</h2>
            </div>
            <Link to="/stores" className="hm-all-link">
              Browse all stores <ArrowRight size={17} />
            </Link>
          </div>
          {storesLoading && <p role="status">Loading stores…</p>}
          <div className="hm-store-grid">
            {stores.filter(store => ["loving-jewelry", "marebelle"].includes(store.slug)).slice(0, 2).map(store => (
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
        <p className="hm-build-note">Free websites for sellers AND affiliates. Designed by you.</p>
        <p className="hm-build-note">No seller fees. No listing fees or monthly subscriptions.</p>
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

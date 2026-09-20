import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Globe,
  Megaphone,
  Package,
  ShoppingBag,
  Store,
} from "lucide-react";
import MarketplaceSearch from "../components/MarketplaceSearch";
import { pricingExplanation } from "../components/brand/BeezioBrand";
import { prepareHomeProducts, type HomeProduct } from "../utils/homeCatalog";
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
    text: "Your free website. No seller fees. Affiliates can help drive your sales.",
    href: "/sellers",
    action: "Start selling",
    icon: Store,
    tone: "seller",
  },
  {
    title: "Share great finds. Earn.",
    label: "For affiliates",
    text: "Build a free store with products you choose. Earn commissions on your sales.",
    href: "/affiliates",
    action: "Become an affiliate",
    icon: Globe,
    tone: "affiliate",
  },
  {
    title: "Your influence goes further.",
    label: "For influencers",
    text: "Refer sellers and affiliates. Earn on their eligible sales for the life of the referral.",
    href: "/start-earning",
    action: "Become an influencer",
    icon: Megaphone,
    tone: "influencer",
  },
];

export default function HomePageBZO() {
  const [products, setProducts] = useState<HomeProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [category, setCategory] = useState("All");
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    setLoading(true);
    setError(false);
    (async () => {
      try {
        let response: Response | null = null;
        for (const endpoint of [
          "/api/public/marketplace/products",
          "/.netlify/functions/public-marketplace-products?limit=50",
        ]) {
          const candidate = await fetch(endpoint, {
            signal: controller.signal,
          });
          if (candidate.ok) {
            response = candidate;
            break;
          }
        }
        if (!response) throw new Error("Catalog unavailable");
        const payload = await response.json();
        if (!Array.isArray(payload.products))
          throw new Error("Invalid catalog");
        if (active) setProducts(prepareHomeProducts(payload.products));
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
      Array.from(new Set(products.map((product) => product.category))).slice(
        0,
        7,
      ),
    [products],
  );
  const selected =
    category === "All"
      ? products
      : products.filter((product) => product.category === category);
  const spotlight = products.filter((product) => product.available).slice(0, 2);

  return (
    <div className="hm-page">
      <div className="hm-discovery">
        <div className="hm-wrap">
          <MarketplaceSearch className="hm-mobile-search" />
          <nav aria-label="Explore Beezio" className="hm-discovery-nav">
            <Link to="/marketplace">
              <ShoppingBag size={15} /> All products
            </Link>
            <a href="#shop">New arrivals</a>
            <a href="#categories">Shop by category</a>
            <a href="#stores">Discover stores</a>
            <Link to="/how-it-works">
              How Beezio works <ArrowRight size={14} />
            </Link>
          </nav>
        </div>
      </div>
      <div className="hm-wrap">
        <section className="hm-hero">
          <div className="hm-hero-copy">
            <p className="hm-kicker">Shop. Sell. Share. Earn.</p>
            <h1>
              Good finds.
              <br />
              <span>Great possibilities.</span>
            </h1>
            <p className="hm-hero-description">
              A marketplace to shop. A place to build your business. Discover
              independent brands—or bring your own.
            </p>
            <div className="hm-actions">
              <a href="#shop" className="bz-button bz-button-gold">
                Explore products <ArrowRight size={17} />
              </a>
              <Link to="/signup" className="hm-hero-secondary">
                Build your free website <ArrowRight size={17} />
              </Link>
            </div>
            <p className="hm-hero-note">
              <Check size={14} /> Free websites. No monthly fees. No seller
              fees.
            </p>
          </div>
          <div className="hm-spotlight">
            <div className="hm-spotlight-heading">
              <span>In the spotlight</span>
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
                  </Link>
                ))}
              </div>
            ) : (
              <Link to="/store/marebelle" className="hm-brand-feature">
                <img
                  src="/marebelle-editorial-hero.png"
                  alt="Discover MareBelle's beauty and lifestyle collection"
                />
                <span>
                  Independent brands. Made to discover. <ArrowRight size={18} />
                </span>
              </Link>
            )}
          </div>
        </section>
        <section
          aria-label="Start your business on Beezio"
          className="hm-business-paths"
        >
          {paths.map(
            ({ label, title, text, href, action, icon: Icon, tone }) => (
              <article className={`hm-path hm-path-${tone}`} key={label}>
                <div className="hm-path-top">
                  <Icon size={20} aria-hidden="true" />
                  <p className="hm-kicker">{label}</p>
                </div>
                <h2>{title}</h2>
                <p>{text}</p>
                <Link to={href}>
                  {action}
                  <ArrowRight size={15} />
                </Link>
              </article>
            ),
          )}
        </section>
        <section id="shop" className="hm-shop">
          <div className="hm-section-heading">
            <div>
              <p className="hm-kicker">Find your next favorite</p>
              <h2>Fresh finds. Ready to discover.</h2>
              <p>Shop right here on Beezio. No business account needed.</p>
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
        <section className="hm-earn-banner">
          <div className="hm-earn-icon">
            <Globe size={32} aria-hidden="true" />
          </div>
          <div>
            <p className="hm-kicker">Turn recommendations into commissions</p>
            <h2>Love finding good products? Make it your business.</h2>
            <p>
              Choose products, design your free affiliate website, and earn when
              your recommendations lead to sales.
            </p>
          </div>
          <Link to="/affiliates" className="bz-button bz-button-gold">
            Explore affiliate stores <ArrowRight size={17} />
          </Link>
        </section>
        <section id="stores" className="hm-stores-section">
          <div className="hm-section-heading">
            <div>
              <p className="hm-kicker">A world of individual brands</p>
              <h2>Meet the stores. Find your style.</h2>
            </div>
            <Link to="/signup" className="hm-all-link">
              Your brand could be next <ArrowRight size={17} />
            </Link>
          </div>
          <div className="hm-store-grid">
            <Link to="/store/marebelle" className="hm-store-card hm-marebelle">
              <img
                src="/marebelle-editorial-hero.png"
                alt="MareBelle beauty and equestrian lifestyle collection"
                loading="lazy"
              />
              <div>
                <span>Beauty & equestrian lifestyle</span>
                <h3>MareBelle</h3>
                <p>
                  Discover the collection <ArrowRight size={16} />
                </p>
              </div>
            </Link>
            <Link to="/store/redtail" className="hm-store-card hm-redtail">
              <img
                src="/redtail-coffee-hero.png"
                alt="RedTail coffee"
                loading="lazy"
              />
              <div>
                <span>For your daily ritual</span>
                <h3>RedTail</h3>
                <p>
                  Explore the brand <ArrowRight size={16} />
                </p>
              </div>
            </Link>
            <Link
              to="/store/loving-nutrition"
              className="hm-store-card hm-nutrition"
            >
              <img
                src="/loving-nutrition-logo.png"
                alt="Loving Nutrition"
                loading="lazy"
              />
              <div>
                <span>Everyday wellness</span>
                <h3>Loving Nutrition</h3>
                <p>
                  Explore the brand <ArrowRight size={16} />
                </p>
              </div>
            </Link>
          </div>
          <p className="hm-store-caption">
            Beezio-created brands. Individual stores, connected by one
            marketplace.
          </p>
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
              Your own website.
              <br />
              Your own look.
              <br />
              <em>Yours for free.</em>
            </h2>
            <p>
              Choose a template. Add your logo, colors, collections, and custom
              pages. Sell your own products or build a store around products you
              recommend.
            </p>
            <ul>
              <li>
                <Check size={16} /> No monthly or listing fees
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
              Introduce a business.
              <br />
              Grow together.
            </h2>
            <p>
              Bring sellers and affiliates to Beezio. When their eligible sales
              happen, you earn too—with lifetime referral attribution.
            </p>
          </div>
          <Link to="/start-earning" className="bz-button bz-button-ink">
            See how influencer earnings work <ArrowRight size={17} />
          </Link>
        </section>
        <details className="hm-pricing">
          <summary>No seller fees. How does that work?</summary>
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

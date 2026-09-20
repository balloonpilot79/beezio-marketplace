import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";

export default function MarketplaceSearch({
  className = "",
}: {
  className?: string;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  useEffect(() => {
    setQuery(new URLSearchParams(location.search).get("q") || "");
  }, [location.search]);
  return (
    <form
      role="search"
      aria-label="Search Beezio products"
      className={`bz-market-search ${className}`}
      onSubmit={(event) => {
        event.preventDefault();
        navigate(
          query.trim()
            ? `/marketplace?q=${encodeURIComponent(query.trim())}`
            : "/marketplace",
        );
      }}
    >
      <input
        aria-label="Search products"
        name="q"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search products on Beezio"
      />
      <button type="submit" aria-label="Search">
        <Search size={19} aria-hidden="true" />
      </button>
    </form>
  );
}

import React, { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { useProducts } from "../context/ProductsContext";
import { categories } from "../data/categories";
import { islands } from "../data/locations";
import "./Search.css";

function Search() {
  const { products } = useProducts();
  const [params, setParams] = useSearchParams();

  const [query, setQuery] = useState(params.get("q") || "");
  const [category, setCategory] = useState(params.get("category") || "");
  const [location, setLocation] = useState(params.get("location") || "");
  const [minPrice, setMinPrice] = useState(params.get("min") || "");
  const [maxPrice, setMaxPrice] = useState(params.get("max") || "");
  const [sort, setSort] = useState(params.get("sort") || "newest");
  const [showFilters, setShowFilters] = useState(false);

  // Keep URL in sync with filter state.
  useEffect(() => {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (category) next.set("category", category);
    if (location) next.set("location", location);
    if (minPrice) next.set("min", minPrice);
    if (maxPrice) next.set("max", maxPrice);
    if (sort && sort !== "newest") next.set("sort", sort);
    setParams(next, { replace: true });
  }, [query, category, location, minPrice, maxPrice, sort, setParams]);

  const filtered = useMemo(() => {
    let list = [...products];
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.subcategory.toLowerCase().includes(q)
      );
    }
    if (category) list = list.filter((p) => p.category === category);
    if (location) list = list.filter((p) => p.location.island === location);
    if (minPrice) list = list.filter((p) => Number(p.price) >= Number(minPrice));
    if (maxPrice) list = list.filter((p) => Number(p.price) <= Number(maxPrice));

    switch (sort) {
      case "price-asc":
        list.sort((a, b) => Number(a.price) - Number(b.price));
        break;
      case "price-desc":
        list.sort((a, b) => Number(b.price) - Number(a.price));
        break;
      case "popular":
        list.sort((a, b) => (b.views || 0) - (a.views || 0));
        break;
      case "newest":
      default:
        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return list;
  }, [products, query, category, location, minPrice, maxPrice, sort]);

  const clearAll = () => {
    setQuery("");
    setCategory("");
    setLocation("");
    setMinPrice("");
    setMaxPrice("");
    setSort("newest");
  };

  return (
    <div className="page search-page">
      <div className="container search-layout">
        <aside className={`filters ${showFilters ? "open" : ""}`}>
          <div className="filters-head">
            <h3>Filters</h3>
            <button className="clear" onClick={clearAll}>Clear all</button>
          </div>

          <div className="filter-group">
            <label>Search</label>
            <input
              type="text"
              placeholder="Keyword..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Island</label>
            <select value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="">All islands</option>
              {islands.map((i) => (
                <option key={i.name} value={i.name}>{i.name}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Price range (CVE)</label>
            <div className="price-row">
              <input
                type="number"
                placeholder="Min"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
              />
              <input
                type="number"
                placeholder="Max"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
            </div>
          </div>
        </aside>

        <main className="results">
          <div className="results-head">
            <div>
              <h2 className="page-title">
                {filtered.length} {filtered.length === 1 ? "result" : "results"}
                {query ? ` for "${query}"` : ""}
              </h2>
            </div>
            <div className="results-controls">
              <button
                className="btn btn-outline filter-toggle"
                onClick={() => setShowFilters((v) => !v)}
              >
                {showFilters ? "✕ Hide filters" : "☰ Filters"}
              </button>
              <select
                className="sort-select"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="newest">Newest first</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="popular">Most viewed</option>
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="empty">
              <h3>No results found</h3>
              <p className="muted">Try adjusting your filters or search terms.</p>
              <button className="btn btn-primary" onClick={clearAll}>Reset filters</button>
            </div>
          ) : (
            <div className="product-grid">
              {filtered.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default Search;

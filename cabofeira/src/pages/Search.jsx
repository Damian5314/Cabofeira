import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { ProductCardSkeleton, ProductCardSkeletonGrid } from "../components/Skeleton";
import { useProducts } from "../context/ProductsContext";
import { useT } from "../i18n/I18nContext";
import { categories, getCategoryById } from "../data/categories";
import { islands } from "../data/locations";
import "./Search.css";

const PAGE_SIZE = 24;
const SEARCH_DEBOUNCE_MS = 300;

function Search() {
  const { fetchProducts } = useProducts();
  const t = useT();
  const [params, setParams] = useSearchParams();

  const [searchInput, setSearchInput] = useState(params.get("q") || "");
  const [search, setSearch] = useState(params.get("q") || "");
  const [category, setCategory] = useState(params.get("category") || "");
  const [subcategory, setSubcategory] = useState(params.get("subcategory") || "");
  const [location, setLocation] = useState(params.get("location") || "");
  const [minPrice, setMinPrice] = useState(params.get("min") || "");
  const [maxPrice, setMaxPrice] = useState(params.get("max") || "");
  const [sort, setSort] = useState(params.get("sort") || "newest");
  const [showFilters, setShowFilters] = useState(false);

  const categoryObj = getCategoryById(category);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const requestIdRef = useRef(0);
  const writtenParams = useRef(params.toString());
  useEffect(() => {
    if (params.toString() === writtenParams.current) return;
    writtenParams.current = params.toString();
    setSearchInput(params.get("q") || ""); setSearch(params.get("q") || "");
    setCategory(params.get("category") || ""); setSubcategory(params.get("subcategory") || "");
    setLocation(params.get("location") || ""); setMinPrice(params.get("min") || "");
    setMaxPrice(params.get("max") || ""); setSort(params.get("sort") || "newest");
  }, [params]);

  useEffect(() => {
    const tm = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(tm);
  }, [searchInput]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (search) next.set("q", search);
    if (category) next.set("category", category);
    if (subcategory) next.set("subcategory", subcategory);
    if (location) next.set("location", location);
    if (minPrice) next.set("min", minPrice);
    if (maxPrice) next.set("max", maxPrice);
    if (sort && sort !== "newest") next.set("sort", sort);
    writtenParams.current = next.toString();
    setParams(next, { replace: true });
  }, [search, category, subcategory, location, minPrice, maxPrice, sort, setParams]);

  const runQuery = useCallback(
    async (offset, append) => {
      const myId = ++requestIdRef.current;
      if (append) setLoadingMore(true);
      else { setLoading(true); setItems([]); setTotal(0); }
      setError("");
      try {
        const { items: page, total: tt } = await fetchProducts({
          search,
          category,
          subcategory,
          island: location,
          minPrice,
          maxPrice,
          sort,
          range: [offset, offset + PAGE_SIZE - 1],
        });
        if (myId !== requestIdRef.current) return;
        setTotal(tt);
        setItems((prev) => (append ? [...prev, ...page] : page));
      } catch (e) {
        if (myId !== requestIdRef.current) return;
        setError(t("common.error"));
      } finally {
        if (myId !== requestIdRef.current) return;
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [fetchProducts, search, category, subcategory, location, minPrice, maxPrice, sort, t]
  );

  useEffect(() => {
    runQuery(0, false);
  }, [runQuery]);

  const loadMore = () => {
    if (loadingMore || items.length >= total) return;
    runQuery(items.length, true);
  };

  const clearAll = () => {
    setSearchInput("");
    setSearch("");
    setCategory("");
    setSubcategory("");
    setLocation("");
    setMinPrice("");
    setMaxPrice("");
    setSort("newest");
  };

  const hasMore = items.length < total;

  return (
    <div className="page search-page">
      <div className="container search-layout">
        <aside className={`filters ${showFilters ? "open" : ""}`}>
          <div className="filters-head">
            <h3>{t("search.filtersTitle")}</h3>
            <button className="clear" onClick={clearAll}>{t("search.clearAll")}</button>
          </div>

          <div className="filter-group">
            <label htmlFor="search-keyword">{t("search.keyword")}</label>
            <input
              type="text"
              id="search-keyword"
              placeholder={t("search.keywordPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="search-category">{t("search.category")}</label>
            <select
              id="search-category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setSubcategory("");
              }}
            >
              <option value="">{t("search.allCategories")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{t(`categories.${c.id}`)}</option>
              ))}
            </select>
          </div>

          {categoryObj && (
            <div className="filter-group">
              <label htmlFor="search-subcategory">{t("search.subcategory")}</label>
              <select
                id="search-subcategory"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
              >
                <option value="">{t("search.allSubcategories")}</option>
                {categoryObj.subcategories.map((s) => (
                  <option key={s} value={s}>{t(`subcategories.${s}`)}</option>
                ))}
              </select>
            </div>
          )}

          <div className="filter-group">
            <label htmlFor="search-island">{t("search.island")}</label>
            <select id="search-island" value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="">{t("search.allIslands")}</option>
              {islands.map((i) => (
                <option key={i.name} value={i.name}>{i.name}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>{t("search.priceRange")}</label>
            <div className="price-row">
              <input
                type="number"
                placeholder={t("search.min")}
                aria-label={t("search.min")}
                min="0"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
              />
              <input
                type="number"
                placeholder={t("search.max")}
                aria-label={t("search.max")}
                min="0"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
            </div>
          </div>
        </aside>

        <section className="results">
          <div className="results-head">
            <div>
              <h1 className="page-title" aria-live="polite">
                {error ? t("common.error") : loading
                  ? t("search.searching")
                  : total === 1
                  ? t("search.result", { count: total })
                  : t("search.results", { count: total })}
                {search ? ` ${t("search.resultsFor", { q: search })}` : ""}
              </h1>
            </div>
            <div className="results-controls">
              <button
                className="btn btn-outline filter-toggle"
                aria-expanded={showFilters}
                onClick={() => setShowFilters((v) => !v)}
              >
                {showFilters ? t("search.hideFilters") : t("search.showFilters")}
              </button>
              <select
                className="sort-select"
                aria-label={t("accessibility.sort")}
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="newest">{t("search.sort.newest")}</option>
                <option value="price-asc">{t("search.sort.priceAsc")}</option>
                <option value="price-desc">{t("search.sort.priceDesc")}</option>
                <option value="popular">{t("search.sort.popular")}</option>
              </select>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              style={{
                color: "#b00020",
                background: "#fdecea",
                padding: "10px 14px",
                borderRadius: 8,
                marginBottom: 12,
              }}
            >
              {error}
              <button className="btn btn-outline" onClick={() => runQuery(0, false)}>{t("accessibility.retry")}</button>
            </div>
          )}

          {loading && items.length === 0 ? (
            <ProductCardSkeletonGrid count={PAGE_SIZE} />
          ) : !loading && !error && items.length === 0 ? (
            <div className="empty">
              <h3>{t("search.noResults")}</h3>
              <p className="muted">{t("search.noResultsHint")}</p>
              <button className="btn btn-primary" onClick={clearAll}>{t("search.reset")}</button>
            </div>
          ) : (
            <>
              <div className="product-grid">
                {items.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
                {loadingMore &&
                  Array.from({ length: 4 }).map((_, i) => (
                    <ProductCardSkeleton key={`sk-${i}`} />
                  ))}
              </div>

              {hasMore && !loadingMore && !error && (
                <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
                  <button className="btn btn-outline" onClick={loadMore}>
                    {t("common.loadMoreLeft", { count: total - items.length })}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export default Search;

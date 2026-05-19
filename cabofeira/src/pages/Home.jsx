import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { ProductCardSkeletonGrid } from "../components/Skeleton";
import AdSlot from "../components/AdSlot";
import { isAdSlotVisible } from "../config/features";
import { useProducts } from "../context/ProductsContext";
import { useT } from "../i18n/I18nContext";
import { categories, CategoryIcon } from "../data/categories";
import { islands } from "../data/locations";
import "./Home.css";

function Home() {
  const navigate = useNavigate();
  const { products, productsLoading } = useProducts();
  const t = useT();

  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");

  const featured = products.filter((p) => p.featured).slice(0, 4);
  const recent = [...products]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8);

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (location) params.set("location", location);
    if (category) params.set("category", category);
    navigate(`/search?${params.toString()}`);
  };

  return (
    <div className="home">
      <section className="hero-section">
        <div className="hero-overlay">
          <h1>
            {t("home.heroTitlePre")} <span className="highlight">{t("home.heroAnything")}</span> {t("home.heroTitlePost")}
          </h1>
          <p className="hero-sub">{t("home.heroSub")}</p>
          <form className="hero-search" onSubmit={handleSearch}>
            <input
              type="text"
              placeholder={t("home.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">{t("home.allCategories")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {t(`categories.${c.id}`)}
                </option>
              ))}
            </select>
            <select value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="">{t("home.allIslands")}</option>
              {islands.map((i) => (
                <option key={i.name} value={i.name}>{i.name}</option>
              ))}
            </select>
            <button type="submit" className="btn btn-primary">{t("common.search")}</button>
          </form>
          <div className="hero-stats">
            <span><strong>{products.length}</strong> {t("home.statsListings")}</span>
            <span>•</span>
            <span><strong>9</strong> {t("home.statsIslands")}</span>
            <span>•</span>
            <span><strong>{categories.length}</strong> {t("home.statsCategories")}</span>
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="container">
          <div className="section-header">
            <h2>{t("home.browseByCategory")}</h2>
            <Link to="/categories" className="muted">{t("home.seeAll")}</Link>
          </div>
          <div className="category-grid">
            {categories.slice(0, 8).map((c) => (
              <Link
                to={`/search?category=${c.id}`}
                key={c.id}
                className="category-tile"
              >
                <span className="category-icon"><CategoryIcon category={c} size={36} /></span>
                <span>{t(`categories.${c.id}`)}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {isAdSlotVisible("home-top") && (
        <section className="home-section">
          <div className="container">
            <AdSlot placement="home-top" />
          </div>
        </section>
      )}

      {(productsLoading || featured.length > 0) && (
        <section className="home-section">
          <div className="container">
            <div className="section-header">
              <h2>{t("home.featured")}</h2>
              <Link to="/search" className="muted">{t("home.seeAll")}</Link>
            </div>
            {productsLoading ? (
              <ProductCardSkeletonGrid count={4} />
            ) : (
              <div className="product-grid">
                {featured.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="home-section">
        <div className="container">
          <div className="section-header">
            <h2>{t("home.latest")}</h2>
            <Link to="/search" className="muted">{t("home.seeAll")}</Link>
          </div>
          {productsLoading ? (
            <ProductCardSkeletonGrid count={8} />
          ) : (
            <div className="product-grid">
              {recent.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="cta-section">
        <div className="container cta-inner">
          <div>
            <h2>{t("home.ctaTitle")}</h2>
            <p>{t("home.ctaSub")}</p>
          </div>
          <Link to="/postad" className="btn btn-primary cta-btn">{t("home.ctaButton")}</Link>
        </div>
      </section>
    </div>
  );
}

export default Home;

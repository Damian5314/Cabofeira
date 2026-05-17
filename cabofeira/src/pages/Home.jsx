import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { useProducts } from "../context/ProductsContext";
import { categories, CategoryIcon } from "../data/categories";
import { islands } from "../data/locations";
import "./Home.css";

function Home() {
  const navigate = useNavigate();
  const { products } = useProducts();

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
            Buy and sell <span className="highlight">anything</span> in Cabo Verde
          </h1>
          <p className="hero-sub">
            From cars and apartments to fresh fish and handmade pano —
            your local marketplace across all 9 islands.
          </p>
          <form className="hero-search" onSubmit={handleSearch}>
            <input
              type="text"
              placeholder="What are you looking for?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="">All Islands</option>
              {islands.map((i) => (
                <option key={i.name} value={i.name}>{i.name}</option>
              ))}
            </select>
            <button type="submit" className="btn btn-primary">Search</button>
          </form>
          <div className="hero-stats">
            <span><strong>{products.length}</strong> active listings</span>
            <span>•</span>
            <span><strong>9</strong> islands</span>
            <span>•</span>
            <span><strong>{categories.length}</strong> categories</span>
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="container">
          <div className="section-header">
            <h2>Browse by category</h2>
            <Link to="/categories" className="muted">See all →</Link>
          </div>
          <div className="category-grid">
            {categories.slice(0, 8).map((c) => (
              <Link
                to={`/search?category=${c.id}`}
                key={c.id}
                className="category-tile"
              >
                <span className="category-icon"><CategoryIcon category={c} size={36} /></span>
                <span>{c.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="home-section">
          <div className="container">
            <div className="section-header">
              <h2>★ Featured listings</h2>
              <Link to="/search" className="muted">See all →</Link>
            </div>
            <div className="product-grid">
              {featured.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="home-section">
        <div className="container">
          <div className="section-header">
            <h2>Latest ads</h2>
            <Link to="/search" className="muted">See all →</Link>
          </div>
          <div className="product-grid">
            {recent.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="container cta-inner">
          <div>
            <h2>Have something to sell?</h2>
            <p>Reach buyers from Praia to Mindelo in just a few clicks. It's free.</p>
          </div>
          <Link to="/postad" className="btn btn-primary cta-btn">+ Post your ad now</Link>
        </div>
      </section>
    </div>
  );
}

export default Home;

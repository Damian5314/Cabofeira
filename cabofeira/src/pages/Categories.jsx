import React from "react";
import { Link } from "react-router-dom";
import { categories, CategoryIcon } from "../data/categories";
import { useProducts } from "../context/ProductsContext";
import "./Categories.css";

function Categories() {
  const { products } = useProducts();

  const count = (catId) => products.filter((p) => p.category === catId).length;

  return (
    <div className="page categories-page">
      <div className="container">
        <h1 className="page-title">All categories</h1>
        <p className="muted">Browse listings by category across all islands of Cabo Verde.</p>

        <div className="cat-grid">
          {categories.map((c) => (
            <div key={c.id} className="cat-card">
              <Link to={`/search?category=${c.id}`} className="cat-card-head">
                <span className="cat-icon"><CategoryIcon category={c} size={32} /></span>
                <div>
                  <h3>{c.name}</h3>
                  <span className="muted small">{count(c.id)} ads</span>
                </div>
              </Link>
              <ul className="cat-subs">
                {c.subcategories.map((s) => (
                  <li key={s}>
                    <Link to={`/search?category=${c.id}&q=${encodeURIComponent(s)}`}>{s}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Categories;

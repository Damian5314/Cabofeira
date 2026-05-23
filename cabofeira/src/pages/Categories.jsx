import React from "react";
import { Link } from "react-router-dom";
import { categories, CategoryIcon } from "../data/categories";
import { useProducts } from "../context/ProductsContext";
import { useT } from "../i18n/I18nContext";
import "./Categories.css";

function Categories() {
  const { products } = useProducts();
  const t = useT();

  const count = (catId) => products.filter((p) => p.category === catId).length;

  return (
    <div className="page categories-page">
      <div className="container">
        <h1 className="page-title">{t("categoriesPage.title")}</h1>
        <p className="muted">{t("categoriesPage.intro")}</p>

        <div className="cat-grid">
          {categories.map((c) => (
            <div key={c.id} className="cat-card">
              <Link to={`/search?category=${c.id}`} className="cat-card-head">
                <span className="cat-icon"><CategoryIcon category={c} size={32} /></span>
                <div>
                  <h3>{t(`categories.${c.id}`)}</h3>
                  <span className="muted small">{t("categoriesPage.ads", { count: count(c.id) })}</span>
                </div>
              </Link>
              <ul className="cat-subs">
                {c.subcategories.map((s) => (
                  <li key={s}>
                    <Link to={`/search?category=${c.id}&subcategory=${encodeURIComponent(s)}`}>{t(`subcategories.${s}`)}</Link>
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

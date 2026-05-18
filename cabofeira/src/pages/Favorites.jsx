import React from "react";
import { Link } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { useProducts } from "../context/ProductsContext";
import { useT } from "../i18n/I18nContext";

function Favorites() {
  const { products, favorites } = useProducts();
  const t = useT();
  const favProducts = products.filter((p) => favorites.includes(p.id));

  return (
    <div className="page">
      <div className="container">
        <h1 className="page-title">❤️ {t("favorites.title")}</h1>
        <p className="muted">
          {favProducts.length === 1
            ? t("myAds.activeListing", { count: favProducts.length })
            : t("myAds.activeListings", { count: favProducts.length })}
        </p>

        {favProducts.length === 0 ? (
          <div className="empty" style={{ marginTop: 30 }}>
            <h3>{t("favorites.empty")}</h3>
            <p className="muted">{t("favorites.emptyHint")}</p>
            <Link to="/search" className="btn btn-primary">{t("favorites.browse")}</Link>
          </div>
        ) : (
          <div className="product-grid" style={{ marginTop: 20 }}>
            {favProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Favorites;

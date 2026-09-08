import React, { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { useProducts } from "../context/ProductsContext";
import { useT } from "../i18n/I18nContext";
import { useAuth } from "../context/AuthContext";
import useListingPage from "../hooks/useListingPage";

function Favorites() {
  const { favorites } = useProducts();
  const { user } = useAuth();
  const [page, setPage] = useState(0);
  const t = useT();
  const { items: favProducts, loading, error } = useListingPage({ ids: favorites.slice(page * 24, page * 24 + 24), status: ["active", "sold"] }, !!user && favorites.length > 0);
  if (!user) return <Navigate to="/login?redirect=/favorites" replace />;

  return (
    <div className="page">
      <div className="container">
        <h1 className="page-title">❤️ {t("favorites.title")}</h1>
        <p className="muted">
          {favProducts.length === 1
            ? t("myAds.activeListing", { count: favProducts.length })
            : t("myAds.activeListings", { count: favProducts.length })}
        </p>

        {loading ? <p role="status">{t("common.loading")}</p> : error ? <p role="alert">{t("common.error")}</p> : favProducts.length === 0 ? (
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
        <div className="form-actions">
          {page > 0 && <button className="btn btn-outline" onClick={() => setPage(page - 1)}>{t("common.back")}</button>}
          {(page + 1) * 24 < favorites.length && <button className="btn btn-outline" onClick={() => setPage(page + 1)}>{t("common.continue")}</button>}
        </div>
      </div>
    </div>
  );
}

export default Favorites;

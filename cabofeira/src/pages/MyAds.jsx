import React, { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useProducts } from "../context/ProductsContext";
import { useT } from "../i18n/I18nContext";
import { formatPrice, timeAgo } from "../utils/format";
import ConfirmDialog from "../components/ConfirmDialog";
import "./MyAds.css";

function MyAds() {
  const { user } = useAuth();
  const { userProducts, removeProduct } = useProducts();
  const t = useT();
  const [pendingDelete, setPendingDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!user) return <Navigate to="/login?redirect=/profile/ads" replace />;

  const myAds = userProducts(user.id);

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await removeProduct(pendingDelete.id);
    } finally {
      setBusy(false);
      setPendingDelete(null);
    }
  };

  return (
    <div className="page my-ads-page">
      <div className="container">
        <div className="my-ads-head">
          <div>
            <h1 className="page-title">{t("myAds.title")}</h1>
            <p className="muted">
              {myAds.length === 1
                ? t("myAds.activeListing", { count: myAds.length })
                : t("myAds.activeListings", { count: myAds.length })}
            </p>
          </div>
          <Link to="/postad" className="btn btn-primary">{t("myAds.postNew")}</Link>
        </div>

        {myAds.length === 0 ? (
          <div className="empty">
            <h3>{t("myAds.noAds")}</h3>
            <p className="muted">{t("myAds.noAdsHint")}</p>
            <Link to="/postad" className="btn btn-primary">{t("myAds.postFirst")}</Link>
          </div>
        ) : (
          <div className="my-ads-list">
            {myAds.map((p) => (
              <div key={p.id} className="my-ad-row">
                <Link to={`/product/${p.id}`} className="my-ad-img">
                  <img src={p.images[0]} alt={p.title} />
                </Link>
                <div className="my-ad-body">
                  <Link to={`/product/${p.id}`} className="my-ad-title">
                    {p.title}
                  </Link>
                  <div className="my-ad-meta">
                    <span>{formatPrice(p.price, p.currency)}</span>
                    <span>•</span>
                    <span>👁 {p.views} {t("product.viewsLabel")}</span>
                    <span>•</span>
                    <span>{timeAgo(p.createdAt)}</span>
                  </div>
                  <div className="my-ad-tags">
                    {p.featured && <span className="badge badge-featured">{t("product.featuredBadge")}</span>}
                    <span className="badge">{p.location.city}, {p.location.island}</span>
                  </div>
                </div>
                <div className="my-ad-actions">
                  <Link to={`/edit/${p.id}`} className="btn btn-outline">✏️ {t("common.edit")}</Link>
                  <button
                    className="btn btn-outline btn-danger-outline"
                    onClick={() => setPendingDelete(p)}
                  >
                    🗑 {t("common.delete")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title={t("myAds.deleteTitle")}
        message={pendingDelete ? t("myAds.deleteMessage", { title: pendingDelete.title }) : null}
        confirmLabel={t("myAds.deleteConfirm")}
        danger
        busy={busy}
        onConfirm={handleConfirmDelete}
        onCancel={() => !busy && setPendingDelete(null)}
      />
    </div>
  );
}

export default MyAds;

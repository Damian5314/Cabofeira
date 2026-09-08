import ListingImage from "../components/ListingImage";
import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useProducts } from "../context/ProductsContext";
import { useT, useI18n } from "../i18n/I18nContext";
import { useToast } from "../components/Toast";
import { formatPrice, timeAgo } from "../utils/format";
import ConfirmDialog from "../components/ConfirmDialog";
import "./MyAds.css";

function MyAds() {
  const { user } = useAuth();
  const { fetchProducts, removeProduct, updateProduct } = useProducts();
  const t = useT();
  const { locale } = useI18n();
  const toast = useToast();
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingStatus, setPendingStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [myAds, setMyAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    setLoading(true);
    setLoadError(false);
    fetchProducts({ sellerId: user.id, status: null, range: [page * 24, page * 24 + 23] })
      .then(({ items, total: count }) => { if (alive) { setMyAds(items); setTotal(count); } })
      .catch(() => { if (alive) setLoadError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [user, page, fetchProducts]);

  if (!user) return <Navigate to="/login?redirect=/profile/ads" replace />;


  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await removeProduct(pendingDelete.id);
      setMyAds((prev) => prev.filter((p) => p.id !== pendingDelete.id));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch {
      toast.error(t("common.error"));
    } finally {
      setBusy(false);
      setPendingDelete(null);
    }
  };

  // Mark-as-sold is reversible (D-11/D-12): flip status sold <-> active via
  // updateProduct. updateProduct already mirrors the change into the products
  // cache, so the row's badge/label updates without a manual optimistic patch.
  const handleConfirmStatus = async () => {
    if (!pendingStatus) return;
    const next = pendingStatus.status === "sold" ? "active" : "sold";
    setBusy(true);
    try {
      const updated = await updateProduct(pendingStatus.id, { status: next });
      setMyAds((prev) => prev.map((p) => p.id === updated.id ? updated : p));
    } catch (err) {
      toast.error(t("common.error"));
    } finally {
      setBusy(false);
      setPendingStatus(null);
    }
  };

  const isSold = pendingStatus?.status === "sold";

  return (
    <div className="page my-ads-page">
      <div className="container">
        <div className="my-ads-head">
          <div>
            <h1 className="page-title">{t("myAds.title")}</h1>
            <p className="muted">
              {loading || loadError ? "—" : t("myAds.totalListings", { count: total })}
            </p>
          </div>
          <Link to="/postad" className="btn btn-primary">{t("myAds.postNew")}</Link>
        </div>

        {loading ? <p role="status">{t("search.searching")}</p> : loadError ? <p role="alert">{t("common.error")}</p> : myAds.length === 0 ? (
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
                  <ListingImage src={p.images[0]} alt={p.title} />
                </Link>
                <div className="my-ad-body">
                  <Link to={`/product/${p.id}`} className="my-ad-title">
                    {p.title}
                  </Link>
                  <div className="my-ad-meta">
                    <span>{formatPrice(p.price, p.currency, locale)}</span>
                    <span>•</span>
                    <span>👁 {p.views} {t("product.viewsLabel")}</span>
                    <span>•</span>
                    <span>{timeAgo(p.createdAt, locale)}</span>
                  </div>
                  <div className="my-ad-tags">
                    {p.status === "sold" && <span className="badge badge-sold">{t("badge.sold")}</span>}
                    {p.featured && <span className="badge badge-featured">{t("product.featuredBadge")}</span>}
                    <span className="badge">{p.location.city}, {p.location.island}</span>
                  </div>
                </div>
                <div className="my-ad-actions">
                  <Link to={`/edit/${p.id}`} className="btn btn-outline">✏️ {t("common.edit")}</Link>
                  <button
                    className="btn btn-outline"
                    disabled={busy || !["active", "sold"].includes(p.status)}
                    onClick={() => setPendingStatus(p)}
                  >
                    {p.status === "sold" ? t("myAds.markActive") : t("myAds.markSold")}
                  </button>
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
        <div className="form-actions">
          {page > 0 && <button className="btn btn-outline" disabled={loading} onClick={() => setPage(page - 1)}>{t("common.back")}</button>}
          {(page + 1) * 24 < total && <button className="btn btn-outline" disabled={loading} onClick={() => setPage(page + 1)}>{t("common.continue")}</button>}
        </div>
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

      <ConfirmDialog
        open={!!pendingStatus}
        title={isSold ? t("myAds.markActiveTitle") : t("myAds.markSoldTitle")}
        message={isSold ? t("myAds.markActiveBody") : t("myAds.markSoldBody")}
        confirmLabel={isSold ? t("myAds.markActive") : t("myAds.markSold")}
        busy={busy}
        onConfirm={handleConfirmStatus}
        onCancel={() => !busy && setPendingStatus(null)}
      />
    </div>
  );
}

export default MyAds;

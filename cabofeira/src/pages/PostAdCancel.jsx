import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useProducts } from "../context/ProductsContext";
import { useT } from "../i18n/I18nContext";
import { useToast } from "../components/Toast";
import { supabase } from "../lib/supabase";
import ConfirmDialog from "../components/ConfirmDialog";

export default function PostAdCancel() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { removeProduct } = useProducts();
  const t = useT();
  const toast = useToast();
  const productId = params.get("product_id");
  const [retrying, setRetrying] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const retry = async () => {
    if (!productId) return;
    setRetrying(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("create-checkout-session", {
      body: { productId, origin: window.location.origin, locale: localStorage.getItem("cabofeira_locale") || "en" },
      headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
    });
    setRetrying(false);
    if (error || !data?.url) {
      toast.error(error?.message || "Could not start checkout.");
      return;
    }
    window.location.href = data.url;
  };

  const handleDelete = async () => {
    if (!productId) return;
    setDeleting(true);
    try {
      await removeProduct(productId);
      navigate("/profile/ads", { replace: true });
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (!productId) {
    navigate("/", { replace: true });
    return null;
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 520, textAlign: "center", padding: "60px 20px" }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>😕</div>
        <h1>{t("postAd.paymentCancelled")}</h1>
        <p className="muted" style={{ marginBottom: 24 }}>{t("postAd.paymentCancelledHint")}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={retry} disabled={retrying}>
            {retrying ? t("common.loading") : t("postAd.retryPayment")}
          </button>
          <Link to="/profile/ads" className="btn btn-outline">{t("postAd.myAds")}</Link>
          <button
            className="btn btn-outline btn-danger-outline"
            onClick={() => setConfirmDelete(true)}
          >
            {t("postAd.deleteDraft")}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={t("myAds.deleteTitle")}
        message={t("myAds.deleteMessage", { title: "this draft" })}
        confirmLabel={t("postAd.deleteDraft")}
        danger
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => !deleting && setConfirmDelete(false)}
      />
    </div>
  );
}

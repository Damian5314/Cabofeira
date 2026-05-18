import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useProducts } from "../context/ProductsContext";
import { useT } from "../i18n/I18nContext";
import { supabase } from "../lib/supabase";

export default function PostAdSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { fetchProduct } = useProducts();
  const t = useT();

  const productId = params.get("product_id");
  const [paid, setPaid] = useState(false);
  const [attempts, setAttempts] = useState(0);

  // Webhook may take a second to flip the status. Poll a few times.
  useEffect(() => {
    if (!productId) return;
    let alive = true;
    const tick = async () => {
      const { data } = await supabase
        .from("products")
        .select("id, payment_status")
        .eq("id", productId)
        .maybeSingle();
      if (!alive) return;
      if (data && (data.payment_status === "paid" || data.payment_status === "free")) {
        setPaid(true);
        fetchProduct(productId);
      } else if (attempts < 6) {
        setAttempts((a) => a + 1);
      }
    };
    tick();
    const interval = setInterval(tick, 1500);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [productId, attempts, fetchProduct]);

  if (!productId) {
    navigate("/", { replace: true });
    return null;
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 520, textAlign: "center", padding: "60px 20px" }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>{paid ? "🎉" : "⏳"}</div>
        <h1>{paid ? t("postAd.paymentSuccess") : t("postAd.redirectingPayment")}</h1>
        {paid ? (
          <p className="muted" style={{ marginBottom: 24 }}>{t("postAd.redirecting")}</p>
        ) : (
          <p className="muted" style={{ marginBottom: 24 }}>
            {t("common.loading")}
          </p>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Link to={`/product/${productId}`} className="btn btn-primary">
            {t("postAd.viewAd")}
          </Link>
          <Link to="/profile/ads" className="btn btn-outline">
            {t("postAd.myAds")}
          </Link>
        </div>
      </div>
    </div>
  );
}

import ListingImage from "../components/ListingImage";
import React, { useEffect, useRef, useId, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useProducts } from "../context/ProductsContext";
import { useAuth } from "../context/AuthContext";
import { useT, useI18n } from "../i18n/I18nContext";
import { getCategoryById, CategoryIcon } from "../data/categories";
import { supabase } from "../lib/supabase";
import Skeleton from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { formatPrice, timeAgo } from "../utils/format";
import ProductCard from "../components/ProductCard";
import "./ProductDetail.css";
import { whatsappNumber } from "../utils/links";
import BlockUserButton from "../components/BlockUserButton";
import useDialogFocus from "../hooks/useDialogFocus";

function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getProduct, fetchProduct, products, isFavorite, toggleFavorite, incrementViews } =
    useProducts();
  const { user } = useAuth();
  const toast = useToast();
  const t = useT();
  const { locale } = useI18n();

  const cached = getProduct(id);
  const [product, setProduct] = useState(cached || null);
  const [loadingProduct, setLoadingProduct] = useState(!cached);
  const [activeImage, setActiveImage] = useState(0);
  const [showPhone, setShowPhone] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [messageSent, setMessageSent] = useState(false);
  const [messageSending, setMessageSending] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSending, setReportSending] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportSent, setReportSent] = useState(false);

  useEffect(() => {
    let alive = true;
    setActiveImage(0);
    setShowPhone(false);
    setMessageOpen(false);
    setMessageText("");
    setReportOpen(false);
    setLoadingProduct(true);
    fetchProduct(id).then((p) => {
      if (!alive) return;
      setProduct(p);
      setLoadingProduct(false);
      if (p) incrementViews(p.id);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loadingProduct) {
    return (
      <div className="page product-detail">
        <div className="container">
          <Skeleton width={180} height={14} style={{ marginBottom: 18 }} />
          <div className="detail-grid">
            <div className="gallery">
              <Skeleton width="100%" height={420} radius={12} />
              <div className="thumbs" style={{ marginTop: 10 }}>
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} width={70} height={70} radius={8} style={{ marginRight: 6 }} />
                ))}
              </div>
            </div>
            <aside className="detail-side">
              <div className="detail-card">
                <Skeleton width="90%" height={28} style={{ marginBottom: 12 }} />
                <Skeleton width="50%" height={32} style={{ marginBottom: 18 }} />
                <Skeleton width="70%" height={14} style={{ marginBottom: 8 }} />
                <Skeleton width="40%" height={14} style={{ marginBottom: 24 }} />
                <Skeleton width="100%" height={44} radius={10} style={{ marginBottom: 8 }} />
                <Skeleton width="100%" height={44} radius={10} style={{ marginBottom: 8 }} />
                <Skeleton width="100%" height={44} radius={10} />
              </div>
            </aside>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="page container">
        <div className="empty">
          <h2>{t("product.notFound")}</h2>
          <p className="muted">{t("product.notFoundHint")}</p>
          <Link to="/search" className="btn btn-primary">{t("product.browseOther")}</Link>
        </div>
      </div>
    );
  }

  const isOwner = user && user.id === product.seller.id;
  const category = getCategoryById(product.category);

  const similar = products
    .filter((p) => p.status === "active" && p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  const sendMessage = async () => {
    if (!user) {
      navigate(`/login?redirect=/product/${product.id}`);
      return;
    }
    const text = messageText.trim();
    if (!text || messageSending) return;
    setMessageSending(true);
    try {

    let convId;
    const { data: existing, error: findErr } = await supabase
      .from("conversations")
      .select("id")
      .eq("product_id", product.id)
      .eq("buyer_id", user.id)
      .eq("seller_id", product.seller.id)
      .maybeSingle();

    if (findErr) {
      toast.error(t("messages.sendFailed"));
      return;
    }

    if (existing) {
      convId = existing.id;
    } else {
      const { data: created, error: insertErr } = await supabase
        .from("conversations")
        .insert({
          product_id: product.id,
          buyer_id: user.id,
          seller_id: product.seller.id,
        })
        .select("id")
        .single();
      if (insertErr) {
        toast.error(t("messages.sendFailed"));
        return;
      }
      convId = created.id;
    }

    const { error: msgErr } = await supabase
      .from("messages")
      .insert({ conversation_id: convId, sender_id: user.id, body: text });
    if (msgErr) {
      toast.error(t("messages.sendFailed"));
      return;
    }

    setMessageSent(true);
    setMessageText("");
    setTimeout(() => {
      setMessageOpen(false);
      setMessageSent(false);
    }, 1500);
    } catch { toast.error(t("messages.sendFailed")); }
    finally { setMessageSending(false); }
  };

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: product.title, url });
      } catch {
        /* user cancelled */
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast.success(t("product.linkCopied"));
      } catch { toast.error(t("common.error")); }
    }
  };

  const fav = isFavorite(product.id);

  return (
    <div className="page product-detail">
      <div className="container">
        <nav className="breadcrumbs">
          <Link to="/">{t("nav.home")}</Link> ›{" "}
          <Link to={`/search?category=${product.category}`}>
            {t(`categories.${product.category}`)}
          </Link>{" "}
          › <span>{t(`subcategories.${product.subcategory}`)}</span>
        </nav>

        <div className="detail-grid">
          <div className="gallery">
            <div className="gallery-main">
              <ListingImage src={product.images[activeImage]} alt={product.title} />
              {product.featured && (
                <span className="badge badge-featured gallery-badge">{t("product.featuredBadge")}</span>
              )}
            </div>
            {product.images.length > 1 && (
              <div className="thumbs">
                {product.images.map((src, i) => (
                  <button
                    key={i}
                    className={`thumb ${activeImage === i ? "is-active" : ""}`}
                    onClick={() => setActiveImage(i)}
                  >
                    <ListingImage src={src} alt={`${product.title} ${i + 1}`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <aside className="detail-side">
            <div className="detail-card">
              <h1 className="detail-title">{product.title}</h1>
              <div className="detail-price">
                {formatPrice(product.price, product.currency, locale)}
              </div>
              <div className="detail-meta">
                <span>📍 {product.location.city}, {product.location.island}</span>
                <span>•</span>
                <span>🗓 {timeAgo(product.createdAt, locale)}</span>
                <span>•</span>
                <span>👁 {product.views} {t("product.viewsLabel")}</span>
              </div>
              <div className="detail-tags">
                {product.status === "sold" && <span className="badge badge-sold">{t("badge.sold")}</span>}
                <span className="badge"><CategoryIcon category={category} size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />{t(`categories.${product.category}`)}</span>
                <span className="badge">{t(`subcategories.${product.subcategory}`)}</span>
                <span className={`badge ${product.condition === "New" ? "badge-new" : ""}`}>
                  {product.condition === "New"
                    ? t("postAd.conditionNew")
                    : product.condition === "Used"
                    ? t("postAd.conditionUsed")
                    : t("postAd.conditionParts")}
                </span>
              </div>

              <div className="detail-actions">
                {isOwner ? (
                  <>
                    <Link to={`/edit/${product.id}`} className="btn btn-primary btn-block">
                      {t("product.editAd")}
                    </Link>
                    <Link to="/profile/ads" className="btn btn-outline btn-block">
                      {t("product.manageAds")}
                    </Link>
                  </>
                ) : (
                  <>
                    {product.seller.phone && (
                      <button
                        className="btn btn-primary btn-block"
                        onClick={() => setShowPhone(true)}
                      >
                        📞 {showPhone ? product.seller.phone : t("product.showPhone")}
                      </button>
                    )}
                    {whatsappNumber(product.seller.phone) && (
                      <a className="btn btn-outline btn-block" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${whatsappNumber(product.seller.phone)}?text=${encodeURIComponent(t("product.message.about", { title: product.title }) + " " + window.location.origin + "/product/" + product.id)}`}>WhatsApp</a>
                    )}
                    {product.seller.email && (
                      <a
                        href={`mailto:${product.seller.email}?subject=${encodeURIComponent(t("product.message.about", { title: product.title }))}`}
                        className="btn btn-outline btn-block"
                      >
                        {t("product.emailSeller")}
                      </a>
                    )}
                    <button
                      className="btn btn-outline btn-block"
                      onClick={() => setMessageOpen(true)}
                    >
                      {t("product.sendMessage")}
                    </button>
                  </>
                )}

                <div className="action-row">
                  <button
                    className={`btn btn-outline ${fav ? "is-fav" : ""}`}
                    onClick={() => toggleFavorite(product.id)}
                  >
                    {fav ? t("product.saved") : t("product.save")}
                  </button>
                  <button className="btn btn-outline" onClick={share}>
                    {t("product.share")}
                  </button>
                  {!isOwner && (
                    <button
                      className="btn btn-outline"
                      onClick={() => setReportOpen(true)}
                    >
                      {t("product.reportBtn")}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="detail-card seller-card">
              <BlockUserButton userId={product.seller.id} />
              <h3>{t("product.seller")}</h3>
              <div className="seller-row">
                <div className="seller-avatar">
                  {(product.seller.name?.[0] || "?").toUpperCase()}
                </div>
                <div>
                  <div className="seller-name">
                    <Link to={`/seller/${product.seller.id}`}>{product.seller.name}</Link>
                    {product.seller.verified && (
                      <span className="badge badge-verified" title={t("product.verified")}>
                        {t("product.verified")}
                      </span>
                    )}
                  </div>
                  <div className="muted small">
                    {t("product.memberSince", { date: product.seller.memberSince })}
                  </div>
                </div>
              </div>
            </div>

            <div className="safety-tips">
              <h4>{t("product.safetyTitle")}</h4>
              <ul>
                <li>{t("product.safetyMeet")}</li>
                <li>{t("product.safetyInspect")}</li>
                <li>{t("product.safetyNoBank")}</li>
              </ul>
            </div>
          </aside>
        </div>

        <section className="detail-section">
          <h2>{t("product.description")}</h2>
          <p className="description">{product.description}</p>
        </section>

        {similar.length > 0 && (
          <section className="detail-section">
            <h2>{t("product.similar")}</h2>
            <div className="product-grid">
              {similar.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>

      {messageOpen && (
        <Modal onClose={() => setMessageOpen(false)} title={t("product.message.title", { name: product.seller.name })}>
          {messageSent ? (
            <div className="success">
              <h3>{t("product.message.success")}</h3>
              <p className="muted">{t("product.message.successHint")}</p>
            </div>
          ) : (
            <>
              <p className="muted">
                {t("product.message.about", { title: "" })}<strong>{product.title}</strong>
              </p>
              <textarea
                rows={5}
                maxLength={4000}
                placeholder={t("product.message.placeholder")}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
              />
              <button
                className="btn btn-primary btn-block"
                onClick={sendMessage}
                disabled={messageSending || !messageText.trim()}
              >
                {t("product.message.send")}
              </button>
              {!user && (
                <p className="muted small">{t("product.message.loginHint")}</p>
              )}
            </>
          )}
        </Modal>
      )}

      {reportOpen && (
        <Modal
          onClose={() => {
            setReportOpen(false);
            setReportReason("");
            setReportDetails("");
            setReportError("");
            setReportSent(false);
          }}
          title={t("product.report.title")}
        >
          {reportSent ? (
            <div className="success">
              <h3>{t("product.report.submitted")}</h3>
              <p className="muted">{t("product.report.thanks")}</p>
            </div>
          ) : (
            <>
              <p className="muted">{t("product.report.intro")}</p>
              {reportError && (
                <div
                  style={{
                    color: "#b00020",
                    background: "#fdecea",
                    padding: "8px 12px",
                    borderRadius: 6,
                    marginBottom: 8,
                  }}
                >
                  {reportError}
                </div>
              )}
              <select
                className="report-select"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
              >
                <option value="" disabled>{t("product.report.reasonPlaceholder")}</option>
                {["scam", "spam", "prohibited", "already_sold", "duplicate", "other"].map((reason) => <option key={reason} value={reason}>{t(`report.reasons.${reason}`)}</option>)}
              </select>
              <textarea
                rows={3}
                placeholder={t("product.report.detailsPlaceholder")}
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
              />
              <button
                className="btn btn-primary btn-block"
                disabled={!reportReason || reportSending}
                onClick={async () => {
                  if (!user) {
                    navigate(`/login?redirect=/product/${product.id}`);
                    return;
                  }
                  setReportSending(true);
                  setReportError("");
                  const { error } = await supabase.from("reports").insert({
                    product_id: product.id,
                    reporter_id: user.id,
                    reason: reportReason,
                    details: reportDetails.trim() || null,
                  });
                  setReportSending(false);
                  if (error && error.code !== "23505") {
                    setReportError(error.message || "Could not submit report.");
                    return;
                  }
                  setReportSent(true);
                  setTimeout(() => {
                    setReportOpen(false);
                    setReportSent(false);
                    setReportReason("");
                    setReportDetails("");
                  }, 1500);
                }}
              >
                {reportSending ? t("product.report.sending") : t("product.report.submit")}
              </button>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  const ref = useRef(null);
  const titleId = useId();
  const t = useT();
  useDialogFocus(ref, true);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h3 id={titleId}>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label={t("common.close")}>✕</button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export default ProductDetail;

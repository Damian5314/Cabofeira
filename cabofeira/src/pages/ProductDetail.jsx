import React, { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useProducts } from "../context/ProductsContext";
import { useAuth } from "../context/AuthContext";
import { useT } from "../i18n/I18nContext";
import { getCategoryById, CategoryIcon } from "../data/categories";
import { supabase } from "../lib/supabase";
import Skeleton from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { formatPrice, timeAgo } from "../utils/format";
import ProductCard from "../components/ProductCard";
import "./ProductDetail.css";

function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getProduct, fetchProduct, products, isFavorite, toggleFavorite, incrementViews } =
    useProducts();
  const { user } = useAuth();
  const toast = useToast();
  const t = useT();

  const cached = getProduct(id);
  const [product, setProduct] = useState(cached || null);
  const [loadingProduct, setLoadingProduct] = useState(!cached);
  const [activeImage, setActiveImage] = useState(0);
  const [showPhone, setShowPhone] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [messageSent, setMessageSent] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSending, setReportSending] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportSent, setReportSent] = useState(false);

  useEffect(() => {
    let alive = true;
    const fromCache = getProduct(id);
    if (fromCache) {
      setProduct(fromCache);
      setLoadingProduct(false);
      incrementViews(fromCache.id);
      return;
    }
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
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  const sendMessage = async () => {
    if (!user) {
      navigate(`/login?redirect=/product/${product.id}`);
      return;
    }
    const text = messageText.trim();
    if (!text) return;

    let convId;
    const { data: existing, error: findErr } = await supabase
      .from("conversations")
      .select("id")
      .eq("product_id", product.id)
      .eq("buyer_id", user.id)
      .eq("seller_id", product.seller.id)
      .maybeSingle();

    if (findErr) {
      toast.error("Could not open conversation: " + findErr.message);
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
        toast.error("Could not start conversation: " + insertErr.message);
        return;
      }
      convId = created.id;
    }

    const { error: msgErr } = await supabase
      .from("messages")
      .insert({ conversation_id: convId, sender_id: user.id, body: text });
    if (msgErr) {
      toast.error("Could not send message: " + msgErr.message);
      return;
    }

    setMessageSent(true);
    setMessageText("");
    setTimeout(() => {
      setMessageOpen(false);
      setMessageSent(false);
    }, 1500);
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
      navigator.clipboard.writeText(url);
      toast.success(t("product.linkCopied"));
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
              <img src={product.images[activeImage]} alt={product.title} />
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
                    <img src={src} alt={`${product.title} ${i + 1}`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <aside className="detail-side">
            <div className="detail-card">
              <h1 className="detail-title">{product.title}</h1>
              <div className="detail-price">
                {formatPrice(product.price, product.currency)}
              </div>
              <div className="detail-meta">
                <span>📍 {product.location.city}, {product.location.island}</span>
                <span>•</span>
                <span>🗓 {timeAgo(product.createdAt)}</span>
                <span>•</span>
                <span>👁 {product.views} {t("product.viewsLabel")}</span>
              </div>
              <div className="detail-tags">
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
                      {t("product.report")}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="detail-card seller-card">
              <h3>{t("product.seller")}</h3>
              <div className="seller-row">
                <div className="seller-avatar">
                  {product.seller.name[0].toUpperCase()}
                </div>
                <div>
                  <div className="seller-name">
                    {product.seller.name}
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
                placeholder={t("product.message.placeholder")}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
              />
              <button
                className="btn btn-primary btn-block"
                onClick={sendMessage}
                disabled={!messageText.trim()}
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
                <option>{t("product.report.reason1")}</option>
                <option>{t("product.report.reason2")}</option>
                <option>{t("product.report.reason3")}</option>
                <option>{t("product.report.reason4")}</option>
                <option>{t("product.report.reason5")}</option>
                <option>{t("product.report.reason6")}</option>
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
                  if (error) {
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
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export default ProductDetail;

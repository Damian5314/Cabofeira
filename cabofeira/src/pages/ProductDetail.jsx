import React, { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useProducts } from "../context/ProductsContext";
import { useAuth } from "../context/AuthContext";
import { getCategoryById, CategoryIcon } from "../data/categories";
import { supabase } from "../lib/supabase";
import { formatPrice, timeAgo } from "../utils/format";
import ProductCard from "../components/ProductCard";
import "./ProductDetail.css";

function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getProduct, products, isFavorite, toggleFavorite, incrementViews } =
    useProducts();
  const { user } = useAuth();

  const product = getProduct(id);
  const [activeImage, setActiveImage] = useState(0);
  const [showPhone, setShowPhone] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [messageSent, setMessageSent] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    if (product) incrementViews(product.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!product) {
    return (
      <div className="page container">
        <div className="empty">
          <h2>Ad not found</h2>
          <p className="muted">This listing may have been removed or doesn't exist.</p>
          <Link to="/search" className="btn btn-primary">Browse other ads</Link>
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

    // Find or create the conversation between this buyer and the seller about this product.
    let convId;
    const { data: existing, error: findErr } = await supabase
      .from("conversations")
      .select("id")
      .eq("product_id", product.id)
      .eq("buyer_id", user.id)
      .eq("seller_id", product.seller.id)
      .maybeSingle();

    if (findErr) {
      alert("Could not open conversation: " + findErr.message);
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
        alert("Could not start conversation: " + insertErr.message);
        return;
      }
      convId = created.id;
    }

    const { error: msgErr } = await supabase
      .from("messages")
      .insert({ conversation_id: convId, sender_id: user.id, body: text });
    if (msgErr) {
      alert("Could not send message: " + msgErr.message);
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
      alert("Link copied to clipboard!");
    }
  };

  const fav = isFavorite(product.id);

  return (
    <div className="page product-detail">
      <div className="container">
        <nav className="breadcrumbs">
          <Link to="/">Home</Link> ›{" "}
          <Link to={`/search?category=${product.category}`}>
            {category?.name}
          </Link>{" "}
          › <span>{product.subcategory}</span>
        </nav>

        <div className="detail-grid">
          <div className="gallery">
            <div className="gallery-main">
              <img src={product.images[activeImage]} alt={product.title} />
              {product.featured && (
                <span className="badge badge-featured gallery-badge">★ Featured</span>
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
                <span>👁 {product.views} views</span>
              </div>
              <div className="detail-tags">
                <span className="badge"><CategoryIcon category={category} size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />{category?.name}</span>
                <span className="badge">{product.subcategory}</span>
                <span className={`badge ${product.condition === "New" ? "badge-new" : ""}`}>
                  {product.condition}
                </span>
              </div>

              <div className="detail-actions">
                {isOwner ? (
                  <>
                    <Link to={`/edit/${product.id}`} className="btn btn-primary btn-block">
                      ✏️ Edit your ad
                    </Link>
                    <Link to="/profile/ads" className="btn btn-outline btn-block">
                      Manage your ads
                    </Link>
                  </>
                ) : (
                  <>
                    <button
                      className="btn btn-primary btn-block"
                      onClick={() => setShowPhone(true)}
                    >
                      📞 {showPhone ? product.seller.phone : "Show phone number"}
                    </button>
                    <a
                      href={`mailto:${product.seller.email}?subject=${encodeURIComponent("About: " + product.title)}`}
                      className="btn btn-outline btn-block"
                    >
                      ✉️ Email seller
                    </a>
                    <button
                      className="btn btn-outline btn-block"
                      onClick={() => setMessageOpen(true)}
                    >
                      💬 Send message
                    </button>
                  </>
                )}

                <div className="action-row">
                  <button
                    className={`btn btn-outline ${fav ? "is-fav" : ""}`}
                    onClick={() => toggleFavorite(product.id)}
                  >
                    {fav ? "❤️ Saved" : "🤍 Save"}
                  </button>
                  <button className="btn btn-outline" onClick={share}>
                    🔗 Share
                  </button>
                  {!isOwner && (
                    <button
                      className="btn btn-outline"
                      onClick={() => setReportOpen(true)}
                    >
                      🚩 Report
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="detail-card seller-card">
              <h3>Seller</h3>
              <div className="seller-row">
                <div className="seller-avatar">
                  {product.seller.name[0].toUpperCase()}
                </div>
                <div>
                  <div className="seller-name">
                    {product.seller.name}
                    {product.seller.verified && (
                      <span className="badge badge-verified" title="Verified seller">
                        ✓ Verified
                      </span>
                    )}
                  </div>
                  <div className="muted small">
                    Member since {product.seller.memberSince}
                  </div>
                </div>
              </div>
            </div>

            <div className="safety-tips">
              <h4>🛡️ Safety tips</h4>
              <ul>
                <li>Meet in public places.</li>
                <li>Inspect the item before paying.</li>
                <li>Never share bank or password info.</li>
              </ul>
            </div>
          </aside>
        </div>

        <section className="detail-section">
          <h2>Description</h2>
          <p className="description">{product.description}</p>
        </section>

        {similar.length > 0 && (
          <section className="detail-section">
            <h2>Similar listings</h2>
            <div className="product-grid">
              {similar.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>

      {messageOpen && (
        <Modal onClose={() => setMessageOpen(false)} title={`Message ${product.seller.name}`}>
          {messageSent ? (
            <div className="success">
              <h3>✓ Message sent!</h3>
              <p className="muted">You can continue the conversation in Messages.</p>
            </div>
          ) : (
            <>
              <p className="muted">
                About: <strong>{product.title}</strong>
              </p>
              <textarea
                rows={5}
                placeholder="Hi! Is this still available?"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
              />
              <button
                className="btn btn-primary btn-block"
                onClick={sendMessage}
                disabled={!messageText.trim()}
              >
                Send message
              </button>
              {!user && (
                <p className="muted small">You'll need to log in to send.</p>
              )}
            </>
          )}
        </Modal>
      )}

      {reportOpen && (
        <Modal onClose={() => setReportOpen(false)} title="Report this ad">
          <p className="muted">Help us keep CaboFeira safe. Why are you reporting this ad?</p>
          <select className="report-select" defaultValue="">
            <option value="" disabled>Select a reason</option>
            <option>Spam or duplicate</option>
            <option>Fraud / scam</option>
            <option>Wrong category</option>
            <option>Prohibited item</option>
            <option>Offensive content</option>
            <option>Other</option>
          </select>
          <textarea rows={3} placeholder="Additional details (optional)" />
          <button
            className="btn btn-primary btn-block"
            onClick={() => {
              alert("Thanks. Your report has been submitted.");
              setReportOpen(false);
            }}
          >
            Submit report
          </button>
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

import ListingImage from "../components/ListingImage";
import React from "react";
import { Link } from "react-router-dom";
import { useProducts } from "../context/ProductsContext";
import { useT, useI18n } from "../i18n/I18nContext";
import { formatPrice, timeAgo } from "../utils/format";
import "./ProductCard.css";

function ProductCard({ product }) {
  const { isFavorite, toggleFavorite } = useProducts();
  const t = useT();
  const { locale } = useI18n();
  const fav = isFavorite(product.id);

  return (
    <article className={`product-card ${product.featured ? "is-featured" : ""}`}>
      <div className="card-image-wrap">
        <Link to={`/product/${product.id}`}>
        <ListingImage src={product.images[0]} alt={product.title} loading="lazy" />
        </Link>
        {(product.status === "sold" || product.featured) && (
          <div className="card-badges">
            {product.status === "sold" && (
              <span className="badge badge-sold">{t("badge.sold")}</span>
            )}
            {product.featured && (
              <span className="badge badge-featured">{t("product.featuredBadge")}</span>
            )}
          </div>
        )}
        <button
          className={`fav-btn ${fav ? "is-fav" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            toggleFavorite(product.id);
          }}
          aria-label={fav ? t("product.saved") : t("product.save")}
          aria-pressed={fav}
        >
          {fav ? "❤️" : "🤍"}
        </button>
      </div>
      <div className="card-body">
        <Link to={`/product/${product.id}`} className="card-title">
          {product.title}
        </Link>
        <div className="card-price">{formatPrice(product.price, product.currency, locale)}</div>
        <div className="card-meta">
          <span>📍 {product.location.city}, {product.location.island}</span>
          {product.seller.verified && (
            <span className="badge badge-verified" title={t("product.verified")}>
              {t("product.verified")}
            </span>
          )}
        </div>
        <div className="card-footer">
          <span className="muted small">{timeAgo(product.createdAt, locale)}</span>
          <span className="muted small">👁 {product.views}</span>
        </div>
      </div>
    </article>
  );
}

export default ProductCard;

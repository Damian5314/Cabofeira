import React from "react";
import { Link } from "react-router-dom";
import { useProducts } from "../context/ProductsContext";
import { formatPrice, timeAgo } from "../utils/format";
import "./ProductCard.css";

function ProductCard({ product }) {
  const { isFavorite, toggleFavorite } = useProducts();
  const fav = isFavorite(product.id);

  return (
    <article className={`product-card ${product.featured ? "is-featured" : ""}`}>
      <Link to={`/product/${product.id}`} className="card-image-wrap">
        <img
          src={product.images[0]}
          alt={product.title}
          loading="lazy"
        />
        {product.featured && <span className="badge badge-featured">★ Featured</span>}
        <button
          className={`fav-btn ${fav ? "is-fav" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            toggleFavorite(product.id);
          }}
          aria-label={fav ? "Remove from favorites" : "Add to favorites"}
        >
          {fav ? "❤️" : "🤍"}
        </button>
      </Link>
      <div className="card-body">
        <Link to={`/product/${product.id}`} className="card-title">
          {product.title}
        </Link>
        <div className="card-price">{formatPrice(product.price, product.currency)}</div>
        <div className="card-meta">
          <span>📍 {product.location.city}, {product.location.island}</span>
        </div>
        <div className="card-footer">
          <span className="muted small">{timeAgo(product.createdAt)}</span>
          <span className="muted small">👁 {product.views}</span>
        </div>
      </div>
    </article>
  );
}

export default ProductCard;

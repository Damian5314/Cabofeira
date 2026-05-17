import React from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useProducts } from "../context/ProductsContext";
import { formatPrice, timeAgo } from "../utils/format";
import "./MyAds.css";

function MyAds() {
  const { user } = useAuth();
  const { userProducts, removeProduct } = useProducts();

  if (!user) return <Navigate to="/login?redirect=/profile/ads" replace />;

  const myAds = userProducts(user.id);

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this ad? This cannot be undone.")) {
      removeProduct(id);
    }
  };

  return (
    <div className="page my-ads-page">
      <div className="container">
        <div className="my-ads-head">
          <div>
            <h1 className="page-title">My ads</h1>
            <p className="muted">{myAds.length} active listing{myAds.length === 1 ? "" : "s"}</p>
          </div>
          <Link to="/postad" className="btn btn-primary">+ Post a new ad</Link>
        </div>

        {myAds.length === 0 ? (
          <div className="empty">
            <h3>You haven't posted any ads yet</h3>
            <p className="muted">Start selling — it's free and takes less than a minute.</p>
            <Link to="/postad" className="btn btn-primary">+ Post your first ad</Link>
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
                    <span>👁 {p.views} views</span>
                    <span>•</span>
                    <span>{timeAgo(p.createdAt)}</span>
                  </div>
                  <div className="my-ad-tags">
                    {p.featured && <span className="badge badge-featured">★ Featured</span>}
                    <span className="badge">{p.location.city}, {p.location.island}</span>
                  </div>
                </div>
                <div className="my-ad-actions">
                  <Link to={`/edit/${p.id}`} className="btn btn-outline">✏️ Edit</Link>
                  <button className="btn btn-outline btn-danger-outline" onClick={() => handleDelete(p.id)}>
                    🗑 Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MyAds;

import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useProducts } from "../context/ProductsContext";
import { usePricing } from "../context/PricingContext";
import { categories } from "../data/categories";
import { formatPrice } from "../utils/format";
import "./Admin.css";

function Admin() {
  const { user, isAdmin, allUsers } = useAuth();
  const { products, removeProduct } = useProducts();
  const { prices, setPrice, featuredPrice, setFeaturedPrice, resetPrices } = usePricing();

  const [tab, setTab] = useState("users");
  const [savedFlash, setSavedFlash] = useState(false);

  if (!user) return <Navigate to="/login?redirect=/admin" replace />;
  if (!isAdmin) {
    return (
      <div className="page">
        <div className="container" style={{ maxWidth: 560 }}>
          <div className="empty">
            <h2>🚫 Access denied</h2>
            <p className="muted">You need an admin account to view this page.</p>
          </div>
        </div>
      </div>
    );
  }

  const users = allUsers();
  const adCountFor = (uid) => products.filter((p) => p.seller.id === uid).length;

  const flash = () => {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  return (
    <div className="page admin-page">
      <div className="container">
        <header className="admin-head">
          <div>
            <h1 className="page-title">⚙️ Admin panel</h1>
            <p className="muted">Manage users, listings and posting prices.</p>
          </div>
          {savedFlash && <span className="flash">✓ Saved</span>}
        </header>

        <div className="admin-stats">
          <div className="stat">
            <div className="stat-num">{users.length}</div>
            <div className="stat-label">Users</div>
          </div>
          <div className="stat">
            <div className="stat-num">{products.length}</div>
            <div className="stat-label">Active ads</div>
          </div>
          <div className="stat">
            <div className="stat-num">{products.filter((p) => p.featured).length}</div>
            <div className="stat-label">Featured ads</div>
          </div>
          <div className="stat">
            <div className="stat-num">
              {products.reduce((s, p) => s + (p.views || 0), 0)}
            </div>
            <div className="stat-label">Total views</div>
          </div>
        </div>

        <div className="admin-tabs">
          <button
            className={tab === "users" ? "is-active" : ""}
            onClick={() => setTab("users")}
          >
            👥 Users ({users.length})
          </button>
          <button
            className={tab === "pricing" ? "is-active" : ""}
            onClick={() => setTab("pricing")}
          >
            💰 Posting prices
          </button>
          <button
            className={tab === "ads" ? "is-active" : ""}
            onClick={() => setTab("ads")}
          >
            📋 All ads ({products.length})
          </button>
        </div>

        {tab === "users" && (
          <div className="admin-card">
            <h2>All users</h2>
            <p className="muted">Every account known to the platform.</p>
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Role</th>
                    <th>Verified</th>
                    <th>Member since</th>
                    <th>Ads</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="user-cell">
                          <span className="avatar-tiny">{u.name?.[0]?.toUpperCase()}</span>
                          {u.name}
                        </div>
                      </td>
                      <td>{u.email}</td>
                      <td>{u.phone || <span className="muted">—</span>}</td>
                      <td>
                        <span className={`role-badge role-${u.role}`}>
                          {u.role === "admin" ? "👑 Admin" : "User"}
                        </span>
                      </td>
                      <td>{u.verified ? "✓" : "—"}</td>
                      <td>{u.memberSince}</td>
                      <td>{adCountFor(u.id)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "pricing" && (
          <div className="admin-card">
            <div className="row-between">
              <div>
                <h2>Posting prices</h2>
                <p className="muted">
                  Cost to post an ad in each category. Set to <strong>0</strong> to make it free.
                </p>
              </div>
              <button className="btn btn-outline" onClick={resetPrices}>
                ↻ Reset to defaults
              </button>
            </div>

            <div className="price-list">
              {categories.map((c) => (
                <div key={c.id} className="price-row">
                  <div className="price-name">
                    <span className="cat-emoji">{c.icon}</span>
                    <div>
                      <strong>{c.name}</strong>
                      <div className="muted small">{c.subcategories.length} subcategories</div>
                    </div>
                  </div>
                  <div className="price-input-wrap">
                    <input
                      type="number"
                      min="0"
                      value={prices[c.id] ?? 0}
                      onChange={(e) => {
                        setPrice(c.id, e.target.value);
                        flash();
                      }}
                    />
                    <span>CVE</span>
                  </div>
                </div>
              ))}

              <div className="price-row featured-row">
                <div className="price-name">
                  <span className="cat-emoji">⭐</span>
                  <div>
                    <strong>Featured surcharge</strong>
                    <div className="muted small">Added on top when "Featured" is selected.</div>
                  </div>
                </div>
                <div className="price-input-wrap">
                  <input
                    type="number"
                    min="0"
                    value={featuredPrice}
                    onChange={(e) => {
                      setFeaturedPrice(Math.max(0, Number(e.target.value) || 0));
                      flash();
                    }}
                  />
                  <span>CVE</span>
                </div>
              </div>
            </div>
            <p className="muted small" style={{ marginTop: 12 }}>
              Changes are saved automatically and apply to new ads immediately.
            </p>
          </div>
        )}

        {tab === "ads" && (
          <div className="admin-card">
            <h2>All ads</h2>
            <p className="muted">{products.length} active listings on the platform.</p>
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Seller</th>
                    <th>Category</th>
                    <th>Location</th>
                    <th>Price</th>
                    <th>Views</th>
                    <th>Featured</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <a href={`/product/${p.id}`} className="truncate">{p.title}</a>
                      </td>
                      <td>{p.seller.name}</td>
                      <td>{p.category}</td>
                      <td>{p.location.city}, {p.location.island}</td>
                      <td>{formatPrice(p.price, p.currency)}</td>
                      <td>{p.views}</td>
                      <td>{p.featured ? "⭐" : "—"}</td>
                      <td>
                        <button
                          className="btn btn-outline btn-sm btn-danger-outline"
                          onClick={() => {
                            if (window.confirm(`Delete "${p.title}"? This cannot be undone.`)) {
                              removeProduct(p.id);
                            }
                          }}
                        >
                          🗑 Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Admin;

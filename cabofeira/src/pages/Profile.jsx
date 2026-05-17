import React, { useState } from "react";
import { Link, NavLink, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useProducts } from "../context/ProductsContext";
import "./Profile.css";

function Profile() {
  const { user, logout, updateProfile } = useAuth();
  const { userProducts, favorites } = useProducts();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    bio: user?.bio || "",
  });

  if (!user) return <Navigate to="/login?redirect=/profile" replace />;

  const myAds = userProducts(user.id);

  const handleSave = (e) => {
    e.preventDefault();
    updateProfile(form);
    setEditing(false);
  };

  return (
    <div className="page profile-page">
      <div className="container profile-layout">
        <aside className="profile-sidebar">
          <div className="profile-card">
            <div className="profile-avatar">{user.name?.[0]?.toUpperCase() || "U"}</div>
            <h2>{user.name}</h2>
            <p className="muted small">Member since {user.memberSince}</p>
          </div>
          <nav className="profile-nav">
            <NavLink to="/profile" end>👤 Overview</NavLink>
            <NavLink to="/profile/ads">📋 My ads ({myAds.length})</NavLink>
            <NavLink to="/favorites">❤️ Favorites ({favorites.length})</NavLink>
            <NavLink to="/messages">💬 Messages</NavLink>
            <NavLink to="/profile/settings">⚙️ Settings</NavLink>
            <button className="logout-btn" onClick={logout}>🚪 Logout</button>
          </nav>
        </aside>

        <main className="profile-main">
          <div className="profile-section">
            <div className="profile-section-head">
              <h2>Account overview</h2>
              {!editing && (
                <button className="btn btn-outline" onClick={() => setEditing(true)}>
                  Edit profile
                </button>
              )}
            </div>

            {editing ? (
              <form className="profile-form" onSubmit={handleSave}>
                <label>
                  <span>Name</span>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>
                <label>
                  <span>Phone</span>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+238 991 1234"
                  />
                </label>
                <label>
                  <span>Bio</span>
                  <textarea
                    rows={3}
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    placeholder="Tell buyers about yourself..."
                  />
                </label>
                <div className="form-actions">
                  <button type="button" className="btn btn-outline" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">Save</button>
                </div>
              </form>
            ) : (
              <dl className="info-list">
                <div><dt>Email</dt><dd>{user.email}</dd></div>
                <div><dt>Phone</dt><dd>{user.phone || <em className="muted">Not set</em>}</dd></div>
                <div><dt>Bio</dt><dd>{user.bio || <em className="muted">Not set</em>}</dd></div>
                <div><dt>Verified</dt><dd>{user.verified ? "✓ Yes" : "Not yet"}</dd></div>
              </dl>
            )}
          </div>

          <div className="profile-section">
            <h2>Quick stats</h2>
            <div className="stats-grid">
              <div className="stat">
                <div className="stat-num">{myAds.length}</div>
                <div className="stat-label">Active ads</div>
              </div>
              <div className="stat">
                <div className="stat-num">{favorites.length}</div>
                <div className="stat-label">Favorites</div>
              </div>
              <div className="stat">
                <div className="stat-num">
                  {myAds.reduce((s, p) => s + (p.views || 0), 0)}
                </div>
                <div className="stat-label">Total views</div>
              </div>
            </div>
            <Link to="/postad" className="btn btn-primary" style={{ marginTop: 14 }}>
              + Post a new ad
            </Link>
          </div>

        </main>
      </div>
    </div>
  );
}

export default Profile;

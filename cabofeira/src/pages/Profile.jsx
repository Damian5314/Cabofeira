import React, { useState } from "react";
import { Link, NavLink, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useProducts } from "../context/ProductsContext";
import { useMessages } from "../context/MessagesContext";
import { useT } from "../i18n/I18nContext";
import ConfirmDialog from "../components/ConfirmDialog";
import "./Profile.css";
import { useToast } from "../components/Toast";
import useSellerStats from "../hooks/useSellerStats";

function Profile() {
  const navigate = useNavigate();
  const { user, logout, updateProfile, deleteAccount } = useAuth();
  const { favorites } = useProducts();
  const { unreadTotal } = useMessages();
  const t = useT();
  const toast = useToast();
  const stats = useSellerStats(user?.id);
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    bio: user?.bio || "",
  });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  if (!user) return <Navigate to="/login?redirect=/profile" replace />;

  const statValue = (value) => stats.loading || stats.error ? "—" : value;

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving || !form.name.trim()) return;
    setSaving(true);
    try {
      const result = await updateProfile({ ...form, name: form.name.trim() });
      if (!result.ok) { toast.error(result.error); return; }
      setEditing(false);
    } catch { toast.error(t("common.error")); }
    finally { setSaving(false); }
  };

  return (
    <div className="page profile-page">
      <div className="container profile-layout">
        <aside className="profile-sidebar">
          <div className="profile-card">
            <div className="profile-avatar">{user.name?.[0]?.toUpperCase() || "U"}</div>
            <h2>{user.name}</h2>
            <p className="muted small">{t("profile.memberSince", { date: user.memberSince })}</p>
          </div>
          <nav className="profile-nav">
            <NavLink to="/profile/blocked">{t("blocking.title")}</NavLink>
            <NavLink to="/notifications">{t("notifications.title")}</NavLink>
            <NavLink to="/profile" end>{t("profile.overview")}</NavLink>
            <NavLink to="/profile/ads">{t("profile.myAds", { count: statValue(stats.total) })}</NavLink>
            <NavLink to="/favorites">{t("profile.favorites", { count: favorites.length })}</NavLink>
            <NavLink to="/messages">
              {t("profile.messages")}
              {unreadTotal > 0 && <span className="unread-badge">{unreadTotal}</span>}
            </NavLink>
            <NavLink to="/profile/settings">{t("profile.settings")}</NavLink>
            <button className="logout-btn" onClick={logout}>{t("profile.logout")}</button>
          </nav>
        </aside>

        <section className="profile-main">
          <div className="profile-section">
            <div className="profile-section-head">
              <h1>{t("profile.accountOverview")}</h1>
              {!editing && (
                <button className="btn btn-outline" onClick={() => setEditing(true)}>
                  {t("profile.editProfile")}
                </button>
              )}
            </div>

            {editing ? (
              <form className="profile-form" onSubmit={handleSave}>
                <label>
                  <span>{t("profile.name")}</span>
                  <input
                    value={form.name}
                    required
                    maxLength={100}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>
                <label>
                  <span>{t("profile.phone")}</span>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder={t("profile.phonePlaceholder")}
                  />
                </label>
                <label>
                  <span>{t("profile.bio")}</span>
                  <textarea
                    rows={3}
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    placeholder={t("profile.bioPlaceholder")}
                  />
                </label>
                <div className="form-actions">
                  <button type="button" className="btn btn-outline" onClick={() => setEditing(false)}>
                    {t("profile.cancel")}
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{t("profile.save")}</button>
                </div>
              </form>
            ) : (
              <dl className="info-list">
                <div><dt>{t("profile.email")}</dt><dd>{user.email}</dd></div>
                <div><dt>{t("profile.phone")}</dt><dd>{user.phone || <em className="muted">{t("profile.notSet")}</em>}</dd></div>
                <div><dt>{t("profile.bio")}</dt><dd>{user.bio || <em className="muted">{t("profile.notSet")}</em>}</dd></div>
                <div><dt>{t("profile.verified")}</dt><dd>{user.verified ? t("profile.verifiedYes") : t("profile.verifiedNo")}</dd></div>
              </dl>
            )}
          </div>

          <div className="profile-section">
            <h2>{t("profile.quickStats")}</h2>
            {stats.error && <p role="alert">{t("common.error")}</p>}
            <div className="stats-grid" aria-busy={stats.loading}>
              <div className="stat">
                <div className="stat-num">{statValue(stats.active)}</div>
                <div className="stat-label">{t("profile.activeAds")}</div>
              </div>
              <div className="stat">
                <div className="stat-num">{favorites.length}</div>
                <div className="stat-label">{t("profile.favoritesStat")}</div>
              </div>
              <div className="stat">
                <div className="stat-num">
                  {statValue(stats.views)}
                </div>
                <div className="stat-label">{t("profile.totalViews")}</div>
              </div>
            </div>
            <Link to="/postad" className="btn btn-primary" style={{ marginTop: 14 }}>
              {t("profile.postNew")}
            </Link>
          </div>

          <div
            className="profile-section"
            style={{
              borderTop: "2px solid #fee2e2",
              marginTop: 24,
              paddingTop: 20,
            }}
          >
            <h2 style={{ color: "#b91c1c" }}>{t("profile.dangerZone")}</h2>
            <p className="muted" style={{ marginBottom: 14 }}>
              {t("profile.dangerIntro")}
            </p>
            {deleteError && (
              <div
                style={{
                  color: "#b00020",
                  background: "#fdecea",
                  padding: "8px 12px",
                  borderRadius: 6,
                  marginBottom: 12,
                }}
              >
                {deleteError}
              </div>
            )}
            <button
              className="btn btn-danger"
              onClick={() => {
                setDeleteError("");
                setDeleteOpen(true);
              }}
            >
              {t("profile.deleteAccount")}
            </button>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title={t("profile.deleteTitle")}
        message={t("profile.deleteMessage")}
        confirmLabel={t("profile.deleteAccount")}
        requireText="DELETE"
        danger
        busy={deleteBusy}
        onCancel={() => !deleteBusy && setDeleteOpen(false)}
        onConfirm={async () => {
          setDeleteBusy(true);
          const r = await deleteAccount();
          setDeleteBusy(false);
          if (!r.ok) {
            setDeleteError(r.error || t("profile.deleteFailed"));
            setDeleteOpen(false);
            return;
          }
          setDeleteOpen(false);
          navigate("/");
        }}
      />
    </div>
  );
}

export default Profile;

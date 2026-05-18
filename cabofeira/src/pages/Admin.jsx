import React, { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useProducts } from "../context/ProductsContext";
import { usePricing } from "../context/PricingContext";
import { categories, CategoryIcon } from "../data/categories";
import { supabase } from "../lib/supabase";
import { formatPrice } from "../utils/format";
import ConfirmDialog from "../components/ConfirmDialog";
import Skeleton from "../components/Skeleton";
import { useToast } from "../components/Toast";
import "./Admin.css";

function Admin() {
  const { user, isAdmin, allUsers, setUserRole, setUserVerified } = useAuth();
  const { products, removeProduct, fetchProducts } = useProducts();
  const { prices, setPrice, featuredPrice, setFeaturedPrice, resetPrices } = usePricing();
  const toast = useToast();

  const [tab, setTab] = useState("users");
  const [savedFlash, setSavedFlash] = useState(false);
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({ total: null, featured: null });
  const [ads, setAds] = useState([]);
  const [adsTotal, setAdsTotal] = useState(0);
  const [adsLoading, setAdsLoading] = useState(false);
  const [adsLoadingMore, setAdsLoadingMore] = useState(false);
  const ADS_PAGE_SIZE = 30;
  const [confirmCfg, setConfirmCfg] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const askConfirm = (cfg) => setConfirmCfg(cfg);
  const handleConfirm = async () => {
    if (!confirmCfg) return;
    setConfirmBusy(true);
    try {
      await confirmCfg.action();
    } finally {
      setConfirmBusy(false);
      setConfirmCfg(null);
    }
  };

  const loadReports = useCallback(async () => {
    const { data, error } = await supabase
      .from("reports")
      .select(
        `id, reason, details, status, created_at, reviewed_at,
         product:products!reports_product_id_fkey(id, title, images),
         reporter:profiles!reports_reporter_id_fkey(id, name, email)`
      )
      .order("created_at", { ascending: false });
    if (!error) setReports(data || []);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    loadReports();
    const channel = supabase
      .channel("admin-reports")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reports" },
        () => loadReports()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, loadReports]);

  // Top-level stats via DB count (cheap, exact).
  const loadStats = useCallback(async () => {
    const [{ count: total }, { count: featured }] = await Promise.all([
      supabase.from("products").select("*", { count: "exact", head: true }),
      supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("featured", true),
    ]);
    setStats({ total: total || 0, featured: featured || 0 });
  }, []);

  useEffect(() => {
    if (isAdmin) loadStats();
  }, [isAdmin, loadStats]);

  // Paginated load for the Ads tab.
  const loadAds = useCallback(
    async (offset, append) => {
      if (append) setAdsLoadingMore(true);
      else setAdsLoading(true);
      try {
        const { items, total } = await fetchProducts({
          sort: "newest",
          range: [offset, offset + ADS_PAGE_SIZE - 1],
        });
        setAdsTotal(total);
        setAds((prev) => (append ? [...prev, ...items] : items));
      } finally {
        setAdsLoading(false);
        setAdsLoadingMore(false);
      }
    },
    [fetchProducts]
  );

  useEffect(() => {
    if (isAdmin && tab === "ads" && ads.length === 0) {
      loadAds(0, false);
    }
  }, [isAdmin, tab, ads.length, loadAds]);

  const updateReportStatus = async (reportId, status) => {
    await supabase
      .from("reports")
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq("id", reportId);
  };

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
            <div className="stat-num">{stats.total ?? "…"}</div>
            <div className="stat-label">Active ads</div>
          </div>
          <div className="stat">
            <div className="stat-num">{stats.featured ?? "…"}</div>
            <div className="stat-label">Featured ads</div>
          </div>
          <div className="stat">
            <div className="stat-num">
              {products.reduce((s, p) => s + (p.views || 0), 0)}
            </div>
            <div className="stat-label">Total views (cached)</div>
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
            📋 All ads ({stats.total ?? "…"})
          </button>
          <button
            className={tab === "reports" ? "is-active" : ""}
            onClick={() => setTab("reports")}
          >
            🚩 Reports ({reports.filter((r) => r.status === "open").length})
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
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isSelf = u.id === user.id;
                    return (
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
                        <td>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={async () => {
                                const r = await setUserVerified(u.id, !u.verified);
                                if (!r.ok) toast.error(r.error);
                                else toast.success(
                                  u.verified
                                    ? `${u.name} is no longer verified.`
                                    : `${u.name} is now verified.`
                                );
                              }}
                            >
                              {u.verified ? "Unverify" : "✓ Verify"}
                            </button>
                            {isSelf ? (
                              <button className="btn btn-outline btn-sm" disabled title="You can't change your own role">
                                —
                              </button>
                            ) : u.role === "admin" ? (
                              <button
                                className="btn btn-outline btn-sm btn-danger-outline"
                                onClick={() =>
                                  askConfirm({
                                    title: "Demote admin?",
                                    message: `${u.name} will lose admin access and become a regular user.`,
                                    confirmLabel: "Demote",
                                    danger: true,
                                    action: async () => {
                                      const r = await setUserRole(u.id, "user");
                                      if (!r.ok) toast.error(r.error);
                                      else toast.success(`${u.name} is now a regular user.`);
                                    },
                                  })
                                }
                              >
                                Demote
                              </button>
                            ) : (
                              <button
                                className="btn btn-outline btn-sm"
                                onClick={() =>
                                  askConfirm({
                                    title: "Promote to admin?",
                                    message: `${u.name} will get full access to this panel, including the ability to delete ads and manage other users.`,
                                    confirmLabel: "👑 Make admin",
                                    action: async () => {
                                      const r = await setUserRole(u.id, "admin");
                                      if (!r.ok) toast.error(r.error);
                                      else toast.success(`${u.name} is now an admin.`);
                                    },
                                  })
                                }
                              >
                                👑 Make admin
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
                    <span className="cat-emoji"><CategoryIcon category={c} size={22} /></span>
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
            <p className="muted">
              {adsLoading
                ? "Loading..."
                : `Showing ${ads.length} of ${adsTotal} listings`}
            </p>
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
                  {adsLoading && ads.length === 0
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <tr key={`sk-${i}`}>
                          <td><Skeleton width="80%" height={14} /></td>
                          <td><Skeleton width="60%" height={14} /></td>
                          <td><Skeleton width="60%" height={14} /></td>
                          <td><Skeleton width="70%" height={14} /></td>
                          <td><Skeleton width={60} height={14} /></td>
                          <td><Skeleton width={30} height={14} /></td>
                          <td><Skeleton width={20} height={14} /></td>
                          <td><Skeleton width={70} height={26} radius={6} /></td>
                        </tr>
                      ))
                    : null}
                  {ads.map((p) => (
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
                          onClick={() =>
                            askConfirm({
                              title: "Delete this ad?",
                              message: `"${p.title}" will be permanently removed. This cannot be undone.`,
                              confirmLabel: "🗑 Delete ad",
                              danger: true,
                              action: async () => {
                                await removeProduct(p.id);
                                setAds((prev) => prev.filter((x) => x.id !== p.id));
                                setAdsTotal((n) => Math.max(0, n - 1));
                                loadStats();
                              },
                            })
                          }
                        >
                          🗑 Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {ads.length < adsTotal && (
              <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
                <button
                  className="btn btn-outline"
                  disabled={adsLoadingMore}
                  onClick={() => loadAds(ads.length, true)}
                >
                  {adsLoadingMore
                    ? "Loading..."
                    : `Load more (${adsTotal - ads.length} left)`}
                </button>
              </div>
            )}
          </div>
        )}

        {tab === "reports" && (
          <div className="admin-card">
            <h2>Reports</h2>
            <p className="muted">
              {reports.filter((r) => r.status === "open").length} open ·{" "}
              {reports.length} total
            </p>
            {reports.length === 0 ? (
              <div className="empty">
                <p className="muted">No reports yet.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {reports.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      border: "1px solid var(--cf-border)",
                      borderRadius: 8,
                      padding: 14,
                      background:
                        r.status === "open"
                          ? "#fff8e1"
                          : r.status === "resolved"
                          ? "#e8f5e9"
                          : "transparent",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 8,
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      <strong>{r.reason}</strong>
                      <span
                        className="badge"
                        style={{
                          background:
                            r.status === "open"
                              ? "#f59e0b"
                              : r.status === "reviewing"
                              ? "#3b82f6"
                              : r.status === "resolved"
                              ? "#10b981"
                              : "#6b7280",
                          color: "white",
                          padding: "2px 8px",
                          borderRadius: 12,
                          fontSize: "0.75rem",
                        }}
                      >
                        {r.status}
                      </span>
                    </div>
                    {r.details && (
                      <p className="muted" style={{ margin: "4px 0 10px" }}>
                        "{r.details}"
                      </p>
                    )}
                    <div className="muted small" style={{ marginBottom: 10 }}>
                      Reporter: {r.reporter?.name || "(unknown)"}{" "}
                      {r.reporter?.email && `· ${r.reporter.email}`} ·{" "}
                      {new Date(r.created_at).toLocaleString()}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      {r.product ? (
                        <Link
                          to={`/product/${r.product.id}`}
                          className="btn btn-outline btn-sm"
                        >
                          View ad: {r.product.title}
                        </Link>
                      ) : (
                        <span className="muted small">(ad deleted)</span>
                      )}
                      {r.status !== "reviewing" && (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => updateReportStatus(r.id, "reviewing")}
                        >
                          Mark reviewing
                        </button>
                      )}
                      {r.status !== "resolved" && (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => updateReportStatus(r.id, "resolved")}
                        >
                          ✓ Resolve
                        </button>
                      )}
                      {r.status !== "dismissed" && (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => updateReportStatus(r.id, "dismissed")}
                        >
                          Dismiss
                        </button>
                      )}
                      {r.product && (
                        <button
                          className="btn btn-outline btn-sm btn-danger-outline"
                          onClick={() =>
                            askConfirm({
                              title: "Delete reported ad?",
                              message: `"${r.product.title}" will be permanently removed and this report will be marked resolved.`,
                              confirmLabel: "🗑 Delete ad",
                              danger: true,
                              action: async () => {
                                await removeProduct(r.product.id);
                                await updateReportStatus(r.id, "resolved");
                                setAds((prev) =>
                                  prev.filter((x) => x.id !== r.product.id)
                                );
                                setAdsTotal((n) => Math.max(0, n - 1));
                                loadStats();
                              },
                            })
                          }
                        >
                          🗑 Delete ad
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmCfg}
        title={confirmCfg?.title}
        message={confirmCfg?.message}
        confirmLabel={confirmCfg?.confirmLabel}
        danger={confirmCfg?.danger}
        busy={confirmBusy}
        onConfirm={handleConfirm}
        onCancel={() => !confirmBusy && setConfirmCfg(null)}
      />
    </div>
  );
}

export default Admin;

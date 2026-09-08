import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useT } from "../i18n/I18nContext";
import { supabase } from "../lib/supabase";
import { safeRedirect } from "../utils/links";
import { useToast } from "../components/Toast";

export default function Notifications() {
  const { user } = useAuth();
  const t = useT();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    let request = 0;
    const refresh = async () => {
      const current = ++request;
      const { data, error: err } = await supabase.from("notifications").select("id,title,body,link,read_at,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).order("id").range(page * 30, page * 30 + 29);
      if (alive && current === request) { setRows(data || []); setError(!!err); setLoading(false); }
    };
    setLoading(true); refresh();
    const channel = supabase.channel(`notifications-${user.id}`).on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, refresh).subscribe();
    return () => { alive = false; supabase.removeChannel(channel); };
  }, [user, page]);
  if (!user) return <Navigate to="/login?redirect=/notifications" replace />;
  const markRead = async (id) => {
    const { error: err } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
    if (err) toast.error(t("common.error"));
    else setRows((prev) => prev.map((r) => r.id === id ? { ...r, read_at: new Date().toISOString() } : r));
  };
  return <section className="page container"><h1>{t("notifications.title")}</h1>
    {loading ? <p>{t("common.loading")}</p> : error ? <p role="alert">{t("common.error")}</p> : rows.length === 0 ? <p>{t("notifications.empty")}</p> : <ul>{rows.map((row) => <li key={row.id} style={{ padding: "16px 0" }}><Link to={safeRedirect(row.link)}>{row.title}</Link><p>{row.body}</p>{!row.read_at && <button className="btn btn-outline" onClick={() => markRead(row.id)}>{t("notifications.read")}</button>}</li>)}</ul>}
    <div className="form-actions">{page > 0 && <button className="btn btn-outline" disabled={loading} onClick={() => setPage(page - 1)}>{t("common.back")}</button>}{rows.length === 30 && <button className="btn btn-outline" disabled={loading} onClick={() => setPage(page + 1)}>{t("common.continue")}</button>}</div>
  </section>;
}

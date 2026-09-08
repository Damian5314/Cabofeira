import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useT } from "../i18n/I18nContext";
import { supabase } from "../lib/supabase";
import BlockUserButton from "../components/BlockUserButton";
export default function BlockedUsers() {
  const { user } = useAuth(); const t = useT();
  const [rows, setRows] = useState([]); const [error, setError] = useState(false); const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0); const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!user) return;
    let alive = true; setLoading(true);
    supabase.from("blocked_users").select("blocked_id,profile:profiles!blocked_users_blocked_id_fkey(name)").eq("blocker_id",user.id).order("created_at", { ascending: false }).range(page * 30, page * 30 + 29).then(({ data, error: err }) => {
      if (alive) { setRows(data || []); setError(!!err); setLoading(false); }
    });
    return () => { alive = false; };
  }, [user, page, revision]);
  if (!user) return <Navigate to="/login?redirect=/profile/blocked" replace />;
  return <section className="page container"><h1>{t("blocking.title")}</h1>{loading ? <p>{t("common.loading")}</p> : error ? <p role="alert">{t("common.error")}</p> : <ul>{rows.map((r) => <li key={r.blocked_id}>{r.profile?.name || t("messages.unknownUser")} <BlockUserButton userId={r.blocked_id} onChanged={() => setRevision(revision + 1)} /></li>)}</ul>}
    <div className="form-actions">{page > 0 && <button className="btn btn-outline" onClick={() => setPage(page - 1)}>{t("common.back")}</button>}{rows.length === 30 && <button className="btn btn-outline" onClick={() => setPage(page + 1)}>{t("common.continue")}</button>}</div>
  </section>;
}

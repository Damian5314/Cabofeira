import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useT } from "../i18n/I18nContext";
export default function AuditLog() {
  const t = useT();
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true; setLoading(true); setError(false);
    supabase.from("admin_audit_log").select("id,actor_id,action,target_table,target_id,created_at").order("created_at", { ascending: false }).order("id").range(page * 30, page * 30 + 29).then(({ data, error: err }) => {
      if (alive) { setRows(data || []); setError(!!err); setLoading(false); }
    });
    return () => { alive = false; };
  }, [page]);
  return <section className="admin-card"><h2>{t("audit.title")}</h2>
    {loading ? <p>{t("common.loading")}</p> : error ? <p role="alert">{t("common.error")}</p> : <ul>{rows.map((row) => <li key={row.id}><time>{new Date(row.created_at).toLocaleString()}</time> — {row.action} — {row.target_table} — {row.target_id} — {row.actor_id}</li>)}</ul>}
    <div className="form-actions">{page > 0 && <button className="btn btn-outline" disabled={loading} onClick={() => setPage(page - 1)}>{t("common.back")}</button>}{rows.length === 30 && <button className="btn btn-outline" disabled={loading} onClick={() => setPage(page + 1)}>{t("common.continue")}</button>}</div>
  </section>;
}

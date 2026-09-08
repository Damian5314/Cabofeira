import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useT } from "../i18n/I18nContext";
import { useToast } from "./Toast";
import ConfirmDialog from "./ConfirmDialog";

export default function BlockUserButton({ userId, onChanged }) {
  const { user } = useAuth();
  const t = useT();
  const toast = useToast();
  const [blocked, setBlocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    setReady(false);
    if (user && userId) supabase.from("blocked_users").select("blocked_id").eq("blocker_id", user.id).eq("blocked_id", userId).maybeSingle().then(({ data, error }) => {
      if (alive && !error) { setBlocked(!!data); setReady(true); }
    });
    return () => { alive = false; };
  }, [user, userId]);
  if (!user || !userId || user.id === userId) return null;
  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const row = { blocker_id: user.id, blocked_id: userId };
      const { error } = blocked ? await supabase.from("blocked_users").delete().match(row) : await supabase.from("blocked_users").upsert(row, { ignoreDuplicates: true });
      if (error) throw error;
      setBlocked(!blocked); onChanged?.();
    } catch { toast.error(t("common.error")); }
    finally { setBusy(false); setOpen(false); }
  };
  return <><button className="btn btn-outline" disabled={!ready || busy} onClick={() => setOpen(true)}>{t(blocked ? "blocking.unblock" : "blocking.block")}</button>
    <ConfirmDialog open={open} busy={busy} title={t(blocked ? "blocking.unblock" : "blocking.block")} message={t("blocking.hint")} onConfirm={toggle} onCancel={() => !busy && setOpen(false)} />
  </>;
}

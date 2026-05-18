import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

const MessagesContext = createContext(null);

export function MessagesProvider({ children }) {
  const { user } = useAuth();
  const [unreadByConv, setUnreadByConv] = useState({});

  const refresh = useCallback(async () => {
    if (!user) {
      setUnreadByConv({});
      return;
    }

    const { data: convs, error: convErr } = await supabase
      .from("conversations")
      .select("id, buyer_id, seller_id, buyer_last_read_at, seller_last_read_at")
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);

    if (convErr || !convs || convs.length === 0) {
      setUnreadByConv({});
      return;
    }

    const thresholds = {};
    for (const c of convs) {
      thresholds[c.id] =
        c.buyer_id === user.id ? c.buyer_last_read_at : c.seller_last_read_at;
    }

    const { data: msgs, error: msgErr } = await supabase
      .from("messages")
      .select("conversation_id, created_at, sender_id")
      .in(
        "conversation_id",
        convs.map((c) => c.id)
      )
      .neq("sender_id", user.id);

    if (msgErr) {
      // eslint-disable-next-line no-console
      console.error("[messages-unread] fetch:", msgErr);
      return;
    }

    const counts = {};
    for (const m of msgs || []) {
      const t = thresholds[m.conversation_id];
      if (!t || new Date(m.created_at) > new Date(t)) {
        counts[m.conversation_id] = (counts[m.conversation_id] || 0) + 1;
      }
    }
    setUnreadByConv(counts);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refresh when new messages arrive or conversations are touched (incl. last_read_at updates).
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`unread-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations" },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversations" },
        () => refresh()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  const markRead = useCallback(
    async (conversationId) => {
      if (!conversationId) return;
      // Optimistically clear locally so badges disappear instantly.
      setUnreadByConv((prev) => {
        if (!prev[conversationId]) return prev;
        const next = { ...prev };
        delete next[conversationId];
        return next;
      });
      const { error } = await supabase.rpc("mark_conversation_read", {
        p_conversation_id: conversationId,
      });
      if (error) {
        // eslint-disable-next-line no-console
        console.error("[messages-unread] mark_read:", error);
      }
    },
    []
  );

  const unreadTotal = Object.values(unreadByConv).reduce((s, n) => s + n, 0);

  return (
    <MessagesContext.Provider
      value={{ unreadTotal, unreadByConv, markRead, refresh }}
    >
      {children}
    </MessagesContext.Provider>
  );
}

export function useMessages() {
  const ctx = useContext(MessagesContext);
  if (!ctx) throw new Error("useMessages must be used within MessagesProvider");
  return ctx;
}

import React, { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useMessages } from "../context/MessagesContext";
import { useToast } from "../components/Toast";
import { useT } from "../i18n/I18nContext";
import { supabase } from "../lib/supabase";
import "./Messages.css";

const placeholderImg = "https://picsum.photos/seed/cabofeira/120/120";

function Messages() {
  const { user } = useAuth();
  const { unreadByConv, markRead } = useMessages();
  const toast = useToast();
  const t = useT();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");

  const loadConversations = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("conversations")
      .select(
        `id, product_id, buyer_id, seller_id, last_message_at,
         buyer:profiles!conversations_buyer_id_fkey(id, name),
         seller:profiles!conversations_seller_id_fkey(id, name),
         product:products!conversations_product_id_fkey(id, title, images)`
      )
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order("last_message_at", { ascending: false });
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[messages] load conversations:", error);
      return;
    }
    setConversations(data || []);
  }, [user]);

  const loadMessages = useCallback(async (convId) => {
    if (!convId) {
      setMessages([]);
      return;
    }
    const { data, error } = await supabase
      .from("messages")
      .select("id, sender_id, body, created_at")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[messages] load messages:", error);
      return;
    }
    setMessages(data || []);
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    loadMessages(activeId);
    if (activeId) markRead(activeId);
  }, [activeId, loadMessages, markRead]);

  // Realtime: live updates for the active conversation.
  useEffect(() => {
    if (!activeId) return;
    const channel = supabase
      .channel(`messages-${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeId}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]
          );
          loadConversations();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeId, loadConversations]);

  // Realtime: pick up new conversations involving the current user (e.g. a buyer just messaged us).
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`conv-list-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => loadConversations()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadConversations]);

  if (!user) return <Navigate to="/login?redirect=/messages" replace />;

  const otherOf = (c) => (c.buyer_id === user.id ? c.seller : c.buyer);
  const active = conversations.find((c) => c.id === activeId);
  const other = active ? otherOf(active) : null;

  const send = async (e) => {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || !activeId) return;

    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      sender_id: user.id,
      body: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");

    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: activeId, sender_id: user.id, body: text })
      .select()
      .single();

    if (error) {
      // eslint-disable-next-line no-console
      console.error("[messages] send:", error);
      toast.error(t("messages.sendFailed"));
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(text);
      return;
    }
    setMessages((prev) => prev.map((m) => (m.id === tempId ? data : m)));
  };

  return (
    <div className="page messages-page">
      <div className="container">
        <h1 className="page-title">{t("messages.title")}</h1>

        {conversations.length === 0 ? (
          <div className="empty">
            <h3>{t("messages.empty")}</h3>
            <p className="muted">{t("messages.emptyHint")}</p>
            <Link to="/search" className="btn btn-primary">{t("messages.browse")}</Link>
          </div>
        ) : (
          <div className="messages-grid">
            <aside className="thread-list">
              {conversations.map((c) => {
                const partner = otherOf(c);
                const lastMessage =
                  c.id === activeId ? messages[messages.length - 1]?.body : null;
                const unread = unreadByConv[c.id] || 0;
                return (
                  <button
                    key={c.id}
                    className={`thread-item ${activeId === c.id ? "is-active" : ""}`}
                    onClick={() => setActiveId(c.id)}
                  >
                    <img
                      src={c.product?.images?.[0] || placeholderImg}
                      alt={c.product?.title || "Listing"}
                    />
                    <div className="thread-info">
                      <div className="thread-with">
                        {partner?.name || t("messages.unknownUser")}
                        {unread > 0 && (
                          <span className="unread-badge" style={{ marginLeft: 6 }}>
                            {unread}
                          </span>
                        )}
                      </div>
                      <div className="thread-product">
                        {c.product?.title || t("messages.removedListing")}
                      </div>
                      <div
                        className={`thread-last small ${unread > 0 ? "" : "muted"}`}
                        style={unread > 0 ? { fontWeight: 600 } : undefined}
                      >
                        {lastMessage || t("messages.openHint")}
                      </div>
                    </div>
                  </button>
                );
              })}
            </aside>

            <main className="thread-view">
              {active ? (
                <>
                  <header className="thread-header">
                    <img
                      src={active.product?.images?.[0] || placeholderImg}
                      alt={active.product?.title || "Listing"}
                    />
                    <div>
                      <div className="thread-with">{other?.name || t("messages.unknownUser")}</div>
                      {active.product ? (
                        <Link to={`/product/${active.product_id}`} className="small">
                          {t("messages.about", { title: active.product.title })}
                        </Link>
                      ) : (
                        <span className="muted small">{t("messages.listingRemoved")}</span>
                      )}
                    </div>
                  </header>
                  <div className="thread-messages">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={`bubble ${m.sender_id === user.id ? "mine" : "theirs"}`}
                      >
                        <div>{m.body}</div>
                        <div className="bubble-time">
                          {new Date(m.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  <form className="thread-input" onSubmit={send}>
                    <input
                      type="text"
                      placeholder={t("messages.placeholder")}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                    />
                    <button type="submit" className="btn btn-primary" disabled={!draft.trim()}>
                      {t("messages.send")}
                    </button>
                  </form>
                </>
              ) : (
                <div className="thread-placeholder muted">
                  {t("messages.selectThread")}
                </div>
              )}
            </main>
          </div>
        )}
      </div>
    </div>
  );
}

export default Messages;

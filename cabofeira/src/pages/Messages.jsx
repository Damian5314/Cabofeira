import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useMessages } from "../context/MessagesContext";
import { useToast } from "../components/Toast";
import { useT } from "../i18n/I18nContext";
import { supabase } from "../lib/supabase";
import "./Messages.css";
import BlockUserButton from "../components/BlockUserButton";

const placeholderImg = "/listing-placeholder.svg";

function Messages() {
  const { user } = useAuth();
  const { unreadByConv, markRead } = useMessages();
  const toast = useToast();
  const t = useT();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const activeRef = useRef(activeId);
  activeRef.current = activeId;
  const accountRef = useRef(user?.id);
  accountRef.current = user?.id;
  const messageRequest = useRef(0);

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
    if (accountRef.current === user.id) setConversations(data || []);
  }, [user]);

  const loadMessages = useCallback(async (convId) => {
    const request = ++messageRequest.current;
    if (!convId) {
      setMessages([]);
      return;
    }
    const { data, error } = await supabase
      .from("messages")
      .select("id, sender_id, body, created_at")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[messages] load messages:", error);
      return;
    }
    if (request === messageRequest.current && activeRef.current === convId) {
      setMessages((prev) => [...new Map([...(data || []).reverse(), ...prev].map((m) => [m.id, m])).values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
    }
  }, []);

  useEffect(() => {
    setConversations([]);
    setActiveId(null);
    setMessages([]);
    setDraft("");
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    setMessages([]);
    setDraft("");
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
          if (activeRef.current !== activeId) return;
          setMessages((prev) =>
            prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]
          );
          loadConversations();
          if (document.visibilityState === "visible") markRead(activeId);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeId, loadConversations, markRead]);

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
    if (!text || !activeId || sending) return;
    setSending(true);
    const conversationId = activeId;

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

    setSending(false);
    if (activeRef.current !== conversationId) return;

    if (error) {
      // eslint-disable-next-line no-console
      console.error("[messages] send:", error);
      toast.error(t("messages.sendFailed"));
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(text);
      return;
    }
    setMessages((prev) => [...prev.filter((m) => m.id !== tempId && m.id !== data.id), data]);
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

            <section className="thread-view">
              {active ? (
                <>
                  <header className="thread-header">
                    <BlockUserButton userId={other?.id} onChanged={() => { setActiveId(null); loadConversations(); }} />
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
                      maxLength={4000}
                      placeholder={t("messages.placeholder")}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                    />
                    <button type="submit" className="btn btn-primary" disabled={sending || !draft.trim()}>
                      {t("messages.send")}
                    </button>
                  </form>
                </>
              ) : (
                <div className="thread-placeholder muted">
                  {t("messages.selectThread")}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

export default Messages;

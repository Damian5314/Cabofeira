import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Messages.css";

const STORAGE_KEY = "cabofeira_messages";

function loadThreads() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveThreads(threads) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
}

function Messages() {
  const { user } = useAuth();
  const [threads, setThreads] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setThreads(loadThreads());
  }, []);

  if (!user) return <Navigate to="/login?redirect=/messages" replace />;

  const threadList = Object.entries(threads).map(([id, t]) => ({ id, ...t }));
  const active = activeId ? threads[activeId] : null;

  const send = () => {
    if (!draft.trim() || !activeId) return;
    const updated = { ...threads };
    updated[activeId] = {
      ...updated[activeId],
      messages: [
        ...updated[activeId].messages,
        { from: user.id, text: draft.trim(), at: new Date().toISOString() },
      ],
    };
    setThreads(updated);
    saveThreads(updated);
    setDraft("");
    // Auto-reply after a short delay so the page feels alive.
    setTimeout(() => {
      const withReply = { ...updated };
      withReply[activeId] = {
        ...withReply[activeId],
        messages: [
          ...withReply[activeId].messages,
          {
            from: withReply[activeId].withUserId,
            text: "Thanks for your interest, I'll get back to you shortly!",
            at: new Date().toISOString(),
          },
        ],
      };
      setThreads(withReply);
      saveThreads(withReply);
    }, 1200);
  };

  return (
    <div className="page messages-page">
      <div className="container">
        <h1 className="page-title">💬 Messages</h1>

        {threadList.length === 0 ? (
          <div className="empty">
            <h3>No conversations yet</h3>
            <p className="muted">When you message a seller, the conversation will appear here.</p>
            <Link to="/search" className="btn btn-primary">Browse listings</Link>
          </div>
        ) : (
          <div className="messages-grid">
            <aside className="thread-list">
              {threadList.map((t) => (
                <button
                  key={t.id}
                  className={`thread-item ${activeId === t.id ? "is-active" : ""}`}
                  onClick={() => setActiveId(t.id)}
                >
                  <img src={t.productImage} alt={t.productTitle} />
                  <div className="thread-info">
                    <div className="thread-with">{t.withUser}</div>
                    <div className="thread-product">{t.productTitle}</div>
                    <div className="thread-last muted small">
                      {t.messages[t.messages.length - 1]?.text}
                    </div>
                  </div>
                </button>
              ))}
            </aside>

            <main className="thread-view">
              {active ? (
                <>
                  <header className="thread-header">
                    <img src={active.productImage} alt={active.productTitle} />
                    <div>
                      <div className="thread-with">{active.withUser}</div>
                      <Link to={`/product/${active.productId}`} className="small">
                        About: {active.productTitle}
                      </Link>
                    </div>
                  </header>
                  <div className="thread-messages">
                    {active.messages.map((m, i) => (
                      <div
                        key={i}
                        className={`bubble ${m.from === user.id ? "mine" : "theirs"}`}
                      >
                        <div>{m.text}</div>
                        <div className="bubble-time">
                          {new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    ))}
                  </div>
                  <form
                    className="thread-input"
                    onSubmit={(e) => {
                      e.preventDefault();
                      send();
                    }}
                  >
                    <input
                      type="text"
                      placeholder="Type a message..."
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                    />
                    <button type="submit" className="btn btn-primary" disabled={!draft.trim()}>
                      Send
                    </button>
                  </form>
                </>
              ) : (
                <div className="thread-placeholder muted">
                  Select a conversation to view messages.
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

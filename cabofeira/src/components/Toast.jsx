import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import "./Toast.css";

const ToastContext = createContext(null);

let nextId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (type, msg, opts = {}) => {
      const id = ++nextId;
      const isStringMsg = typeof msg === "string";
      const message = isStringMsg ? msg : msg?.message;
      const title = isStringMsg ? opts.title : msg?.title;
      const duration = opts.duration ?? (type === "error" ? 6000 : 4000);

      setToasts((prev) => [...prev, { id, type, title, message, duration }]);

      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      success: (msg, opts) => push("success", msg, opts),
      error: (msg, opts) => push("error", msg, opts),
      info: (msg, opts) => push("info", msg, opts),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({ toasts, onDismiss }) {
  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.type}`}
          role={t.type === "error" ? "alert" : "status"}
        >
          <span className="toast-icon" aria-hidden="true">
            {t.type === "success" ? "✓" : t.type === "error" ? "✕" : "ℹ"}
          </span>
          <div className="toast-body">
            {t.title && <div className="toast-title">{t.title}</div>}
            {t.message && <div className="toast-message">{t.message}</div>}
          </div>
          <button
            type="button"
            className="toast-close"
            aria-label="Dismiss notification"
            onClick={() => onDismiss(t.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

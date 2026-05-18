import React, { useEffect, useState } from "react";
import "./ConfirmDialog.css";

export default function ConfirmDialog({
  open,
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  requireText,
  onConfirm,
  onCancel,
}) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) onCancel?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const textOk = !requireText || typed === requireText;

  return (
    <div
      className="confirm-backdrop"
      onClick={() => {
        if (!busy) onCancel?.();
      }}
    >
      <div
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-title" className="confirm-title">{title}</h3>
        {message && <div className="confirm-message">{message}</div>}
        {requireText && (
          <div className="confirm-require">
            <label className="confirm-require-label">
              Type <code>{requireText}</code> to confirm:
            </label>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              disabled={busy}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        )}
        <div className="confirm-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
            onClick={onConfirm}
            disabled={busy || !textOk}
            autoFocus={!requireText}
          >
            {busy ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

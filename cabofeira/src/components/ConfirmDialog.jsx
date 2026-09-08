import React, { useEffect, useRef, useId, useState } from "react";
import "./ConfirmDialog.css";
import useDialogFocus from "../hooks/useDialogFocus";
import { useT } from "../i18n/I18nContext";

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  busy = false,
  requireText,
  onConfirm,
  onCancel,
}) {
  const [typed, setTyped] = useState("");
  const t = useT();
  const dialog = useRef(null);
  const titleId = useId();
  useDialogFocus(dialog, open);

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
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id={titleId} className="confirm-title">{title || t("dialog.title")}</h3>
        {message && <div className="confirm-message">{message}</div>}
        {requireText && (
          <div className="confirm-require">
            <label className="confirm-require-label">
              {t("dialog.type", { text: requireText })}
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
            {cancelLabel || t("dialog.cancel")}
          </button>
          <button
            type="button"
            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
            onClick={onConfirm}
            disabled={busy || !textOk}
            autoFocus={!requireText}
          >
            {busy ? t("common.loading") : confirmLabel || t("dialog.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useT } from "../i18n/I18nContext";
import { LogoMark } from "../assets/logo";
import "./Auth.css";

function ForgotPassword() {
  const { requestPasswordReset } = useAuth();
  const t = useT();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSending(true);
    const result = await requestPasswordReset(email);
    setSending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSent(true);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-logo">
          <LogoMark size={56} />
          <h1>CaboFeira</h1>
        </Link>
        <h2>{t("auth.forgot.title")}</h2>
        <p className="muted">{t("auth.forgot.intro")}</p>

        {error && <div className="auth-error">{error}</div>}

        {sent ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <h3 style={{ color: "#10b981", marginBottom: 8 }}>{t("auth.forgot.sent")}</h3>
            <p className="muted">{t("auth.forgot.sentHint")}</p>
            <Link to="/login" className="btn btn-outline btn-block" style={{ marginTop: 20 }}>
              {t("auth.forgot.backToLogin")}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <label>
              <span>{t("auth.email")}</span>
              <input
                type="email"
                placeholder={t("auth.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                autoFocus
              />
            </label>
            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={sending || !email}
            >
              {sending ? t("auth.forgot.sending") : t("auth.forgot.send")}
            </button>
            <p className="auth-footer">
              <Link to="/login">{t("auth.forgot.backToLogin")}</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export default ForgotPassword;

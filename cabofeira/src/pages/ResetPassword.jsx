import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useT } from "../i18n/I18nContext";
import { supabase } from "../lib/supabase";
import { LogoMark } from "../assets/logo";
import "./Auth.css";

function ResetPassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const t = useT();

  const [hasSession, setHasSession] = useState(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // Supabase parses the recovery token from the URL fragment on load and
  // creates a temporary session. We wait for that session before showing the
  // form — otherwise the user lands here without a valid recovery context.
  useEffect(() => {
    let alive = true;
    const sub = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) setHasSession(!!session);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setHasSession(!!data.session);
    });
    return () => {
      alive = false;
      sub.data.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError(t("auth.errors.passwordMismatch"));
      return;
    }
    setBusy(true);
    const result = await updatePassword(password);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(true);
    setTimeout(async () => {
      await supabase.auth.signOut();
      navigate("/login");
    }, 1800);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-logo">
          <LogoMark size={56} />
          <h1>CaboFeira</h1>
        </Link>
        <h2>{t("auth.reset.title")}</h2>
        <p className="muted">{t("auth.reset.intro")}</p>

        {hasSession === false && (
          <div className="auth-error">{t("auth.reset.invalidLink")}</div>
        )}
        {error && <div className="auth-error">{error}</div>}

        {done ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <h3 style={{ color: "#10b981", marginBottom: 8 }}>{t("auth.reset.success")}</h3>
            <p className="muted">{t("auth.reset.successHint")}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <label>
              <span>{t("auth.reset.newPassword")}</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.passwordHint")}
                autoComplete="new-password"
                required
                disabled={hasSession === false}
              />
            </label>
            <label>
              <span>{t("auth.reset.confirmPassword")}</span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
                disabled={hasSession === false}
              />
            </label>
            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={busy || !password || !confirm || hasSession === false}
            >
              {busy ? t("auth.reset.updating") : t("auth.reset.update")}
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

export default ResetPassword;

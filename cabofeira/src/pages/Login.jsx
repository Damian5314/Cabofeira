import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useT } from "../i18n/I18nContext";
import { useToast } from "../components/Toast";
import { LogoMark } from "../assets/logo";
import "./Auth.css";

function Login() {
  const { login, resendConfirmation } = useAuth();
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get("redirect") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setNeedsConfirm(false);
    const result = await login({ email, password });
    if (!result.ok) {
      setError(result.error);
      if (/email.*(not\s+confirmed|not\s+verified)/i.test(result.error || "")) {
        setNeedsConfirm(true);
      }
      return;
    }
    navigate(redirect);
  };

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    const result = await resendConfirmation(email);
    setResending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(t("auth.confirm.resent"));
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-logo">
          <LogoMark size={56} />
          <h1>CaboFeira</h1>
        </Link>
        <h2>{t("auth.welcomeBack")}</h2>
        <p className="muted">{t("auth.signInIntro")}</p>

        {error && <div className="auth-error">{error}</div>}

        {needsConfirm && (
          <div
            style={{
              background: "#fef3c7",
              border: "1px solid #fcd34d",
              borderRadius: 8,
              padding: "12px 14px",
              marginBottom: 12,
            }}
          >
            <p style={{ margin: "0 0 10px", fontSize: "0.9rem", color: "#92400e" }}>
              {t("auth.confirm.notConfirmed")}
            </p>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleResend}
              disabled={resending || !email}
            >
              {resending ? t("auth.confirm.resending") : t("auth.confirm.resend")}
            </button>
          </div>
        )}

        <div className="demo-hint">
          <strong>{t("auth.demoAccounts")}</strong>
          <button
            type="button"
            onClick={() => { setEmail("admin@cabofeira.cv"); setPassword("admin123"); }}
          >
            👑 admin@cabofeira.cv / admin123
          </button>
          <button
            type="button"
            onClick={() => { setEmail("user@cabofeira.cv"); setPassword("user123"); }}
          >
            👤 user@cabofeira.cv / user123
          </button>
        </div>

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
            />
          </label>

          <label>
            <span>{t("auth.password")}</span>
            <div className="password-input">
              <input
                type={showPassword ? "text" : "password"}
                placeholder={t("auth.passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </label>

          <div className="auth-row">
            <label className="checkbox">
              <input type="checkbox" /> {t("auth.rememberMe")}
            </label>
            <Link to="/forgot" className="small">{t("auth.forgotPassword")}</Link>
          </div>

          <button type="submit" className="btn btn-primary btn-block">
            {t("auth.signIn")}
          </button>
        </form>

        <div className="divider"><span>{t("common.or")}</span></div>

        <div className="social-row">
          <button className="btn btn-outline btn-block" onClick={(e) => e.preventDefault()}>
            {t("auth.continueGoogle")}
          </button>
          <button className="btn btn-outline btn-block" onClick={(e) => e.preventDefault()}>
            {t("auth.continueFacebook")}
          </button>
        </div>

        <p className="auth-footer">
          {t("auth.noAccount")} <Link to="/register">{t("auth.signUp")}</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;

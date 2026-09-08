import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useT } from "../i18n/I18nContext";
import { LogoMark } from "../assets/logo";
import "./Auth.css";

function Register() {
  const { register } = useAuth();
  const t = useT();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    agree: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (!form.agree) {
      setError(t("auth.errors.agreeRequired"));
      return;
    }
    setBusy(true);
    let result;
    try { result = await register(form); }
    catch { result = { ok: false, error: t("common.error") }; }
    finally { setBusy(false); }
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.needsConfirmation) {
      setSentEmail(form.email);
      return;
    }
    navigate("/profile");
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-logo">
          <LogoMark size={56} />
          <h1>CaboFeira</h1>
        </Link>
        <h2>{t("auth.createAccount")}</h2>
        <p className="muted">{t("auth.joinIntro")}</p>

        {error && <div className="auth-error" role="alert">{error}</div>}

        {sentEmail && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <h3 style={{ color: "#10b981", marginBottom: 8 }}>
              {t("auth.confirm.checkInbox")}
            </h3>
            <p className="muted" style={{ marginBottom: 8 }}>
              {t("auth.confirm.sentTo", { email: sentEmail })}
            </p>
            <p className="muted">{t("auth.confirm.clickToActivate")}</p>
            <Link to="/login" className="btn btn-outline btn-block" style={{ marginTop: 20 }}>
              {t("auth.confirm.backToLogin")}
            </Link>
          </div>
        )}

        {!sentEmail && (
          <form onSubmit={handleSubmit} className="auth-form">
            <label>
              <span>{t("auth.fullName")}</span>
              <input
                type="text"
                name="name"
                autoComplete="nickname"
                maxLength={100}
                placeholder={t("auth.fullNamePlaceholder")}
                value={form.name}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              <span>{t("auth.email")}</span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                placeholder={t("auth.emailPlaceholder")}
                value={form.email}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              <span>{t("auth.phoneOptional")}</span>
              <input
                type="tel"
                name="phone"
                autoComplete="tel"
                aria-describedby="signup-phone-hint"
                placeholder={t("auth.phonePlaceholder")}
                value={form.phone}
                onChange={handleChange}
              />
            </label>

            <p className="muted small" id="signup-phone-hint">{t("policy.phoneHint")}</p>
            <label>
              <span>{t("auth.password")}</span>
              <div className="password-input">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="new-password"
                  placeholder={t("auth.passwordHint")}
                  value={form.password}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={t(showPassword ? "accessibility.hidePassword" : "accessibility.showPassword")} aria-pressed={showPassword}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </label>

            <label>
              <span>{t("auth.confirmPassword")}</span>
              <input
                type={showPassword ? "text" : "password"}
                name="confirmPassword"
                autoComplete="new-password"
                placeholder={t("auth.confirmPasswordPlaceholder")}
                value={form.confirmPassword}
                onChange={handleChange}
                required
              />
            </label>

            <label className="checkbox">
              <input
                type="checkbox"
                name="agree"
                required
                checked={form.agree}
                onChange={handleChange}
              />
              <span>
                {t("policy.acceptTerms")}{" "}<Link to="/terms">{t("auth.terms")}</Link>.
              </span>
            </label>

            <p className="muted small">{t("policy.privacyNotice")}{" "}<Link to="/privacy">{t("auth.privacy")}</Link>.</p>
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {t("auth.createAccountBtn")}
            </button>
          </form>
        )}

        {!sentEmail && (
          <p className="auth-footer">
            {t("auth.alreadyAccount")} <Link to="/login">{t("auth.signIn")}</Link>
          </p>
        )}
      </div>
    </div>
  );
}

export default Register;

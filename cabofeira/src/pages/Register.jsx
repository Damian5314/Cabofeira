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

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.agree) {
      setError(t("auth.errors.agreeRequired"));
      return;
    }
    const result = await register(form);
    if (!result.ok) {
      setError(result.error);
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

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            <span>{t("auth.fullName")}</span>
            <input
              type="text"
              name="name"
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
              placeholder={t("auth.phonePlaceholder")}
              value={form.phone}
              onChange={handleChange}
            />
          </label>

          <label>
            <span>{t("auth.password")}</span>
            <div className="password-input">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder={t("auth.passwordHint")}
                value={form.password}
                onChange={handleChange}
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

          <label>
            <span>{t("auth.confirmPassword")}</span>
            <input
              type={showPassword ? "text" : "password"}
              name="confirmPassword"
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
              checked={form.agree}
              onChange={handleChange}
            />
            <span>
              {t("auth.agreeTerms", { terms: "", privacy: "" })}{" "}
              <Link to="/terms">{t("auth.terms")}</Link> &amp;{" "}
              <Link to="/privacy">{t("auth.privacy")}</Link>.
            </span>
          </label>

          <button type="submit" className="btn btn-primary btn-block">
            {t("auth.createAccountBtn")}
          </button>
        </form>

        <p className="auth-footer">
          {t("auth.alreadyAccount")} <Link to="/login">{t("auth.signIn")}</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;

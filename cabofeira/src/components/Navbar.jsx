import React, { useState, useRef, useEffect } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { HiMenu, HiX, HiSearch } from "react-icons/hi";
import { useAuth } from "../context/AuthContext";
import { useMessages } from "../context/MessagesContext";
import { useT } from "../i18n/I18nContext";
import LanguageSwitcher from "./LanguageSwitcher";
import { LogoMark } from "../assets/logo";
import "./Navbar.css";

function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const { unreadTotal } = useMessages();
  const t = useT();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const closeMobile = () => setMobileOpen(false);

  const handleSearch = (e) => {
    e.preventDefault();
    const q = search.trim();
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
    closeMobile();
  };

  const SearchForm = ({ className = "" }) => (
    <form className={`navbar-search ${className}`} onSubmit={handleSearch}>
      <input
        type="text"
        placeholder={t("nav.searchPlaceholder")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <button type="submit" aria-label={t("common.search")}>
        <HiSearch size={18} />
      </button>
    </form>
  );

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="logo-link" onClick={closeMobile}>
          <LogoMark size={36} />
          <div className="logo-stack">
            <span className="logo-title">CaboFeira</span>
            <span className="logo-tagline">Mercado Online</span>
          </div>
        </Link>

        <SearchForm className="desktop-only" />

        <button
          className="mobile-toggle"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? t("common.close") : t("nav.home")}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <HiX size={24} /> : <HiMenu size={24} />}
        </button>

        <div
          className={`mobile-backdrop ${mobileOpen ? "open" : ""}`}
          onClick={closeMobile}
          aria-hidden="true"
        />

        <div className={`navbar-links ${mobileOpen ? "open" : ""}`}>
          <SearchForm className="mobile-only" />

          <NavLink to="/" end onClick={closeMobile}>{t("nav.home")}</NavLink>
          <NavLink to="/categories" onClick={closeMobile}>{t("nav.categories")}</NavLink>
          <NavLink to="/search" onClick={closeMobile}>{t("nav.browse")}</NavLink>

          <Link
            to="/postad"
            className="btn btn-primary post-btn"
            onClick={closeMobile}
          >
            {t("nav.postAd")}
          </Link>

          {user ? (
            <div className="user-menu" ref={menuRef}>
              <button
                className="user-trigger"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="true"
                aria-expanded={menuOpen}
              >
                <span className="user-avatar">
                  {user.name?.[0]?.toUpperCase() || "U"}
                  {unreadTotal > 0 && <span className="unread-dot" aria-hidden="true" />}
                </span>
                <span className="user-name">{user.name}</span>
                <span className="caret">▾</span>
              </button>
              {menuOpen && (
                <div className="dropdown">
                  <Link to="/profile" onClick={() => { setMenuOpen(false); closeMobile(); }}>{t("nav.profile")}</Link>
                  <Link to="/profile/ads" onClick={() => { setMenuOpen(false); closeMobile(); }}>{t("nav.myAds")}</Link>
                  <Link to="/favorites" onClick={() => { setMenuOpen(false); closeMobile(); }}>{t("nav.favorites")}</Link>
                  <Link to="/messages" onClick={() => { setMenuOpen(false); closeMobile(); }}>
                    {t("nav.messages")}
                    {unreadTotal > 0 && <span className="unread-badge">{unreadTotal}</span>}
                  </Link>
                  {isAdmin && (
                    <>
                      <hr />
                      <Link to="/admin" onClick={() => { setMenuOpen(false); closeMobile(); }}>{t("nav.adminPanel")}</Link>
                    </>
                  )}
                  <hr />
                  <button
                    onClick={() => {
                      logout();
                      setMenuOpen(false);
                      closeMobile();
                      navigate("/");
                    }}
                  >
                    {t("nav.logout")}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="auth-buttons">
              <Link to="/login" className="btn btn-outline" onClick={closeMobile}>
                {t("nav.login")}
              </Link>
              <Link to="/register" className="btn btn-primary" onClick={closeMobile}>
                {t("nav.register")}
              </Link>
            </div>
          )}

          <LanguageSwitcher className="navbar-lang" />
        </div>
      </div>
    </nav>
  );
}

export default Navbar;

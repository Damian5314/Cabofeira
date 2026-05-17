import React, { useState, useRef, useEffect } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { HiMenu, HiX, HiSearch } from "react-icons/hi";
import { useAuth } from "../context/AuthContext";
import { LogoMark } from "../assets/logo";
import "./Navbar.css";

function Navbar() {
  const { user, isAdmin, logout } = useAuth();
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

  // Lock body scroll while the mobile drawer is open.
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
        placeholder="Search for cars, phones, houses..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <button type="submit" aria-label="Search">
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
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
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

          <NavLink to="/" end onClick={closeMobile}>Home</NavLink>
          <NavLink to="/categories" onClick={closeMobile}>Categories</NavLink>
          <NavLink to="/search" onClick={closeMobile}>Browse</NavLink>

          <Link
            to="/postad"
            className="btn btn-primary post-btn"
            onClick={closeMobile}
          >
            + Post Ad
          </Link>

          {user ? (
            <div className="user-menu" ref={menuRef}>
              <button
                className="user-trigger"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="true"
                aria-expanded={menuOpen}
              >
                <span className="user-avatar">{user.name?.[0]?.toUpperCase() || "U"}</span>
                <span className="user-name">{user.name}</span>
                <span className="caret">▾</span>
              </button>
              {menuOpen && (
                <div className="dropdown">
                  <Link to="/profile" onClick={() => { setMenuOpen(false); closeMobile(); }}>My Profile</Link>
                  <Link to="/profile/ads" onClick={() => { setMenuOpen(false); closeMobile(); }}>My Ads</Link>
                  <Link to="/favorites" onClick={() => { setMenuOpen(false); closeMobile(); }}>Favorites</Link>
                  <Link to="/messages" onClick={() => { setMenuOpen(false); closeMobile(); }}>Messages</Link>
                  {isAdmin && (
                    <>
                      <hr />
                      <Link to="/admin" onClick={() => { setMenuOpen(false); closeMobile(); }}>Admin panel</Link>
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
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="auth-buttons">
              <Link to="/login" className="btn btn-outline" onClick={closeMobile}>
                Login
              </Link>
              <Link to="/register" className="btn btn-primary" onClick={closeMobile}>
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;

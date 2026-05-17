import React, { useState, useRef, useEffect } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
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

  const handleSearch = (e) => {
    e.preventDefault();
    const q = search.trim();
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
    setMobileOpen(false);
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="logo-link" onClick={() => setMobileOpen(false)}>
          <LogoMark size={36} />
          <div className="logo-stack">
            <span className="logo-title">CaboFeira</span>
            <span className="logo-tagline">Mercado Online</span>
          </div>
        </Link>

        <form className="navbar-search" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search for cars, phones, houses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" aria-label="Search">🔍</button>
        </form>

        <button
          className="mobile-toggle"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          ☰
        </button>

        <div className={`navbar-links ${mobileOpen ? "open" : ""}`}>
          <NavLink to="/" end onClick={() => setMobileOpen(false)}>Home</NavLink>
          <NavLink to="/categories" onClick={() => setMobileOpen(false)}>Categories</NavLink>
          <NavLink to="/search" onClick={() => setMobileOpen(false)}>Browse</NavLink>

          <Link
            to="/postad"
            className="btn btn-primary post-btn"
            onClick={() => setMobileOpen(false)}
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
                  <Link to="/profile" onClick={() => setMenuOpen(false)}>👤 My Profile</Link>
                  <Link to="/profile/ads" onClick={() => setMenuOpen(false)}>📋 My Ads</Link>
                  <Link to="/favorites" onClick={() => setMenuOpen(false)}>❤️ Favorites</Link>
                  <Link to="/messages" onClick={() => setMenuOpen(false)}>💬 Messages</Link>
                  {isAdmin && (
                    <>
                      <hr />
                      <Link to="/admin" onClick={() => setMenuOpen(false)}>👑 Admin panel</Link>
                    </>
                  )}
                  <hr />
                  <button
                    onClick={() => {
                      logout();
                      setMenuOpen(false);
                      navigate("/");
                    }}
                  >
                    🚪 Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="auth-buttons">
              <Link to="/login" className="btn btn-outline" onClick={() => setMobileOpen(false)}>
                Login
              </Link>
              <Link to="/register" className="btn btn-primary" onClick={() => setMobileOpen(false)}>
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

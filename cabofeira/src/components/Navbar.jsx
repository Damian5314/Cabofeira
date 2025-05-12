import React from "react";
import { Link } from "react-router-dom";
import "./Navbar.css";

function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-left">
        <Link to="/" className="logo">CaboFeira</Link>
        <Link to="/">Start</Link>
        <Link to="/categories">Categories</Link>
        <Link to="/faq">FAQ</Link>
      </div>
      <div className="navbar-right">
        <button className="post-ad">+ Post an Ad</button>
        <button className="signup">Signup</button>
        <button className="login">Login</button>
      </div>
    </nav>
  );
}

export default Navbar;

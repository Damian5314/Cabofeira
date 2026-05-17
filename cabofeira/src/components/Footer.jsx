import React from "react";
import { Link } from "react-router-dom";
import { LogoMark } from "../assets/logo";
import "./Footer.css";

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-top">
          <div className="footer-column footer-brand">
            <div className="footer-logo">
              <LogoMark size={40} />
              <div>
                <strong>CaboFeira</strong>
                <span>Mercado Online de Cabo Verde</span>
              </div>
            </div>
            <p className="footer-tag">
              The trusted marketplace for all 9 islands of Cabo Verde.
            </p>
          </div>

          <div className="footer-column">
            <h4>Marketplace</h4>
            <ul>
              <li><Link to="/">Home</Link></li>
              <li><Link to="/categories">Categories</Link></li>
              <li><Link to="/search">Browse ads</Link></li>
              <li><Link to="/postad">Post an ad</Link></li>
            </ul>
          </div>

          <div className="footer-column">
            <h4>Company</h4>
            <ul>
              <li><Link to="/about">About us</Link></li>
              <li><Link to="/contact">Contact</Link></li>
              <li><Link to="/faq">FAQ</Link></li>
              <li><Link to="/privacy">Privacy Policy</Link></li>
              <li><Link to="/terms">Terms of Service</Link></li>
            </ul>
          </div>

          <div className="footer-column">
            <h4>Follow us</h4>
            <ul>
              <li>
                <a href="https://www.facebook.com/profile.php?id=100067750758548" target="_blank" rel="noopener noreferrer">
                  Facebook
                </a>
              </li>
              <li><button type="button" className="link-btn" onClick={() => {}}>Instagram</button></li>
              <li><button type="button" className="link-btn" onClick={() => {}}>WhatsApp</button></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} CaboFeira — Mercado Online de Cabo Verde.</p>
          <p className="footer-flag">
            <span style={{ color: "#003893" }}>■</span>
            <span style={{ color: "#fff", textShadow: "0 0 1px #888" }}>■</span>
            <span style={{ color: "#cf2027" }}>■</span>
            <span style={{ color: "#f7d116" }}>★</span>
            <span style={{ marginLeft: 6 }}>Made for Cabo Verde</span>
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;

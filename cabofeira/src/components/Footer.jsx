import React from "react";
import "./Footer.css";

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <div className="footer-column">
          <h3>CaboFeira</h3>
          <p>Mercado Online de Cabo Verde</p>
        </div>
        <div className="footer-column">
          <h4>Information</h4>
          <ul>
            <li><a href="/aboutus">About us</a></li>
            <li><a href="/contact">Contact</a></li>
            <li><a href="privacypolicy">Privacy Policy</a></li>
          </ul>
        </div>
        <div className="footer-column">
          <h4>Most Popular</h4>
          <p>No ads viewed yet.</p>
        </div>
        <div className="footer-column">
          <h4>Our social media</h4>
          <ul>
            <li><a href="https://www.facebook.com/profile.php?id=100067750758548">Facebook</a></li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} CaboFeira | All Rights Reserved</p>
        <div className="footer-links">
          <a href="/">Start</a>
          <a href="/categories">Categories</a>
          <a href="/help">Help</a>
          <a href="/faq">FAQ</a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;

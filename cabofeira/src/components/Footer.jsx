import React from "react";
import { Link } from "react-router-dom";
import { LogoMark } from "../assets/logo";
import { useT } from "../i18n/I18nContext";
import "./Footer.css";

function Footer() {
  const t = useT();
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
            <p className="footer-tag">{t("footer.tagline")}</p>
          </div>

          <div className="footer-column">
            <h4>{t("footer.platform")}</h4>
            <ul>
              <li><Link to="/">{t("nav.home")}</Link></li>
              <li><Link to="/categories">{t("footer.categories")}</Link></li>
              <li><Link to="/search">{t("footer.browseListings")}</Link></li>
              <li><Link to="/postad">{t("footer.postAd")}</Link></li>
            </ul>
          </div>

          <div className="footer-column">
            <h4>{t("footer.company")}</h4>
            <ul>
              <li><Link to="/about">{t("footer.about")}</Link></li>
              <li><Link to="/contact">{t("footer.contact")}</Link></li>
              <li><Link to="/faq">{t("footer.faq")}</Link></li>
              <li><Link to="/privacy">{t("footer.privacy")}</Link></li>
              <li><Link to="/terms">{t("footer.terms")}</Link></li>
            </ul>
          </div>

          <div className="footer-column">
            <h4>{t("footer.support")}</h4>
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
          <p>{t("footer.rights", { year: new Date().getFullYear() })}</p>
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

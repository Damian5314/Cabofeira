import React from "react";
import { Link } from "react-router-dom";
import { useT } from "../i18n/I18nContext";
import "./Info.css";
function InfoPage({ title, children }) {
  return <section className="page info-page"><div className="container narrow"><h1 className="page-title">{title}</h1>{children}</div></section>;
}
export function About() {
  const t = useT();
  return <InfoPage title={t("footer.about")}><p className="lead">{t("info.about")}</p><p>{t("info.how")}</p><p>{t("launch.freeYear")}</p><Link to="/search" className="btn btn-primary">{t("footer.browseListings")}</Link></InfoPage>;
}
export function Contact() {
  const t = useT();
  const email = process.env.REACT_APP_SUPPORT_EMAIL;
  return <InfoPage title={t("footer.contact")}><p>{t("info.contact")}</p>
    {email ? <a href={`mailto:${email}`} className="btn btn-primary">{email}</a> : <p role="status">{t("info.noSupport")}</p>}
    <p>{t("info.report")}</p><Link to="/faq">{t("footer.faq")}</Link></InfoPage>;
}
export function FAQ() {
  const t = useT();
  return <InfoPage title={t("footer.faq")}><div className="faq-list">{["free", "post", "contact", "safety", "manage", "islands"].map((key) => <details className="faq-item" key={key}><summary className="faq-q">{t(`info.faq.${key}.q`)}</summary><p className="faq-a">{t(`info.faq.${key}.a`)}</p></details>)}</div></InfoPage>;
}
export function Terms() {
  const t = useT();
  return <InfoPage title={t("footer.terms")}>{["marketplace", "conduct", "transactions", "moderation", "free"].map((key) => <p key={key}>{t(`info.terms.${key}`)}</p>)}<Link to="/contact">{t("footer.contact")}</Link></InfoPage>;
}
export function Privacy() {
  const t = useT();
  return <InfoPage title={t("footer.privacy")}>{["data", "public", "messages", "storage", "deletion"].map((key) => <p key={key}>{t(`info.privacy.${key}`)}</p>)}<Link to="/contact">{t("footer.contact")}</Link></InfoPage>;
}
export function Cookies() {
  const t = useT();
  return <InfoPage title={t("policy.cookiesTitle")}>{["storage", "session", "language", "views", "thirdParties", "controls"].map((key) => <p key={key}>{t(`policy.cookies.${key}`)}</p>)}<Link to="/privacy">{t("footer.privacy")}</Link></InfoPage>;
}
export function Returns() {
  const t = useT();
  return <InfoPage title={t("policy.returnsTitle")}>{["platform", "seller", "rights", "dispute"].map((key) => <p key={key}>{t(`policy.returns.${key}`)}</p>)}<Link to="/contact">{t("footer.contact")}</Link></InfoPage>;
}
export function NotFound() {
  const t = useT();
  return <InfoPage title="404"><p>{t("info.notFound")}</p><Link to="/" className="btn btn-primary">{t("nav.home")}</Link></InfoPage>;
}

import React, { useState } from "react";
import { Link } from "react-router-dom";
import "./Info.css";

export function About() {
  return (
    <div className="page info-page">
      <div className="container narrow">
        <h1 className="page-title">About CaboFeira</h1>
        <p className="lead">
          CaboFeira is the marketplace built for Cabo Verde — a place where neighbours
          can buy, sell, and trade across all 9 islands.
        </p>
        <p>
          Whether you're in Praia, Mindelo or Santa Maria, CaboFeira makes it easy to
          find what you need or earn extra by selling what you no longer use.
        </p>
        <h2>Our mission</h2>
        <p>
          To create a trusted, local-first marketplace that strengthens the
          Cape Verdean community and economy. From handmade <em>pano di terra</em> to
          cars, apartments, and fresh fish — we want everything to find a new home.
        </p>
        <h2>How it works</h2>
        <ol>
          <li>Create a free account.</li>
          <li>Post an ad with photos, a description, and a price.</li>
          <li>Connect with buyers by phone, email or in-app messages.</li>
        </ol>
        <h2>Contact</h2>
        <p>
          Questions? Visit our <Link to="/contact">contact page</Link> or check the{" "}
          <Link to="/faq">FAQ</Link>.
        </p>
      </div>
    </div>
  );
}

export function Contact() {
  const [sent, setSent] = useState(false);
  return (
    <div className="page info-page">
      <div className="container narrow">
        <h1 className="page-title">Contact us</h1>
        <p className="lead">
          We'd love to hear from you. Reach out and we'll get back as soon as we can.
        </p>

        <div className="contact-grid">
          <div className="contact-info">
            <h3>📧 Email</h3>
            <p><a href="mailto:hello@cabofeira.cv">hello@cabofeira.cv</a></p>
            <h3>📞 Phone</h3>
            <p>+238 990 0000</p>
            <h3>📍 Office</h3>
            <p>Av. Cidade de Lisboa<br />Praia, Santiago<br />Cabo Verde</p>
          </div>

          <form
            className="contact-form"
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
            }}
          >
            {sent ? (
              <div className="success-card">
                <h3>✓ Thanks!</h3>
                <p>Your message has been sent. We'll reply within 1–2 business days.</p>
              </div>
            ) : (
              <>
                <label>
                  <span>Your name</span>
                  <input type="text" required />
                </label>
                <label>
                  <span>Email</span>
                  <input type="email" required />
                </label>
                <label>
                  <span>Subject</span>
                  <input type="text" required />
                </label>
                <label>
                  <span>Message</span>
                  <textarea rows={5} required></textarea>
                </label>
                <button type="submit" className="btn btn-primary btn-block">Send message</button>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

const faqs = [
  {
    q: "Is CaboFeira free to use?",
    a: "Yes! Posting and browsing ads is completely free. We only charge for optional Featured listings.",
  },
  {
    q: "How do I post an ad?",
    a: 'Sign up for a free account, then click "+ Post Ad" at the top of any page. Follow the 4-step form and you\'re live.',
  },
  {
    q: "How do I contact a seller?",
    a: "Open any listing and use the buttons on the right — call, email or send an in-app message.",
  },
  {
    q: "Is it safe?",
    a: "Yes, but always meet in public places, inspect items before paying, and never share bank or password info. Report suspicious ads using the report button.",
  },
  {
    q: "How do I edit or delete my ad?",
    a: "Go to My Ads in your profile menu. You'll see Edit and Delete buttons next to each listing.",
  },
  {
    q: "Which islands are covered?",
    a: "All 9 inhabited islands: Santiago, São Vicente, Santo Antão, Fogo, Sal, Boa Vista, Maio, São Nicolau, and Brava.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState(null);
  return (
    <div className="page info-page">
      <div className="container narrow">
        <h1 className="page-title">Frequently asked questions</h1>
        <p className="lead">Everything you need to know about using CaboFeira.</p>

        <div className="faq-list">
          {faqs.map((f, i) => (
            <div key={i} className={`faq-item ${open === i ? "open" : ""}`}>
              <button onClick={() => setOpen(open === i ? null : i)} className="faq-q">
                <span>{f.q}</span>
                <span className="caret">{open === i ? "−" : "+"}</span>
              </button>
              {open === i && <div className="faq-a">{f.a}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="page info-page">
      <div className="container narrow" style={{ textAlign: "center", padding: "60px 20px" }}>
        <h1 style={{ fontSize: "5rem", margin: 0, color: "var(--cf-blue)" }}>404</h1>
        <h2>Page not found</h2>
        <p className="muted">The page you're looking for doesn't exist or has been moved.</p>
        <Link to="/" className="btn btn-primary">Back to home</Link>
      </div>
    </div>
  );
}

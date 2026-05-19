import React, { useEffect, useRef, useState } from "react";
import { FEATURES, ADS_CONFIG, adsReady } from "../config/features";
import "./AdSlot.css";

let scriptPromise = null;

function loadAdSenseScript(clientId) {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-adsense="true"]');
    if (existing) return resolve();
    const s = document.createElement("script");
    s.async = true;
    s.crossOrigin = "anonymous";
    s.dataset.adsense = "true";
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export default function AdSlot({
  placement,
  format = "auto",
  layout,
  responsive = true,
  className = "",
  style,
}) {
  const ref = useRef(null);
  const insRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const pushed = useRef(false);

  useEffect(() => {
    if (!ref.current || visible) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || !adsReady() || pushed.current) return;
    let cancelled = false;
    loadAdSenseScript(ADS_CONFIG.client)
      .then(() => {
        if (cancelled || !insRef.current) return;
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
          pushed.current = true;
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn("AdSense push failed", e);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visible]);

  if (!FEATURES.ads && !FEATURES.adsPreview) return null;

  const slot = ADS_CONFIG.slots[placement] || "";
  const wrapperClass = `ad-slot ad-slot--${placement} ${className}`.trim();

  if (FEATURES.adsPreview && (!FEATURES.ads || !adsReady())) {
    return (
      <div ref={ref} className={`${wrapperClass} ad-slot--preview`} style={style}>
        <span>Ad placeholder · {placement}</span>
      </div>
    );
  }

  if (!adsReady() || !slot) return null;

  return (
    <div ref={ref} className={wrapperClass} style={style}>
      {visible && (
        <ins
          ref={insRef}
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client={ADS_CONFIG.client}
          data-ad-slot={slot}
          data-ad-format={format}
          data-ad-layout={layout || undefined}
          data-full-width-responsive={responsive ? "true" : "false"}
        />
      )}
    </div>
  );
}

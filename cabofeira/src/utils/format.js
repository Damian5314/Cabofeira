// Locale is passed explicitly so changing language updates prices and dates.
export function formatPrice(amount, currency = "CVE", locale = "pt-CV") {
  if (amount === 0 || amount === "" || amount == null) return locale === "en" ? "Contact for price" : "Preço sob consulta";
  const num = Number(amount);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(locale) + " " + currency;
}

export function timeAgo(dateStr, locale = "pt-CV") {
  if (!dateStr) return "";
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (!Number.isFinite(seconds)) return "";
  if (seconds < 60) return locale === "en" ? "just now" : "agora mesmo";
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "always" });
  for (const [unit, size] of [["year",31536000],["month",2592000],["week",604800],["day",86400],["hour",3600],["minute",60]]) {
    if (seconds >= size) return relative.format(-Math.floor(seconds / size), unit);
  }
  return "";
}

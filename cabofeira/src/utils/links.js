export function safeRedirect(value) {
  if (typeof value !== "string" || !value.startsWith("/") || /^\/[/\\]/.test(value) || value.includes("\\") || [...value].some((c) => c.charCodeAt(0) < 32)) return "/";
  try {
    const url = new URL(value, "https://cabofeira.invalid");
    return url.origin === "https://cabofeira.invalid" ? url.pathname + url.search + url.hash : "/";
  } catch { return "/"; }
}

export function whatsappNumber(phone) {
  let digits = String(phone || "").replace(/[^0-9]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 7) digits = `238${digits}`;
  return /^[1-9][0-9]{7,14}$/.test(digits) ? digits : "";
}

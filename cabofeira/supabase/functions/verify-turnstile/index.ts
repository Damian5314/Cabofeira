// =====================================================================
// CaboFeira – verify-turnstile Edge Function (Deno).
//
// Server-side Cloudflare Turnstile siteverify for the AD-POSTING CAPTCHA
// (ABUSE-02 / D-02). Posting is NOT an auth endpoint, so its Turnstile token
// must be verified server-side before the product insert. (Signup CAPTCHA is
// handled natively inside Supabase Auth/GoTrue and does NOT use this function.)
//
// DEPLOYMENT: deployed via the Supabase CLI/dashboard, NOT the SQL editor.
//   supabase functions deploy verify-turnstile
//   supabase secrets set CLOUDFLARE_SECRET_KEY=...
// Edge Function availability for this project is verified in Plan 02-02 (Open Q1).
//
// SECRET HANDLING (Information Disclosure threat / Assumption A6): the secret
// is read ONLY from Deno.env.get("CLOUDFLARE_SECRET_KEY"). It MUST NOT use the
// CRA client-exposed env prefix and MUST NEVER appear in client code — only the public
// site key is ever exposed to the browser.
//
// ANTI-BOT, NOT AUTHZ (flag to Phase-4 SEC-09): this gate runs in the client
// call path, so a raw supabase-js insert bypasses it. The DB-enforced
// rate-limit trigger (product_post_log.sql) is the bypass-resistant backstop.
//
// Source: supabase.com/docs/guides/functions/examples/cloudflare-turnstile
// =====================================================================

// Minimal CORS so the browser invoke from PostAd works.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Preflight.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();
    const ip = req.headers.get("CF-Connecting-IP") ?? "";

    const form = new FormData();
    form.append("secret", Deno.env.get("CLOUDFLARE_SECRET_KEY") ?? "");
    form.append("response", token);
    if (ip) form.append("remoteip", ip);

    const r = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: form },
    );
    const outcome = await r.json();

    return new Response(
      JSON.stringify({ success: outcome.success === true }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: outcome.success === true ? 200 : 403,
      },
    );
  } catch (_err) {
    return new Response(
      JSON.stringify({ success: false }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      },
    );
  }
});

// Supabase Edge Function: create-checkout-session
// Body: { productId: string, locale?: "en" | "pt-cv" }
// Returns: { url: string }  (Stripe-hosted checkout URL)
//
// Authenticates the calling user via the Authorization: Bearer <jwt> header,
// looks up the (still unpaid) product, computes the cost from app_settings,
// and creates a Stripe Checkout Session in EUR (Cabo Verde Escudo is pegged
// 1 EUR = 110.265 CVE).

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CVE_PER_EUR = 110.265;
const cveToEurCents = (cve: number) =>
  Math.max(50, Math.round((cve / CVE_PER_EUR) * 100)); // Stripe min ≈ €0.50

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Caller-scoped client so we respect RLS (user can only see own unpaid ads).
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { productId, locale = "en", origin } = await req.json();
    if (!productId) {
      return new Response(JSON.stringify({ error: "Missing productId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the product (RLS scopes to seller's own row).
    const { data: product, error: pErr } = await supabase
      .from("products")
      .select("id, seller_id, category, featured, title, payment_status")
      .eq("id", productId)
      .single();

    if (pErr || !product) {
      return new Response(JSON.stringify({ error: "Product not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (product.seller_id !== user.id) {
      return new Response(JSON.stringify({ error: "Not your ad" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (product.payment_status !== "unpaid") {
      return new Response(
        JSON.stringify({ error: "Ad already paid for or free" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Compute cost server-side from app_settings (never trust client price).
    const { data: settings } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["posting_prices", "featured_price"]);

    let postingPrices: Record<string, number> = {};
    let featuredPrice = 0;
    for (const row of settings || []) {
      if (row.key === "posting_prices") postingPrices = row.value;
      if (row.key === "featured_price") featuredPrice = Number(row.value) || 0;
    }
    const postCost = Number(postingPrices[product.category] ?? 0);
    const totalCve =
      postCost + (product.featured ? Number(featuredPrice) : 0);

    if (totalCve <= 0) {
      // Free listing — mark as such and skip Stripe.
      await supabase
        .from("products")
        .update({ payment_status: "free", paid_at: new Date().toISOString() })
        .eq("id", product.id);
      return new Response(
        JSON.stringify({ url: `${origin}/product/${product.id}`, free: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const unitAmount = cveToEurCents(totalCve);
    const description =
      `${product.featured ? "★ Featured · " : ""}Posting fee (${totalCve} CVE ≈ €${(unitAmount / 100).toFixed(2)})`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: unitAmount,
            product_data: {
              name: `CaboFeira: ${product.title}`.slice(0, 250),
              description: description.slice(0, 500),
            },
          },
        },
      ],
      success_url: `${origin}/postad/success?session_id={CHECKOUT_SESSION_ID}&product_id=${product.id}`,
      cancel_url: `${origin}/postad/cancel?product_id=${product.id}`,
      locale: locale === "pt-cv" ? "pt" : "en",
      metadata: {
        product_id: product.id,
        seller_id: product.seller_id,
        cve_amount: String(totalCve),
        featured: String(product.featured),
      },
    });

    // Remember which session this product is tied to (for webhook reconciliation).
    await supabase
      .from("products")
      .update({ stripe_session_id: session.id })
      .eq("id", product.id);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

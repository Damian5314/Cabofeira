// Supabase Edge Function: stripe-webhook
// Stripe → POST  /stripe-webhook  with raw event body + signature header.
// On checkout.session.completed: flip the matching product to payment_status="paid".
//
// Uses the SERVICE_ROLE key so it can update products regardless of RLS.

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret
    );
  } catch (err) {
    return new Response(
      `Signature verification failed: ${(err as Error).message}`,
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const productId = session.metadata?.product_id;
    if (productId && session.payment_status === "paid") {
      const { error } = await admin
        .from("products")
        .update({
          payment_status: "paid",
          paid_at: new Date().toISOString(),
        })
        .eq("id", productId)
        .eq("stripe_session_id", session.id);
      if (error) {
        return new Response(`DB update failed: ${error.message}`, {
          status: 500,
        });
      }
    }
  }

  // Optional: handle checkout.session.expired to clean up unpaid stale ads.
  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    const productId = session.metadata?.product_id;
    if (productId) {
      // Just clear the session id so the user can retry; leave ad unpaid.
      await admin
        .from("products")
        .update({ stripe_session_id: null })
        .eq("id", productId)
        .eq("stripe_session_id", session.id);
    }
  }

  return new Response("ok", { status: 200 });
});

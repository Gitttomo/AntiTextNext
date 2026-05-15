import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");

  if (!stripeSecretKey || !webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook is not configured" }, { status: 500 });
  }

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  const stripe = new Stripe(stripeSecretKey);
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { data: isNewEvent, error: recordError } = await (supabase as any).rpc(
    "record_stripe_webhook_event",
    {
      target_event_id: event.id,
      target_event_type: event.type,
    }
  );

  if (recordError) {
    console.error("Failed to record Stripe webhook event:", recordError);
    return NextResponse.json({ error: "Webhook event record failed" }, { status: 500 });
  }

  if (!isNewEvent) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
      case "payment_intent.payment_failed":
      case "checkout.session.completed":
      case "charge.refunded":
      case "account.updated":
        // Stripe本実装時に、DB上の取引・返金・Connect状態をここで更新する。
        break;
      default:
        break;
    }

    await (supabase as any).rpc("mark_stripe_webhook_event_processed", {
      target_event_id: event.id,
      target_processing_error: null,
    });
  } catch (error: any) {
    await (supabase as any).rpc("mark_stripe_webhook_event_processed", {
      target_event_id: event.id,
      target_processing_error: error?.message || "unknown webhook processing error",
    });
    throw error;
  }

  return NextResponse.json({ received: true });
}

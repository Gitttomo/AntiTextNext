import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

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

  return NextResponse.json({ received: true });
}

import { NextRequest, NextResponse } from "next/server";
import { CHARITY } from "@/lib/charity";
import { PRICE_CENTS, PRICE_CURRENCY } from "@/lib/pricing";
import { getAppOrigin, getStripe } from "@/lib/stripe";

type CheckoutBody = {
  name?: string;
  team?: string;
  cardStyle?: string;
  shine?: string;
  finish?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CheckoutBody;
    const name = (body.name || "Player").trim().slice(0, 80);
    const team = (body.team || "Brazil").trim().slice(0, 60);
    const cardStyle = (body.cardStyle || "prizm").trim().slice(0, 40);
    const shine = (body.shine || "rainbow").trim().slice(0, 40);
    const finish = (body.finish || "gloss").trim().slice(0, 40);

    const stripe = getStripe();
    const origin = getAppOrigin(request.headers.get("origin"));

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: PRICE_CURRENCY,
            unit_amount: PRICE_CENTS,
            product_data: {
              name: "World Cup 2026 Holo Card",
              description: `Digital holo video — ${name} · ${team}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: { name, team, cardStyle, shine, finish },
      success_url: `${origin}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled`,
      payment_intent_data: {
        description: `Holo card — ${name} · ${team}. ${CHARITY.checkoutSub}`,
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "Could not create checkout session." }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Endpoint to create a Stripe checkout session
router.post("/create-checkout-session", async (req, res) => {
  const { priceId } = req.body;

  if (!priceId) {
    return res.status(400).json({ error: "Price ID is required" });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${process.env.FRONTEND_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/subscription`,
    });

    res.json({ sessionId: session.id });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// Endpoint to handle webhook events from Stripe
// router.post(
//   "/webhook",
//   express.raw({ type: "application/json" }),
//   async (req, res) => {
//     const sig = req.headers["stripe-signature"];

//     let event;

//     try {
//       event = stripe.webhooks.constructEvent(
//         req.body,
//         sig,
//         process.env.STRIPE_WEBHOOK_SECRET
//       );
//     } catch (err) {
//       console.error("Webhook Error:", err.message);
//       return res.status(400).send(`Webhook Error: ${err.message}`);
//     }

//     // Handle the event
//     switch (event.type) {
//       case "checkout.session.completed":
//         const session = event.data.object;
//         // Here you can fulfill the subscription by associating
//         // the Stripe subscription ID with the user in your database
//         await fulfillSubscription(session);
//         break;
//       case "customer.subscription.updated":
//       case "customer.subscription.deleted":
//         const subscription = event.data.object;
//         // Handle subscription updates or cancellations
//         await updateSubscription(subscription);
//         break;
//       // ... handle other event types
//       default:
//         console.log(`Unhandled event type ${event.type}`);
//     }

//     res.json({ received: true });
//   }
// );

async function fulfillSubscription(session) {
  // Implement the logic to associate the subscription with the user
  // This might involve updating your user database
  console.log("Fulfilling subscription for session:", session.id);
}

async function updateSubscription(subscription) {
  // Implement the logic to update the subscription status in your database
  console.log("Updating subscription:", subscription.id);
}

module.exports = router;

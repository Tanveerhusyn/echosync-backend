const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const User = require("../models/user"); // Adjust the path as needed

// Endpoint to create a Stripe checkout session
router.post("/create-checkout-session", express.json(), async (req, res) => {
  const { priceId } = req.body;

  if (!priceId) {
    return res.status(400).json({ error: "Price ID is required" });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/subscription`,
    });

    res.json({ sessionId: session.id });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

const endpointSecret = "whsec_bYeI8KRxPUt9BileuAWl9Fk802PFZhXd";
// "whsec_21bbad6871b325381a6b6e6b9ad6c57d798fb06efad28067795983c7177302ae";

router.post(
  "/webhook",
  express.raw({ type: "application/json" }), // This middleware must be applied to the webhook route
  (request, response) => {
    const sig = request.headers["stripe-signature"];

    let event;

    try {
      event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return response.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    handleWebhookEvent(event)
      .then(() => {
        // Return a 200 response to acknowledge receipt of the event
        response.status(200).send();
      })
      .catch((err) => {
        console.error("Error handling webhook event:", err);
        response.status(500).send();
      });
  }
);

async function handleWebhookEvent(event) {
  console.log("EVENT", event);
  switch (event.type) {
    case "checkout.session.completed":
      const session = event.data.object;
      if (session.mode === "subscription") {
        await handleSubscriptionCreated(session);
      }
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionCancelled(event.data.object);
      break;
    case "invoice.payment_succeeded":
      await handleInvoicePaid(event.data.object);
      break;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event.data.object);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }
}

async function handleSubscriptionCreated(session) {
  const customerId = session.customer;
  const subscriptionId = session.subscription;

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const user = await User.findOne({ email: session.customer_details.email });

    if (!user) {
      console.error(
        "User not found for email:",
        session.customer_details.email
      );
      return;
    }

    user.subscription = {
      stripeCustomerId: customerId,
      subscriptionId: subscriptionId,
      subscriptionStatus: subscription.status,
      subscriptionPlan: subscription.items.data[0].price.id,
      subscriptionCurrentPeriodEnd: new Date(
        subscription.current_period_end * 1000
      ),
    };

    await user.save();

    console.log("Subscription created for user:", user.email);
    // Here you could also trigger a welcome email or other onboarding processes
  } catch (error) {
    console.error("Error handling subscription created:", error);
  }
}

async function handleSubscriptionUpdated(subscription) {
  try {
    const user = await User.findOne({
      "subscription.subscriptionId": subscription.id,
    });

    if (!user) {
      console.error("User not found for subscription:", subscription.id);
      return;
    }

    user.subscription.subscriptionStatus = subscription.status;
    user.subscription.subscriptionPlan = subscription.items.data[0].price.id;
    user.subscription.subscriptionCurrentPeriodEnd = new Date(
      subscription.current_period_end * 1000
    );

    await user.save();

    console.log("Subscription updated for user:", user.email);
    // Here you could trigger an email notifying the user of the change
  } catch (error) {
    console.error("Error handling subscription update:", error);
  }
}

async function handleSubscriptionCancelled(subscription) {
  try {
    const user = await User.findOne({
      "subscription.subscriptionId": subscription.id,
    });

    if (!user) {
      console.error("User not found for subscription:", subscription.id);
      return;
    }

    user.subscription.subscriptionStatus = "canceled";
    user.subscription.subscriptionCurrentPeriodEnd = new Date(
      subscription.current_period_end * 1000
    );

    await user.save();

    console.log("Subscription cancelled for user:", user.email);
    // Here you could trigger a cancellation email or offboarding process
  } catch (error) {
    console.error("Error handling subscription cancellation:", error);
  }
}

async function handleInvoicePaid(invoice) {
  try {
    const user = await User.findOne({
      "subscription.stripeCustomerId": invoice.customer,
    });

    if (!user) {
      console.error("User not found for customer:", invoice.customer);
      return;
    }

    // Update the subscription end date
    const subscription = await stripe.subscriptions.retrieve(
      invoice.subscription
    );
    user.subscription.subscriptionCurrentPeriodEnd = new Date(
      subscription.current_period_end * 1000
    );

    await user.save();

    console.log("Invoice paid for user:", user.email);
    // Here you could send a receipt or thank you email
  } catch (error) {
    console.error("Error handling invoice payment:", error);
  }
}

async function handleInvoicePaymentFailed(invoice) {
  try {
    const user = await User.findOne({
      "subscription.stripeCustomerId": invoice.customer,
    });

    if (!user) {
      console.error("User not found for customer:", invoice.customer);
      return;
    }

    // Update the subscription status
    user.subscription.subscriptionStatus = "past_due";

    await user.save();

    console.log("Invoice payment failed for user:", user.email);
    // Here you should send an email to the user about the failed payment
    // You might also want to implement a retry strategy or grace period
  } catch (error) {
    console.error("Error handling invoice payment failure:", error);
  }
}

module.exports = router;

const express = require("express");
const router = express.Router();
const ContactCampaign = require("../models/contactCompaign");
const DripCampaign = require("../models/dripCampaign");
const Contact = require("../models/contact");
const twilioConfig = require("../config/twilio");
const { parseTemplate } = require("../utils/messageParser");
// Add this line to import a URL shortener function (you'll need to implement this)
const { shortenUrl } = require("../utils/urlShortener");

// Create a single contact campaign
router.post("/create-contact-campaign", async (req, res) => {
  try {
    const { contactId, campaignId } = req.body;

    const contact = await Contact.findById(contactId);
    const campaign = await DripCampaign.findById(campaignId);

    if (!contact || !campaign) {
      return res.status(404).json({ message: "Contact or Campaign not found" });
    }

    const contactCampaign = new ContactCampaign({
      contact: contactId,
      campaign: campaignId,
    });

    await contactCampaign.save();

    // Send the first message of the campaign
    const firstMessage = campaign.messages.filter(
      (ele) => ele.type === "sms"
    )[0];
    if (firstMessage) {
      let parsedMessage = parseTemplate(firstMessage.content, contact);

      // If the message contains a link placeholder, replace it with a shortened URL
      if (firstMessage.link) {
        parsedMessage = parsedMessage.replace("{{link}}", firstMessage.link);
      }

      await sendTwilioMessage(contact.phone, parsedMessage);

      contactCampaign.messagesSent.push({
        messageId: firstMessage._id,
        sentAt: new Date(),
      });
      contactCampaign.lastSentDate = new Date();
      contactCampaign.status = "sent";
      await contactCampaign.save();
    }

    res.status(201).json(contactCampaign);
  } catch (error) {
    res.status(500).json({
      message: "Error creating contact campaign",
      error: error.message,
    });
  }
});

// Get all contact campaigns
router.get("/all-contact-campaigns", async (req, res) => {
  try {
    const contactCampaigns = await ContactCampaign.find()
      .populate("contact")
      .populate("campaign");
    res.json(contactCampaigns);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get a specific contact campaign
router.get("/contact-campaign-by-id/:id", async (req, res) => {
  try {
    const contactCampaign = await ContactCampaign.findById(req.params.id)
      .populate("contact")
      .populate("campaign");
    if (!contactCampaign) {
      return res.status(404).json({ message: "Contact campaign not found" });
    }
    res.json(contactCampaign);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update a contact campaign
router.patch("/update-contact-campaign/:id", async (req, res) => {
  try {
    const contactCampaign = await ContactCampaign.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!contactCampaign) {
      return res.status(404).json({ message: "Contact campaign not found" });
    }
    res.json(contactCampaign);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete a contact campaign
router.delete("/delete-contact-campaign/:id", async (req, res) => {
  try {
    const contactCampaign = await ContactCampaign.findByIdAndDelete(
      req.params.id
    );
    if (!contactCampaign) {
      return res.status(404).json({ message: "Contact campaign not found" });
    }
    res.json({ message: "Contact campaign deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Bulk create contact campaigns
router.post("/bulk-create-contact-campaigns", async (req, res) => {
  try {
    const { contactIds, campaignId } = req.body;

    const campaign = await DripCampaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    const createdCampaigns = [];

    for (const contactId of contactIds) {
      const contact = await Contact.findById(contactId);
      if (contact) {
        const contactCampaign = new ContactCampaign({
          contact: contactId,
          campaign: campaignId,
        });

        await contactCampaign.save();

        // Send the first message of the campaign
        const firstMessage = campaign.messages[0];
        if (firstMessage) {
          const parsedMessage = parseTemplate(firstMessage.content, contact);
          await sendTwilioMessage(contact.phoneNumber, parsedMessage);

          contactCampaign.messagesSent.push({
            messageId: firstMessage._id,
            sentAt: new Date(),
          });
          contactCampaign.lastSentDate = new Date();
          contactCampaign.status = "sent";
          await contactCampaign.save();
        }

        createdCampaigns.push(contactCampaign);
      }
    }

    res.status(201).json(createdCampaigns);
  } catch (error) {
    res.status(500).json({
      message: "Error bulk creating contact campaigns",
      error: error.message,
    });
  }
});

// Helper function to send Twilio message
async function sendTwilioMessage(to, body) {
  try {
    await twilioConfig.client.messages.create({
      body: body,
      to: to,
      shortenUrls: true,
      from: twilioConfig.phoneNumber,
    });
  } catch (error) {
    console.error("Error sending Twilio message:", error);
    throw error;
  }
}

module.exports = router;

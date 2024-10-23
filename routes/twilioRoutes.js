const express = require("express");
const router = express.Router();
const twilioConfig = require("../config/twilio");
const nodemailer = require("nodemailer");
const DripCampaign = require("../models/dripCampaign");
const Contact = require("../models/contact");

// Initialize Nodemailer transporter (configure with your email service)
const transporter = nodemailer.createTransport({
  // Configure your email service here
  // Example for Gmail:
  // service: 'gmail',
  // auth: {
  //   user: process.env.EMAIL_USER,
  //   pass: process.env.EMAIL_PASS
  // }
});

// Send SMS
router.post("/send-sms", async (req, res) => {
  const { to, body } = req.body;
  try {
    const message = await twilioConfig.client.messages.create({
      body: body,
      from: twilioConfig.phoneNumber,
      to: to,
    });
    res
      .status(200)
      .json({ message: "SMS sent successfully", sid: message.sid });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to send SMS", error: error.message });
  }
});

// Send Email
router.post("/send-email", async (req, res) => {
  const { to, subject, text } = req.body;
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: to,
      subject: subject,
      text: text,
    });
    res
      .status(200)
      .json({ message: "Email sent successfully", messageId: info.messageId });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to send email", error: error.message });
  }
});

// Trigger a drip campaign
router.post("/trigger-campaign", async (req, res) => {
  const { campaignId, contactId } = req.body;
  try {
    const campaign = await DripCampaign.findById(campaignId);
    const contact = await Contact.findById(contactId);

    if (!campaign || !contact) {
      return res.status(404).json({ message: "Campaign or contact not found" });
    }

    // Logic to schedule and send messages based on campaign settings
    campaign.messages.forEach((message, index) => {
      setTimeout(async () => {
        if (message.type === "sms") {
          await twilioConfig.client.messages.create({
            body: message.content,
            from: twilioConfig.phoneNumber,
            to: contact.phone,
          });
        } else if (message.type === "email") {
          await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: contact.email,
            subject: message.subject,
            text: message.content,
          });
        }
      }, message.delay * 3600000); // Convert hours to milliseconds
    });

    res.status(200).json({ message: "Drip campaign triggered successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to trigger campaign", error: error.message });
  }
});

module.exports = router;

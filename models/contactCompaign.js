const mongoose = require("mongoose");

const contactCampaignSchema = new mongoose.Schema({
  contact: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Contact",
    required: true,
  },
  campaign: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "DripCampaign",
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "sent", "responded", "completed"],
    default: "pending",
  },
  lastSentDate: Date,
  nextFollowUpDate: Date,
  messagesSent: [
    {
      messageId: mongoose.Schema.Types.ObjectId, // Reference to the message in the campaign
      sentAt: Date,
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Automatically set updatedAt on save
contactCampaignSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const ContactCampaign = mongoose.model(
  "ContactCampaign",
  contactCampaignSchema
);

module.exports = ContactCampaign;

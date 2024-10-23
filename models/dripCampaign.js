const mongoose = require("mongoose");

// Function to replace placeholders like {{name}} in the content
const parseMessageContent = (content, data) => {
  return content.replace(/{{\s*name\s*}}/g, data.name);
};

const messageSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["sms", "email"],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  link: {
    type: String,
  },
  subject: {
    type: String,
    required: function () {
      return this.type === "email";
    },
  },
  delay: {
    type: Number,
    default: 0,
    min: 0,
  },
});

const dripCampaignSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  trigger: {
    type: String,
    required: true,
    enum: ["signup", "purchase", "custom"],
  },
  messages: [messageSchema],
  followUpCondition: {
    type: String,
    enum: ["no_open", "no_click", "no_response"],
    default: "no_open",
  },
  followUpTime: {
    type: Date,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Pre-save hook to update the timestamp
dripCampaignSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Method to parse placeholders in message content
dripCampaignSchema.methods.parseMessages = function (customerData) {
  this.messages.forEach((message) => {
    message.content = parseMessageContent(message.content, customerData);
  });
};

// Example function to create and parse a campaign
dripCampaignSchema.methods.createCampaignForCustomer = function (customerData) {
  // Parse all message contents for the given customer data
  this.parseMessages(customerData);

  // Now `this.messages` will have parsed content with real customer data
  return this;
};

const DripCampaign = mongoose.model("DripCampaign", dripCampaignSchema);

module.exports = DripCampaign;

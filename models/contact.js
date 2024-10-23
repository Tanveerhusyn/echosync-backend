const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  phone: {
    type: String,
    trim: true,
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
  },

  type: {
    type: String,
    enum: ["zapier", "manual"],
    default: "manual",
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

// Update the 'updatedAt' field on save
contactSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Method to update review request status and set next follow-up date
contactSchema.methods.updateReviewRequestStatus = function (status) {
  this.reviewRequest.status = status;
  this.reviewRequest.lastRequestDate = new Date();

  if (status !== "responded" && status !== "completed") {
    this.reviewRequest.nextFollowUpDate = new Date(
      Date.now() + this.reviewRequest.followUpInterval * 24 * 60 * 60 * 1000
    );
  } else {
    this.reviewRequest.nextFollowUpDate = null;
  }
};

const Contact = mongoose.model("Contact", contactSchema);

module.exports = Contact;

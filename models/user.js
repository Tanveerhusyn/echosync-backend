const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema({
  stripeCustomerId: { type: String, required: true },
  subscriptionId: { type: String, required: true },
  subscriptionStatus: { type: String, required: true },
  subscriptionPlan: { type: String, required: true },
  subscriptionPlanName: { type: String, required: true }, // New field for plan name
  subscriptionCurrentPeriodEnd: { type: Date, required: true },
});
const userSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
    },
    phoneNumber: {
      type: String,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: function () {
        return !this.isGoogleUser;
      },
    },
    aboutCompany: {
      type: String,
    },
    agreeToPolicy: {
      type: Boolean,
      required: false,
    },
    googleBusinessProfile: {
      connected: {
        type: Boolean,
        default: false,
      },
      accessToken: String,
      refreshToken: String,
      expiryDate: Date,
    },
    subscription: subscriptionSchema,
    isGoogleUser: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

module.exports = User;

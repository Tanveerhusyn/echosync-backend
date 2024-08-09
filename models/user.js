const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
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
      required: true,
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
    isGoogleUser: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

module.exports = User;

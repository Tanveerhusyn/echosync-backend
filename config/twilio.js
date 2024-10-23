const twilio = require("twilio");

// Load environment variables
require("dotenv").config();

// Twilio credentials
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

let client = null;

// Initialize Twilio client
if (accountSid && authToken) {
  try {
    client = twilio(accountSid, authToken);
    console.log("Twilio client initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Twilio client:", error.message);
  }
} else {
  console.warn(
    "Twilio credentials are missing. SMS functionality will be disabled."
  );
}

const twilioConfig = {
  client,
  phoneNumber,
  accountSid,
  authToken,
  isConfigured: !!client,
};

module.exports = twilioConfig;

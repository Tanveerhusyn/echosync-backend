require("dotenv").config();
var express = require("express");
var router = express.Router();
const axios = require("axios");
const OpenAI = require("openai");
const { google } = require("googleapis");
const User = require("../models/user"); // Adjust the path as needed
const querystring = require("querystring");

const openai = new OpenAI({
  organization: process.env.OPENAI_ORG_ID,
  project: process.env.OPENAI_PROJECT_ID,
  apiKey: process.env.OPENAI_API_KEY,
});

const { OAuth2Client } = require("google-auth-library");

// Set up OAuth 2.0 client
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `https://admin.echosync.ai/onboarding` // Adjust this URL as needed
);

const usedCodes = new Set();

// Endpoint to initiate Google Business Profile connection
router.get("/connect-google-business", (req, res) => {
  const scopes = ["https://www.googleapis.com/auth/business.manage"];

  const authorizationUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
  });
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");

  res.json({ authorizationUrl });
});

function formatUnusualDate(unusualDateString) {
  console.log("Unusual date string:", unusualDateString);
  // Regular expression to match the unusual date format
  const dateRegex =
    /^\+?(\d{1,6})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/;

  const match = unusualDateString.match(dateRegex);

  if (!match) {
    throw new Error("Invalid date format");
  }

  const [, yearStr, month, day, hours, minutes, seconds, milliseconds] = match;

  // Convert year to a number and handle potential overflow
  let year = parseInt(yearStr, 10);
  if (year > 9999) {
    console.warn("Year exceeds 9999, setting to 9999");
    year = 9999;
  }

  // Construct a new Date object
  const date = new Date(
    Date.UTC(
      year,
      parseInt(month, 10) - 1,
      parseInt(day, 10),
      parseInt(hours, 10),
      parseInt(minutes, 10),
      parseInt(seconds, 10),
      parseInt(milliseconds, 10)
    )
  );

  // Format the date as ISO 8601
  return date.toISOString();
}
// Callback endpoint for Google Business Profile OAuth
router.post("/google-business-callback", async (req, res) => {
  const { code, email } = req.body;

  if (!code || !email) {
    console.error("Missing required parameters");
    return res.status(400).json({ error: "Missing required parameters" });
  }

  console.log(`Received Google Business Profile callback for email: ${email}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  // Check if code has been used
  if (usedCodes.has(code)) {
    console.error(`Authorization code has already been used: ${code}`);
    return res
      .status(400)
      .json({ error: "Authorization code has already been used" });
  }

  usedCodes.add(code);

  try {
    const tokenRequestBody = {
      code: code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: "https://admin.echosync.ai/onboarding",
      grant_type: "authorization_code",
    };

    console.log("Sending token request to Google");
    console.log("Request body:", JSON.stringify(tokenRequestBody, null, 2));

    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      querystring.stringify(tokenRequestBody),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const tokens = tokenResponse.data;
    console.log("Successfully obtained tokens from Google");
    console.log("Token response:", JSON.stringify(tokens, null, 2));

    const expiryDate = new Date(
      Date.now() + (tokens.expires_in || 3600) * 1000
    );

    const updatedUser = await User.findOneAndUpdate(
      { email: email },
      {
        "googleBusinessProfile.connected": true,
        "googleBusinessProfile.accessToken": tokens.access_token,
        "googleBusinessProfile.refreshToken": tokens.refresh_token,
        "googleBusinessProfile.expiryDate": expiryDate,
      },
      { new: true }
    );

    if (!updatedUser) {
      console.error(`User not found for email: ${email}`);
      return res.status(404).json({ error: "User not found" });
    }

    console.log(
      `Successfully updated user ${email} with Google Business Profile connection`
    );
    res
      .status(200)
      .json({ message: "Successfully connected Google Business Profile" });
  } catch (error) {
    console.error("Error during Google Business Profile callback:");
    console.error("Error message:", error.message);
    console.error("Error response data:", error.response?.data);
    console.error("Error response status:", error.response?.status);

    if (error.response?.data?.error === "invalid_grant") {
      return res.status(400).json({
        error:
          "Invalid or expired authorization code. Please try connecting again.",
        details: error.response.data,
      });
    }

    res.status(500).json({
      error: "Failed to connect Google Business Profile. Please try again.",
      details: error.response?.data || error.message,
    });
  } finally {
    // Remove the code from usedCodes after a delay
    setTimeout(() => {
      usedCodes.delete(code);
    }, 5 * 60 * 1000); // 5 minutes
  }
});
// Middleware to check and refresh Google Business Profile tokens
async function refreshGoogleTokenIfNeeded(req, res, next) {
  const { user } = req; // Assume you have middleware to attach the user to the request

  if (user.googleBusinessProfile.connected) {
    const currentTime = new Date();
    if (currentTime >= user.googleBusinessProfile.expiryDate) {
      try {
        oauth2Client.setCredentials({
          refresh_token: user.googleBusinessProfile.refreshToken,
        });

        const { credentials } = await oauth2Client.refreshAccessToken();
        const newExpiryDate = new Date(
          Date.now() + credentials.expiry_date * 1000
        );

        await User.findByIdAndUpdate(user._id, {
          "googleBusinessProfile.accessToken": credentials.access_token,
          "googleBusinessProfile.expiryDate": newExpiryDate,
        });

        // Update the user object in the request with the new token
        user.googleBusinessProfile.accessToken = credentials.access_token;
        user.googleBusinessProfile.expiryDate = newExpiryDate;
      } catch (error) {
        console.error("Error refreshing Google token:", error);
        return res
          .status(500)
          .json({ error: "Failed to refresh Google token" });
      }
    }
  }

  next();
}

router.post("/generate-insights", async function (req, res, next) {
  try {
    const { user_review } = req.body;

    const insightPrompt = `Analyze the following review and provide 3 key insights. Format each insight as: • [Emoji] [Insight]

Use these emojis:
- For positive sentiments: 😊
- For neutral observations: 📊
- For suggestions or areas of improvement: 💡

Review: ${user_review}`;

    const insightCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: insightPrompt }],
      temperature: 0.7,
      max_tokens: 200,
    });

    const insights = insightCompletion.choices[0].message.content
      .split("\n")
      .filter((line) => line.trim().startsWith("•"))
      .map((line) => {
        const [emoji, ...rest] = line.split(" ");
        const text = rest.join(" ").trim();
        return { emoji, text };
      });

    res.json({ insights });
  } catch (error) {
    console.error("Error generating insights:", error);
    res
      .status(500)
      .json({ error: "Failed to generate insights", details: error.message });
  }
});

// Response generation endpoint
router.post("/generate-response", async function (req, res, next) {
  try {
    const {
      business_name,
      business_context,
      user_review,
      insights,
      reviewer_name,
    } = req.body;

    // Construct the prompt using provided or generated insights
    const insightsText = insights
      ? insights.map((insight) => `${insight.emoji} ${insight.text}`).join("\n")
      : "";

    const responsePrompt = `As the owner of ${business_name}, craft a brief, friendly response to this Google Business review. Follow these guidelines:

1. Keep it short - aim for 2-3 sentences max.
2. Use a casual, conversational tone as if speaking directly to the customer.
3. Personalize the response by mentioning a specific point from their review.
4. For positive reviews, express genuine appreciation.
5. For negative reviews, apologize sincerely and offer to address concerns offline.
6. Avoid overly formal language or lengthy explanations.
7. Use the customer's name if available: ${reviewer_name}.
8. End with a simple, warm closing like "Thanks!" or "Cheers!" followed by "- ${business_name} Team".
9. Avoid using emojis.
10. Do not include placeholders like [Your Name] or [Business Owner].

Business Context: ${business_context}

Customer Review: "${user_review}"

${insights ? `Key Insights:\n${insights.map((i) => i.text).join("\n")}` : ""}

Based on this, write a response as the business owner:`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: responsePrompt },
        { role: "user", content: "Generate a response to the review." },
      ],
      temperature: 0.7,
      max_tokens: 250,
    });

    res.json({
      response: completion.choices[0].message.content,
    });
  } catch (error) {
    console.error("Error generating response:", error);
    res
      .status(500)
      .json({ error: "Failed to generate response", details: error.message });
  }
});

router.post("/generate-manual", async function (req, res, next) {
  try {
    const { user_review } = req.body;

    const responsePrompt = `As the owner of a business, write friendly response to this Google Business review. Follow these guidelines:

1. Keep it short - aim for 2-3 sentences max.
2. Use a casual, conversational tone as if speaking directly to the customer.
3. Personalize the response by mentioning a specific point from their review.
4. For positive reviews, express genuine appreciation.
5. For negative reviews, apologize sincerely and offer to address concerns offline.
6. Avoid overly formal language or lengthy explanations.
7. End with a simple, warm closing like "Thanks!" or "Cheers!".
9. Avoid using emojis.
10. Do not include placeholders like [Your Name] or [Business Owner].



Customer Review: "${user_review}"

 
Based on this, write a response as the business owner:`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: responsePrompt },
        { role: "user", content: "Generate a response to the review." },
      ],
      temperature: 0.7,
      max_tokens: 250,
    });

    res.json({
      response: completion.choices[0].message.content,
    });
  } catch (error) {
    console.error("Error generating response:", error);
    res
      .status(500)
      .json({ error: "Failed to generate response", details: error.message });
  }
});

async function getAccountAndLocation(auth) {
  const mybusinessaccountmanagement = google.mybusinessaccountmanagement({
    version: "v1",
    auth,
  });
  const mybusinessbusinessinformation = google.mybusinessbusinessinformation({
    version: "v1",
    auth,
  });

  try {
    console.log("Attempting to list accounts...");
    const accountsResponse = await mybusinessaccountmanagement.accounts.list();
    console.log(
      "Accounts response:",
      JSON.stringify(accountsResponse.data, null, 2)
    );

    if (
      !accountsResponse.data.accounts ||
      accountsResponse.data.accounts.length === 0
    ) {
      throw new Error("No accounts found");
    }

    const account = accountsResponse.data.accounts[0];
    const accountName = account.name;

    if (account.type === "PERSONAL") {
      console.log(
        "Personal account detected. Personal accounts are not supported."
      );
      throw new Error("Personal accounts are not supported in this version.");
    }

    console.log(`Attempting to list locations for account: ${accountName}`);
    const locationsResponse =
      await mybusinessbusinessinformation.accounts.locations.list({
        parent: accountName,
        readMask: "name,title,profile,serviceArea	",
      });
    console.log("Locations response:", JSON.stringify(locationsResponse.data));

    if (
      !locationsResponse.data.locations ||
      locationsResponse.data.locations.length === 0
    ) {
      throw new Error("No locations found");
    }

    const locationName = locationsResponse.data.locations[0].name;

    return { accountName, locationName };
  } catch (error) {
    console.error("Error in getAccountAndLocation:", error);
    if (error.response) {
      console.error(
        "Error response:",
        JSON.stringify(error.response.data, null, 2)
      );
    }
    if (error.config) {
      console.error("Request config:", JSON.stringify(error.config, null, 2));
    }
    throw error;
  }
}

router.post("/allreviews", async (req, res) => {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ["https://www.googleapis.com/auth/business.manage"],
    });

    const authClient = await auth.getClient();

    // Dynamically get account and location
    const { accountName, locationName } = await getAccountAndLocation(
      authClient
    );

    // Use the mybusinessreviews API to fetch reviews
    const mybusinessreviews = google.mybusinessreviews({
      version: "v1",
      auth: authClient,
    });
    const response = await mybusinessreviews.accounts.locations.reviews.list({
      parent: locationName,
    });

    res.json({
      accountName,
      locationName,
      reviews: response.data,
    });
  } catch (error) {
    console.error("Error:", error);
    if (error.response) {
      console.error(
        "Error response:",
        JSON.stringify(error.response.data, null, 2)
      );
    }
    res.status(500).json({ error: error.message });
  }
});

const ACCOUNT_MANAGEMENT_API =
  "https://mybusinessaccountmanagement.googleapis.com/v1";
const BUSINESS_INFORMATION_API =
  "https://mybusinessbusinessinformation.googleapis.com/v1";
const MY_BUSINESS_API = "https://mybusiness.googleapis.com/v4";

async function getAccountTest(accessToken) {
  try {
    const response = await axios.get(`${ACCOUNT_MANAGEMENT_API}/accounts`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { pageSize: 10 },
    });
    console.log("Accounts response:", JSON.stringify(response.data, null, 2));
    if (response.data.accounts && response.data.accounts.length > 0) {
      return response.data.accounts[0].name;
    }
    throw new Error("No accounts found");
  } catch (error) {
    console.error(
      "Error fetching Account:",
      error.response ? error.response.data : error.message
    );
    return error.response;
  }
}
async function getAccountId(accessToken) {
  try {
    const response = await axios.get(`${ACCOUNT_MANAGEMENT_API}/accounts`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { pageSize: 10 },
    });
    console.log("Accounts response:", JSON.stringify(response.data, null, 2));
    if (response.data.accounts && response.data.accounts.length > 0) {
      return response.data.accounts[0].name;
    }
    throw new Error("No accounts found");
  } catch (error) {
    console.error(
      "Error fetching Account:",
      error.response ? error.response.data : error.message
    );
    throw error;
  }
}

async function getLocations(accessToken, accountName) {
  try {
    const response = await axios.get(
      `${BUSINESS_INFORMATION_API}/${accountName}/locations`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },

        params: {
          pageSize: 10,
          readMask: "name,title,storeCode,profile",
        },
      }
    );
    console.log("Locations response:", JSON.stringify(response.data, null, 2));
    return response.data.locations || [];
  } catch (error) {
    console.error(
      "Error fetching locations:",
      error.response ? error.response.data : error.message
    );
    throw error;
  }
}

async function getReviews(accessToken, parent) {
  try {
    const response = await axios.get(`${MY_BUSINESS_API}/${parent}/reviews`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      params: {
        pageSize: 50,
        orderBy: "updateTime desc",
      },
    });
    console.log(
      `Reviews response for ${parent}:`,
      JSON.stringify(response.data, null, 2)
    );
    return response.data;
  } catch (error) {
    console.error(
      `Error fetching reviews for ${parent}:`,
      error.response ? error.response.data : error.message
    );
    return null;
  }
}

function parseUnusualDate(dateInput) {
  if (dateInput instanceof Date) {
    return dateInput;
  }

  const dateString = String(dateInput).replace(/^\+/, "");
  const [datePart, timePart] = dateString.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes, seconds] = timePart.split(":").map(Number);
  const milliseconds = Number(seconds.toString().split(".")[1] || 0);

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      hours,
      minutes,
      Math.floor(seconds),
      milliseconds
    )
  );
}

function formatDate(date) {
  return date.toISOString();
}
function parseUnusualDate(dateInput) {
  // Convert input to string if it's not already
  const dateString = String(dateInput);

  console.log("Parsing date string:", dateString);

  // Check if the date is in the unusual format
  if (dateString.startsWith("+")) {
    // Extract year, month, day, hour, minute, second
    const match = dateString.match(
      /\+(\d+)-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/
    );
    if (match) {
      const [, year, month, day, hour, minute, second] = match;
      // JavaScript can't handle years beyond 275,760, so we'll cap it
      const cappedYear = Math.min(parseInt(year), 275760);
      return new Date(
        Date.UTC(cappedYear, month - 1, day, hour, minute, second)
      );
    }
  }

  // If it's not in the unusual format, try parsing it as a regular date
  const parsedDate = new Date(dateString);
  if (isNaN(parsedDate.getTime())) {
    console.error("Invalid date format:", dateString);
    return null;
  }
  return parsedDate;
}

function isTokenExpired(expiryDate, currentTime = new Date()) {
  const parsedExpiryDate = parseUnusualDate(expiryDate);
  console.log("Parsed expiry date:", parsedExpiryDate);
  console.log("Current time:", currentTime);

  if (!parsedExpiryDate || isNaN(parsedExpiryDate.getTime())) {
    console.error("Failed to parse expiry date:", expiryDate);
    return true; // Assume expired if we can't parse the date
  }

  return currentTime >= parsedExpiryDate;
}

async function refreshGoogleToken(user) {
  try {
    oauth2Client.setCredentials({
      refresh_token: user.googleBusinessProfile.refreshToken,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();
    const newExpiryDate = new Date(Date.now() + credentials.expiry_date * 1000);

    // Update user in the database
    await User.findByIdAndUpdate(user._id, {
      "googleBusinessProfile.accessToken": credentials.access_token,
      "googleBusinessProfile.expiryDate": newExpiryDate,
    });

    return {
      accessToken: credentials.access_token,
      expiryDate: newExpiryDate,
    };
  } catch (error) {
    console.error("Error refreshing Google token:", error);
    throw new Error("Failed to refresh Google token");
  }
}

async function getValidAccessToken(user) {
  const getTestAccount = await getAccountTest(
    user.googleBusinessProfile.accessToken
  );
  console.log("Test account response:", getTestAccount);
  if (getTestAccount.status === 401) {
    console.log("Token expired, refreshing...");
    const refreshedCredentials = await refreshGoogleToken(user);
    console.log(
      "Token refreshed. New expiry:",
      formatDate(refreshedCredentials.expiryDate)
    );
    return refreshedCredentials.accessToken;
  }
  return user.googleBusinessProfile.accessToken;
}

router.get("/get-locations", async (req, res) => {
  let { email } = req.query;

  const user = await User.findOne({
    email: email,
  });

  console.log("User:", user, email);

  try {
    const accessToken = await getValidAccessToken(user);

    const accountName = await getAccountId(accessToken);
    console.log("ACCOUT", accountName);
    const locations = await getLocations(accessToken, accountName);

    if (locations.length === 0) {
      return res.status(404).json({ error: "No locations found" });
    }

    res.json(locations);
  } catch (error) {
    console.error(
      "Error:",
      error.response ? error.response.data : error.message
    );
    res.status(error.response ? error.response.status : 500).json({
      error: "An error occurred",
      details: error.response ? error.response.data : error.message,
    });
  }
});

router.post("/selected-location", async (req, res) => {
  let { email, locations } = req.body;

  const user = await User.findOne({
    email: email,
  });

  console.log("User:", user, email);

  try {
    //update user with selected location
    const updated = await User.findOneAndUpdate(
      { email: email },
      {
        selectedLocations: locations,
      },
      {
        new: true,
      }
    );

    res.json(updated);
  } catch (error) {
    console.error(
      "Error:",
      error.response ? error.response.data : error.message
    );
    res.status(error.response ? error.response.status : 500).json({
      error: "An error occurred",
      details: error.response ? error.response.data : error.message,
    });
  }
});

router.get("/reviews-for-one-location", async (req, res) => {
  let { email } = req.query;

  const user = await User.findOne({
    email: email,
  });

  console.log("User:", user, email);

  try {
    const accessToken = await getValidAccessToken(user);
    const accountName = await getAccountId(accessToken);
    const locationName = user.googleBusinessProfile.locationName;
    const parent = `${accountName}/${location.name
      .split("/")
      .slice(-2)
      .join("/")}`;
    const reviews = await getReviews(accessToken, locationName);

    res.json(reviews);
  } catch (error) {
    console.error(
      "Error:",
      error.response ? error.response.data : error.message
    );
    res.status(error.response ? error.response.status : 500).json({
      error: "An error occurred",
      details: error.response ? error.response.data : error.message,
    });
  }
});

router.get("/reviews", async (req, res) => {
  let { email } = req.query;

  const user = await User.findOne({
    email: email,
  });

  console.log("User:", user, email);

  try {
    console.log("User:", user);
    console.log("Current time:", new Date().toISOString());
    console.log(
      "Expiry date:",
      formatDate(parseUnusualDate(user.googleBusinessProfile.expiryDate))
    );

    const accessToken = await getValidAccessToken(user);

    const accountName = await getAccountId(accessToken);
    console.log("ACCOUT", accountName);

    const locations = user.selectedLocations;

    console.log("LOCATIONS", locations);
    const reviewsPromises = user.selectedLocations.map((location) => {
      const parent = `${accountName}/${location.name
        .split("/")
        .slice(-2)
        .join("/")}`;
      return getReviews(accessToken, parent);
    });
    console.log("LOCATIONS", reviewsPromises);
    // const locations = await getLocations(accessToken, accountName);

    // if (locations.length === 0) {
    //   return res.status(404).json({ error: "No locations found" });
    // }

    // const reviewsPromises = locations.map((location) => {
    //   const parent = `${accountName}/${location.name
    //     .split("/")
    //     .slice(-2)
    //     .join("/")}`;
    //   return getReviews(accessToken, parent);
    // });

    const reviewsResults = await Promise.all(reviewsPromises);
    let totalReviews = 0;
    let totalResponses = 0;

    reviewsResults.forEach((result) => {
      if (result.reviews) {
        totalReviews += result.reviews.length;
        totalResponses += result.reviews.filter(
          (review) => review.reviewReply
        ).length;
      }
    });

    const responseRate =
      totalReviews > 0 ? (totalResponses / totalReviews) * 100 : 0;
    const response = {
      account: accountName,
      locations: locations.map((location, index) => ({
        name: location.name,
        title: location.title,
        reviews: reviewsResults[index],
        responseRate: responseRate.toFixed(2),
      })),
      totalReviews,
      totalResponses,
      responseRate: responseRate.toFixed(2),
    };

    res.json(response);
  } catch (error) {
    console.error(
      "Error:",
      error.response ? error.response.data : error.message
    );
    res.status(error.response ? error.response.status : 500).json({
      error: "An error occurred",
      details: error.response ? error.response.data : error.message,
    });
  }
});

router.post("/reply-to-review", async (req, res) => {
  const { reviewName, replyText } = req.body;
  const { email } = req.query;

  if (!email || !reviewName || !replyText) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  const user = await User.findOne({
    email: email,
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const accessToken = await getValidAccessToken(user);
  try {
    const response = await axios.put(
      `${MY_BUSINESS_API}/${reviewName}/reply`,
      {
        comment: replyText,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Reply response:", JSON.stringify(response.data, null, 2));

    res.json({
      success: true,
      reply: response.data,
    });
  } catch (error) {
    console.error(
      "Error replying to review:",
      error.response ? error.response.data : error.message
    );
    res.status(error.response ? error.response.status : 500).json({
      error: "Failed to reply to review",
      details: error.response ? error.response.data : error.message,
    });
  }
});
module.exports = router;

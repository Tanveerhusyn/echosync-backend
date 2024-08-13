const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user"); // Adjust the path as needed
const router = express.Router();

// User Registration
router.post("/register", async (req, res) => {
  try {
    const {
      companyName,
      phoneNumber,
      email,
      password,
      aboutCompany,
      agreeToPolicy,
    } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    user = new User({
      companyName,
      phoneNumber,
      email,
      password: hashedPassword,
      aboutCompany,
      agreeToPolicy,
      isGoogleUser: false,
    });

    await user.save();

    // Create JWT token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res
      .status(201)
      .json({ token, user: { ...user.toObject(), password: undefined } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/get-user", async (req, res) => {
  try {
    const users = await User.findOne({ email: req.body.email });
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// Check if email exists (for Google sign-up)
router.post("/check-email", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    console.log(user);
    res.json({ isNewUser: !user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// Complete Google sign-up
router.post("/complete-google-signup", async (req, res) => {
  try {
    const {
      companyName,
      phoneNumber,
      email,
      aboutCompany,
      isGoogleUser,
      agreeToPolicy = true,
    } = req.body;

    console.log(req.body);

    let user = await User.findOne({ email });

    if (user) {
      // Update existing user
      user.companyName = companyName;
      user.phoneNumber = phoneNumber;
      user.aboutCompany = aboutCompany;
      user.isGoogleUser = isGoogleUser;
    } else {
      // Create new user
      user = new User({
        companyName,
        phoneNumber,
        email,
        aboutCompany,
        isGoogleUser,
        agreeToPolicy,
      });
    }

    await user.save();

    // Create JWT token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res
      .status(201)
      .json({ token, user: { ...user.toObject(), password: undefined } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/user-status", async (req, res) => {
  const { email } = req.body;
  console.log("STATUS", email);

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    let status = "complete";

    // Check if business info is complete
    if (!user.companyName || !user.phoneNumber || !user.aboutCompany) {
      status = "incomplete";
    }
    // Check if Google Business Profile is connected
    else if (!user.googleBusinessProfile.connected) {
      status = "platform";
    }
    // Check if subscription is active
    else if (!user.subscription) {
      status = "subscription";
    }

    res.json({ status, user });
  } catch (error) {
    console.error("Error checking user status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Create JWT token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({ token, user: { ...user.toObject(), password: undefined } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update User
router.put("/update/:id", async (req, res) => {
  try {
    const { firstName, lastName, phoneNumber, aboutYourself } = req.body;
    const userId = req.params.id;

    let user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.firstName = firstName || user.firstName;
    user.lastName = lastName || user.lastName;
    user.phoneNumber = phoneNumber || user.phoneNumber;
    user.aboutYourself = aboutYourself || user.aboutYourself;

    await user.save();

    res.json({ message: "User updated successfully", user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// Connect Google Business
router.post("/connect-google-business/:id", async (req, res) => {
  try {
    const { googleCredentials } = req.body;
    const userId = req.params.id;

    let user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log(user);
    // Check if Google is already connected
    const googlePlatform = user.connectedPlatforms.find(
      (p) => p.platformName === "google"
    );
    if (googlePlatform) {
      googlePlatform.credentials = googleCredentials;
    } else {
      user.isGoogleUser = true;
      user.connectedPlatforms.push({
        platformName: "google",
        credentials: googleCredentials,
      });
    }

    await user.save();

    res.json({ message: "Google Business connected successfully", user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;

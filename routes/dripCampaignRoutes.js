const express = require("express");
const router = express.Router();
const twilioConfig = require("../config/twilio");
const DripCampaign = require("../models/dripCampaign");

// GET all drip campaigns
router.get("/all-compaigns", async (req, res) => {
  try {
    const campaigns = await DripCampaign.find();
    res.json(campaigns);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET a single drip campaign
router.get("/compaign-by-id/:id", getDripCampaign, (req, res) => {
  res.json(res.dripCampaign);
});

// CREATE a new drip campaign
router.post("/create-compaign", async (req, res) => {
  const dripCampaign = new DripCampaign(req.body);
  try {
    const newCampaign = await dripCampaign.save();
    res.status(201).json(newCampaign);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// UPDATE a drip campaign
router.patch("/update-compaign/:id", getDripCampaign, async (req, res) => {
  if (req.body.name != null) {
    res.dripCampaign.name = req.body.name;
  }
  if (req.body.description != null) {
    res.dripCampaign.description = req.body.description;
  }
  if (req.body.trigger != null) {
    res.dripCampaign.trigger = req.body.trigger;
  }
  if (req.body.messages != null) {
    res.dripCampaign.messages = req.body.messages;
  }
  if (req.body.followUpCondition != null) {
    res.dripCampaign.followUpCondition = req.body.followUpCondition;
  }
  if (req.body.followUpDelay != null) {
    res.dripCampaign.followUpDelay = req.body.followUpDelay;
  }
  if (req.body.isActive != null) {
    res.dripCampaign.isActive = req.body.isActive;
  }
  try {
    const updatedCampaign = await res.dripCampaign.save();
    res.json(updatedCampaign);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// DELETE a drip campaign
router.delete("/delete-compaign/:id", getDripCampaign, async (req, res) => {
  try {
    await res.dripCampaign.remove();
    res.json({ message: "Drip campaign deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Middleware function to get a drip campaign by ID
async function getDripCampaign(req, res, next) {
  let dripCampaign;
  try {
    dripCampaign = await DripCampaign.findById(req.params.id);
    if (dripCampaign == null) {
      return res.status(404).json({ message: "Drip campaign not found" });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
  res.dripCampaign = dripCampaign;
  next();
}

module.exports = router;

const express = require("express");
const router = express.Router();
const Contact = require("../models/contact");

// Create a new contact
router.post("/create-contact", async (req, res) => {
  try {
    const contact = new Contact(req.body);
    await contact.save();
    res.status(201).json(contact);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get all contacts
router.get("/get-all-contacts", async (req, res) => {
  try {
    const contacts = await Contact.find();
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/zapier-hook", async (req, res) => {
  try {
    const { email, fullName, phone, address } = req.body;

    const contact = new Contact({
      email,
      fullName,
      phone,
      address,
      type: "zapier",
    });

    await contact.save();
    res.status(201).json(contact);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get a specific contact
router.get("/get-contact-by-id/:id", getContact, (req, res) => {
  res.json(res.contact);
});

// Update a contact
router.patch("/update-contact/:id", getContact, async (req, res) => {
  if (req.body.fullName != null) {
    res.contact.fullName = req.body.fullName;
  }
  if (req.body.email != null) {
    res.contact.email = req.body.email;
  }
  if (req.body.phone != null) {
    res.contact.phone = req.body.phone;
  }
  if (req.body.address != null) {
    res.contact.address = req.body.address;
  }
  try {
    const updatedContact = await res.contact.save();
    res.json(updatedContact);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete a contact
router.delete("/delete-contact/:id", getContact, async (req, res) => {
  try {
    await res.contact.remove();
    res.json({ message: "Contact deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Middleware function to get a contact by ID
async function getContact(req, res, next) {
  let contact;
  try {
    contact = await Contact.findById(req.params.id);
    if (contact == null) {
      return res.status(404).json({ message: "Contact not found" });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
  res.contact = contact;
  next();
}

module.exports = router;

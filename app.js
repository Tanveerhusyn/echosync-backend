var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var cors = require("cors");
var indexRouter = require("./routes/index");
var usersRouter = require("./routes/users");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const contactRoutes = require("./routes/contactRoutes");
const dripCampaignRoutes = require("./routes/dripCampaignRoutes");
const contactCampaignRoutes = require("./routes/contactCampaignRoutes");
const twilioConfig = require("./config/twilio");

var app = express();

// Connect to MongoDB
var connectdb = require("./database/db");
const { handleWebhookEvent } = require("./routes/payment");
// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "hbs");
const corsOptions = {
  origin: ["http://localhost:3000", "https://admin.echosync.ai"], // Replace with your allowed origin
  methods: ["GET", "POST", "PUT", "DELETE"], // Allowed methods
  allowedHeaders: ["Content-Type", "Authorization"], // Allowed headers
  credentials: true, // Allow cookies
  optionsSuccessStatus: 200, // For legacy browser support
};

app.use(cors(corsOptions));
app.use(logger("dev"));

app.use("/payment", require("./routes/payment"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, "public")));
connectdb();

app.use("/", indexRouter);
app.use("/users", usersRouter);
app.use("/reviews", require("./routes/reviews"));
app.use("/api/contacts", contactRoutes);
app.use("/api/drip-campaigns", dripCampaignRoutes);

app.use("/api/contact-campaigns", contactCampaignRoutes);

// Check Twilio configuration
if (twilioConfig.isConfigured) {
  console.log("Twilio is configured and ready to use");
} else {
  console.warn("Twilio is not configured. SMS functionality will be disabled.");
}

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;

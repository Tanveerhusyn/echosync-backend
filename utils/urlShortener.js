const axios = require("axios");

async function shortenUrl(longUrl) {
  // This is a placeholder implementation using a hypothetical URL shortener API
  // You should replace this with your actual URL shortening logic or service
  try {
    const response = await axios.post("https://api.yourshortener.com/shorten", {
      longUrl: longUrl,
    });
    return response.data.shortUrl;
  } catch (error) {
    console.error("Error shortening URL:", error);
    return longUrl; // Return the original URL if shortening fails
  }
}

module.exports = { shortenUrl };

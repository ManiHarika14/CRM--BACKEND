require("dotenv").config();
const { OpenFgaClient } = require("@openfga/sdk");

const fgaClient = new OpenFgaClient({
  apiUrl: process.env.OPENFGA_API_URL || "http://localhost:8080",
  storeId: process.env.OPENFGA_STORE_ID,
  authorizationModelId: process.env.OPENFGA_MODEL_ID,
});

module.exports = fgaClient;
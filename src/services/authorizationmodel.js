const fs = require("fs");
const axios = require("axios");
require("dotenv").config();

const createModel = async () => {
  try {
    const body = JSON.parse(
      fs.readFileSync("src/openfga/crm-model.json", "utf8")
    );

    const response = await axios.post(
      `http://localhost:8080/stores/${process.env.OPENFGA_STORE_ID}/authorization-models`,
      body,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("MODEL CREATED");
    console.log(response.data);

  } catch (error) {
    console.error(error.response?.data || error.message);
  }
};

createModel();
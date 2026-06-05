require("dotenv").config();

const fgaClient = require("../config/openfga");

async function assignDealPermissions() {
  try {
    const response = await fgaClient.write({
      writes: {
        tuple_keys: [
          {
            user: "user:2bac19b7-0788-421c-abe2-78b0e9ed12fc",
            relation: "viewer",
            object: "deal:all",
          },
          {
            user: "user:2bac19b7-0788-421c-abe2-78b0e9ed12fc",
            relation: "creator",
            object: "deal:all",
          },
          {
            user: "user:2bac19b7-0788-421c-abe2-78b0e9ed12fc",
            relation: "editor",
            object: "deal:all",
          },
          {
            user: "user:2bac19b7-0788-421c-abe2-78b0e9ed12fc",
            relation: "deleter",
            object: "deal:all",
          },
        ],
      },
    });

    console.log("SUCCESS:");
    console.log(response);
  } catch (error) {
    console.error("ERROR:");
    console.error(error);
  }
}

assignDealPermissions();
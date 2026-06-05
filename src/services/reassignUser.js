// src/services/reassignUser.js

const { assignRoleToUser } = require("./openfgaService");

async function run() {
  const result = await assignRoleToUser(
    "2bac19b7-0788-421c-abe2-78b0e9ed12fc",
    "CRM1_USER1"
  );

  console.log(result);
}

run();
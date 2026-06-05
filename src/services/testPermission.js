const { checkPermission } = require("./openfgaService");

async function run() {
  try {
    console.log("START");

    const result = await checkPermission(
      "2bac19b7-0788-421c-abe2-78b0e9ed12fc",
      "lead",
      "viewer"
    );

    console.log("RESULT:");
    console.log(result);
  } catch (error) {
    console.error("ERROR:");
    console.error(error);
  }
}

run();
const app = require("./app");
const env = require("./config/env");

app.listen(env.PORT, () => {
  console.log(
    `CRM API running on port ${env.PORT}`
  );
});
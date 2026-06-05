const swaggerJsdoc = require("swagger-jsdoc");

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "CRM API",
      version: "1.0.0",
      description: "CRM backend API documentation",
    },
    servers: [
      {
        url: "http://localhost:5000",
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "crm_token",
        },
      },
    },
  },
  apis: [
    "./src/routes/authRoutes.js",
    "./src/routes/userRoutes.js",
    "./src/routes/leadRoutes.js",
    "./src/routes/customerRoutes.js",
    "./src/routes/dealRoutes.js",
    "./src/routes/taskRoutes.js",
    "./src/routes/noteRoutes.js",
    "./src/routes/activityRoutes.js",
    "./src/routes/authLogRoutes.js",
    "./src/routes/adminRoutes.js",
  ],
});

module.exports = swaggerSpec;
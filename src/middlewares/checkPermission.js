const { checkPermission: checkFgaPermission } = require("../services/openfgaService");

const checkPermission = (resource, accessType) => {
  return async (req, res, next) => {
    try {
      console.log("================================");
      console.log("RESOURCE:", resource);
      console.log("ACCESS TYPE:", accessType);
      console.log("JWT USER:", req.user);

      const userId = req.user?.user_id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      // ADMIN & SUPER ADMIN BYPASS
      if (
        req.user.role === "admin" ||
        req.user.role === "super_admin"
      ) {
        console.log("ADMIN/SUPER_ADMIN ACCESS GRANTED");
        return next();
      }

      const result = await checkFgaPermission(
        userId,
        resource,
        accessType
      );

      console.log("OPENFGA RESULT:", result);
      console.log("================================");

      if (!result.allowed) {
        return res.status(403).json({
          success: false,
          message: `Permission denied. ${accessType} access required on ${resource}`,
        });
      }

      next();
    } catch (error) {
      console.error("OPENFGA PERMISSION ERROR:", error);

      return res.status(500).json({
        success: false,
        message: "Permission verification failed",
      });
    }
  };
};

module.exports = checkPermission;
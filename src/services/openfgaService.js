const fgaClient = require("../config/openfga");

const assignRoleToUser = async (userId, roleName) => {
  const safeRoleName = roleName.replace(/\s+/g, "_");

  return await fgaClient.write({
    writes: [
      {
        user: `user:${userId}`,
        relation: "member",
        object: `role:${safeRoleName}`,
      },
    ],
  });
};

const assignPermissionToRole = async (
  roleName,
  resource,
  accessType
) => {
  const safeRoleName = roleName.replace(/\s+/g, "_");

  return await fgaClient.write({
    writes: [
      {
        user: `role:${safeRoleName}#member`,
        relation: accessType,
        object: `${resource}:module`,
      },
    ],
  });
};

const checkPermission = async (
  userId,
  resource,
  accessType
) => {
  return await fgaClient.check({
    user: `user:${userId}`,
    relation: accessType,
    object: `${resource}:module`,
  });
};

module.exports = {
  assignRoleToUser,
  assignPermissionToRole,
  checkPermission,
};
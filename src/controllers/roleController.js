const prisma = require("../utils/prisma");
const {
  assignRoleToUser,
  assignPermissionToRole,
} = require("../services/openfgaService");

const createRole = async (req, res) => {
  try {
    const { role_name, description } = req.body;

    if (!role_name) {
      return res.status(400).json({
        success: false,
        message: "Role name is required",
      });
    }

    const existingRole = await prisma.role.findFirst({
      where: {
        role_name,
      },
    });

    if (existingRole) {
      return res.status(409).json({
        success: false,
        message: "Role already exists",
      });
    }

    const role = await prisma.role.create({
      data: {
        role_name,
        description,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Role created successfully",
      data: role,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getRoles = async (req, res) => {
  try {
    const roles = await prisma.role.findMany({
      orderBy: {
        i_id: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      data: roles,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const assignRole = async (req, res) => {
  try {
    const { user_id, role_id } = req.body;

    if (!user_id || !role_id) {
      return res.status(400).json({
        success: false,
        message: "user_id and role_id are required",
      });
    }

    const role = await prisma.role.findUnique({
  where: {
    id: role_id,
  },
});

if (!role) {
  return res.status(404).json({
    success: false,
    message: "Role not found",
  });
}

const roleAssignment = await prisma.userRole.create({
  data: {
    user_id,
    role_id,
  },
});

await assignRoleToUser(
  user_id,
  role.role_name
);

    return res.status(201).json({
      success: true,
      message: "Role assigned successfully",
      data: roleAssignment,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
const addPermission = async (req, res) => {
  try {
    const { roleId } = req.params;
    const { resource, access_type } = req.body;

    if (!resource || !access_type) {
      return res.status(400).json({
        success: false,
        message: "resource and access_type are required",
      });
    }

    const role = await prisma.role.findUnique({
      where: {
        id: roleId,
      },
    });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    const permission = await prisma.rolePermission.create({
  data: {
    role_id: roleId,
    resource,
    access_type,
  },
});

await assignPermissionToRole(
  role.role_name,
  resource,
  access_type
);

    return res.status(201).json({
      success: true,
      message: "Permission added successfully",
      data: permission,
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getRolePermissions = async (req, res) => {
  try {
    const { roleId } = req.params;

    const permissions = await prisma.rolePermission.findMany({
      where: {
        role_id: roleId,
      },
    });

    return res.status(200).json({
      success: true,
      data: permissions,
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  createRole,
  getRoles,
  assignRole,
  addPermission,
  getRolePermissions,
};

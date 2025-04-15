import User from "../../models/User.js";

// Get all users (Admin only)
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ["id", "FirstName", "LastName", "Email", "Role", "createdAt"],
      order: [["createdAt", "DESC"]]
    });

    res.status(200).json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message
    });
  }
};

// Update user role (Admin only)
export const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    // Validate role
    if (!role || !["Student", "Host", "Admin"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Role must be Student, Host, or Admin"
      });
    }

    // Find user
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Update role
    user.Role = role;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User role updated to ${role} successfully`,
      user: {
        id: user.id,
        FirstName: user.FirstName,
        LastName: user.LastName,
        Email: user.Email,
        Role: user.Role
      }
    });
  } catch (error) {
    console.error("Error updating user role:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update user role",
      error: error.message
    });
  }
};

// Get all hosts (Admin only)
export const getAllHosts = async (req, res) => {
  try {
    const hosts = await User.findAll({
      where: { Role: "Host" },
      attributes: ["id", "FirstName", "LastName", "Email", "createdAt"],
      order: [["createdAt", "DESC"]]
    });

    res.status(200).json({
      success: true,
      count: hosts.length,
      hosts
    });
  } catch (error) {
    console.error("Error fetching hosts:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch hosts",
      error: error.message
    });
  }
};

// Get user details (Admin only)
export const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByPk(userId, {
      attributes: [
        "id", 
        "FirstName", 
        "LastName", 
        "Email", 
        "Phone", 
        "gender", 
        "DateOfBirth", 
        "address", 
        "Role", 
        "totalPointsEarned",
        "totalEventsPlayed", 
        "createdAt"
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user details",
      error: error.message
    });
  }
};

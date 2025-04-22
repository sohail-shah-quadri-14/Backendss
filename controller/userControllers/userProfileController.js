import User from "../../models/User.js";  //  Fix import path

// **Get User Profile**
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find user by ID
    const user = await User.findByPk(userId, {
      attributes: ["id", "FirstName", "LastName", "Email", "Phone", "address", "DateOfBirth", "gender", "profilePicture"],
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { FirstName, LastName, DateOfBirth, Phone, gender, address, profilePicture } = req.body;

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Update only the fields that are provided
    const updateData = {};
    if (FirstName) updateData.FirstName = FirstName;
    if (LastName) updateData.LastName = LastName;
    if (DateOfBirth) updateData.DateOfBirth = DateOfBirth;
    if (Phone) updateData.Phone = Phone;
    if (gender) updateData.gender = gender;
    if (address) updateData.address = address;
    if (profilePicture) updateData.profilePicture = profilePicture;

    await user.update(updateData);

    res.status(200).json({ 
      message: "Profile updated successfully"
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

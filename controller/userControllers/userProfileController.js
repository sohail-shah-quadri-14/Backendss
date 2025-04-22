import User from "../../models/User.js";  //  Fix import path

// **Get User Profile**
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id ;//

    // Find user by ID
    const user = await User.findByPk(userId, {
      attributes: [ "id","FirstName","LastName", "Email", "Phone", "address", "DateOfBirth", "gender", "profilePicture"], // Use correct field names
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

    
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    
    await user.update(req.body);

  
    res.status(200).json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

import jwt, { decode } from "jsonwebtoken";
import User from "../models/User.js"; // Ensure correct import
import dotenv from "dotenv";

dotenv.config();

export const authenticate = async (req, res, next) => {
  let token = req.cookies?.accessToken; //  Get token from cookies

  

  if (!token) {
    return res.status(401).json({ message: "User not authenticated" });
  }

  try {
    //  Verify JWT Token
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    // console.log("Decoded Token:", decoded);

    //  Find User by Correct Field Name 
    const user = await User.findOne({ where: { id: decoded.id } });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    req.user = user;

    // console.log("Authenticated User:", user);
     //  Debugging info
    next(); //  Move to the next middleware
  } catch (error) {
    console.error("Authentication Error:", error.message);
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

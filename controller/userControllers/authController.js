import dotenv from "dotenv";
dotenv.config();
import User from "../../models/User.js";
// import  transporter  from "../../config/transporter.js";
import jwt from "jsonwebtoken";




export const register = async (req, res) => {
    try {
      const { FirstName, LastName, DateOfBirth, Email, Password } = req.body;
  
      if (!FirstName || !LastName  || !DateOfBirth || !Email || !Password) {
        return res.status(400).json({ message: "Please provide all fields" });
      }
  
      // **Check if user already exists**
      const existingUser = await User.findOne({ where: { Email } });
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }
  
      //  password hashing is done by Sequelize hook  which is done automatically before saving 
      const user = await User.create({ FirstName ,LastName,DateOfBirth, Email, Password });
      
      const { accessToken, refreshToken } = user.generateTokens();
      
      user.refreshToken = refreshToken;
      await user.save();

      // const verifyLink = `${process.env.FRONTEND_URL}/verify-email/${user.id}`;

      // const mailOptions = {
      //   from: process.env.EMAIL_USER,
      //   to: Email,
      //   subject: "Verify Your Email - Howzdat Registration",
      //   html: `
      //     <h1>Welcome to Howzdat!</h1>
      //     <p>Thank you for registering. Please click the link below to verify your email:</p>
      //     <a href="${verifyLink}">Verify Email</a>
      //   `,
      // };
  
      // await transporter.sendMail(mailOptions);

    res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env === "production", // for production "true" for development "false"
    sameSite: "none", // for production "None" for development "Lax"
    maxAge: 60 * 60 * 1000, // 1 hour
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env === "production", 
    sameSite: "none", 
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  }); 


      return res.status(201).json({ message: "User registered successfully", 
        user:{
          id:user.id,
          FirstName:user.FirstName,
          LastName:user.LastName,
          DateOfBirth:user.DateOfBirth,
          Email:user.Email,
      }, });
    } catch (error) {
      console.error("Error during registration:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };

export const login = async (req, res) => {
    try {
      const { Email, Password } = req.body;
  
      if (!Email || !Password) {
        return res.status(400).json({ message: "Please provide email and password" });
      }
  
      // Find user in the database
      const user = await User.findOne({ where: { Email }});
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
  
      // **Use comparePassword method to validate password
      const isMatch = await user.comparePassword(Password);
      if (!isMatch) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const{accessToken, refreshToken}=user.generateTokens();
      user.refreshToken = refreshToken;
      await user.save();

    res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env === "production", // for production "true" for development "false"
    sameSite: "none", // for production "None" for development "Lax"
    maxAge: 60 * 60 * 1000, // 1 hour
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env === "production", 
    sameSite: "none", // Adjust for production or local development
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  }); 
   
  
      return res.status(200).json({ message: "Login successful",user:{
        id:user.id,
        FirstName:user.FirstName,
        LastName:user.LastName,
        DateOfBirth:user.DateOfBirth,
        Email:user.Email,
      }});
    } catch (error) {
      console.error("Error during login:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };

  
export const forgotPassword = async (req, res) => {
    try {
      const { Email } = req.body;
      if (!Email) {
        return res.status(400).json({ message: "Please provide email" });
      }
      const user = await User.findOne({ where: { Email } });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
  
      // const mailOptions = {
      //   from: process.env.EMAIL_USER,
      //   to: email,
      //   subject: "Password Reset Request",
      //   text: `Click the link to reset your password: ${resetLink}`,
      // };
  
      // await transporter.sendMail(mailOptions);
      return res.status(200).json({ message: "Password reset link sent to email" });
    } catch (error) {
      console.error("Error during password reset:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };


export const logout = async (req, res) => {
  try {
    // **Extract refresh token from cookies**
    const { refreshToken } = req.cookies; 
    if (!refreshToken) {
      return res.status(400).json({ message: "User not logged in" });
    }
    

    // **Decode refresh token**
    
     let decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET_KEY);
    
      

    // **Find user in database**
    const Finduser = await User.findOne({ where: { id: decoded.id } });
    if (!Finduser) {
      return res.status(404).json({ message: "User not found" });
    }

   
    await Finduser.update({ refreshToken: null });

  
  
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
  

    return res.status(200).json({ message: "Logout successful" });

  } catch (error) {
    console.error("Logout Error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

  



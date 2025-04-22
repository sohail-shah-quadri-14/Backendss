import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/sqlconnection.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

class User extends Model {
  // **Compare Password**
  async comparePassword(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.Password);
  }

  // **Generate JWT Tokens**
  generateTokens() {
    const accessToken = jwt.sign(
      { id: this.id, Email: this.Email, Role: this.Role },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "60m" } // Access Token expires in 1 hour
    );

    const refreshToken = jwt.sign(
      { id: this.id, Email: this.Email, Role: this.Role },
      process.env.REFRESH_TOKEN_SECRET_KEY,
      { expiresIn: "60d" } // Refresh Token expires in 7 days
    );

    return { accessToken, refreshToken };
  }
}

// **Define User Model**
User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4, // Auto-generate UUID
      primaryKey: true,
      allowNull: false,
    },
    FirstName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    LastName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    DateOfBirth: {
      type: DataTypes.DATEONLY,  // Stores only date (YYYY-MM-DD)
      allowNull: false,  // Required field
    },
    gender: {
      type: DataTypes.ENUM('male', 'female'),
      allowNull: false,
    },
    Email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    isEmailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    Phone: {
      type: DataTypes.STRING,
      allowNull: false, // Optional, user can add later
      unique: true,
    },
    isPhoneVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    address: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    Password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    Role: {
      type: DataTypes.ENUM("Student", "Host", "Admin"),
      defaultValue: "Student", // Default role is Student
    },
    // Renamed to totalPointsEarned for clarity
    totalPointsEarned: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    pointsRedeemed: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    refreshToken: {
      type: DataTypes.STRING(1024),
      allowNull: true,
    },
    profilePicture: {
      type: DataTypes.STRING(1000000), // Large enough for base64 images
      allowNull: true,
      defaultValue: null
    },
  },
  {
    sequelize,
    modelName: "User",
    tableName: "users",
    timestamps: true,
    hooks: {
      // Hashing our Password before saving
      beforeCreate: async (user) => {
        user.Password = await bcrypt.hash(user.Password, 10);
      },
      beforeUpdate: async (user) => {
        if (user.changed("Password")) {
          user.Password = await bcrypt.hash(user.Password, 8);
        }
      },
    },
  }
);

export default User;

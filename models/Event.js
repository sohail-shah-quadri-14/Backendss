import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/sqlconnection.js";

class Event extends Model {}

Event.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    picture: {
      type: DataTypes.TEXT('long'), // Large enough for base64 images
      allowNull: true,
    },
    hostID: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" }, // Links to User model
    },
    status: {
      type: DataTypes.ENUM("Upcoming", "Ongoing", "Completed"),
      defaultValue: "Upcoming", 
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    currentParticipants: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    points: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: true,
    },
    youtubeVideoId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "Event",
    tableName: "events",
    timestamps: true, // Adds createdAt and updatedAt
  }
);

export default Event;

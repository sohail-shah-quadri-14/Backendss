import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/sqlconnection.js";
import User from "./User.js";
import Event from "./Event.js";

class UserEvent extends Model {}

UserEvent.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    eventId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "events", key: "id" },
    },
    pointsEarned: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("Registered", "Joined", "Completed", "Cancelled"),
      defaultValue: "Registered",
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "UserEvent",
    tableName: "user_events",
    timestamps: true,
  }
);

// Define associations properly
UserEvent.belongsTo(User, { foreignKey: 'userId' });
UserEvent.belongsTo(Event, { foreignKey: 'eventId' });
User.hasMany(UserEvent, { foreignKey: 'userId' });
Event.hasMany(UserEvent, { foreignKey: 'eventId' });

export default UserEvent;

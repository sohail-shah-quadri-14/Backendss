import User from "../../models/User.js";
import UserEvent from "../../models/UserEvents.js";
import Event from "../../models/Event.js";
import { Op } from "sequelize";


// Get user stats
export const getStudentStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's stats
    const user = await User.findByPk(userId, {
      attributes: ['totalPointsEarned', 'totalEventsPlayed', 'pointsRedeemed'],
    });

    // Get RSVP'd events count
    const rsvpdCount = await UserEvent.count({
      where: {
        userId,
        status: "Registered"
      }
    });

    res.status(200).json({
      stats: {
        totalEventsPlayed: user.totalEventsPlayed,
        totalPointsEarned: user.totalPointsEarned,
        pointsRedeemed: user.pointsRedeemed,
        rsvpdEvents: rsvpdCount
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get RSVP'd events
export const getRSVPdEvents = async (req, res) => {
  try {
    const userId = req.user.id;

    const rsvpdEvents = await UserEvent.findAll({
      where: {
        userId,
        status: "Registered"
      },
      include: [{
        model: Event,
        where: {
          startTime: {
            [Op.gt]: new Date()
          }
        }
      }]
    });

    res.status(200).json({ rsvpdEvents });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


import User from "../models/User.js";
import UserEvent from "../models/UserEvents.js";
import Event from "../models/Event.js";
import { Op } from "sequelize";

// Get student dashboard stats
export const getStudentDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's stats
    const user = await User.findByPk(userId, {
      attributes: ['pointsEarned', 'totalEventsPlayed', 'pointsRedeemed']
    });

    // Get RSVP'd events
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

    // Get upcoming events
    const upcomingEvents = await Event.findAll({
      where: {
        status: "Upcoming",
        startTime: {
          [Op.gt]: new Date()
        }
      },
      order: [['startTime', 'ASC']]
    });

    // Get ongoing events
    const ongoingEvents = await Event.findAll({
      where: {
        status: "Ongoing",
        startTime: {
          [Op.lte]: new Date()
        },
        endTime: {
          [Op.gt]: new Date()
        }
      }
    });

    res.status(200).json({
      stats: {
        totalEventsPlayed: user.totalEventsPlayed,
        pointsEarned: user.pointsEarned,
        pointsRedeemed: user.pointsRedeemed,
        rsvpdEvents: rsvpdEvents.length
      },
      upcomingEvents,
      ongoingEvents
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}; 
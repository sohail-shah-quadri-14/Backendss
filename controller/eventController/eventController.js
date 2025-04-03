import Event from "../../models/Event.js";
import UserEvent from "../../models/UserEvents.js";
import { Op } from "sequelize";


// Create new event
export const createEvent = async (req, res) => {
  try {
    
    console.log(req.user.id);
    const { title, description, startTime, endTime, points, youtubeVideoId, picture } = req.body; 
    const hostID = req.user.id;

    // Validate required fields
    if (!title || !description || !startTime || !endTime || !points || !youtubeVideoId  ) {
      return res.status(400).json({ 
        message: "All fields are required" 
      });
    }

    if (!Number.isInteger(points) || points <= 0) {
      return res.status(400).json({ 
        message: "Points per question must be a positive integer" 
      });
    }

    // Create the event
    const event = await Event.create({
      title,
      description,
      picture,
      startTime,
      endTime,
      points,
      youtubeVideoId,
      hostID,
      status: "Upcoming"
    });

    res.status(201).json({
      message: "Event created successfully",
      event: {
        id: event.id,
        title: event.title,
        description: event.description,
        startTime: event.startTime,
        endTime: event.endTime,
        points: event.points,
        status: event.status,   
        picture: event.picture,
        currentParticipants: event.currentParticipants,
        hostID: event.hostID
      }
    });
  } catch (error) {
    console.error("Error creating event:", error);
    res.status(500).json({ message: error.message });
  }
};

// Join event
export const registerEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    // Check if user is a student
    if (req.user.Role !== "Student") {
      return res.status(403).json({ message: "Only students can join events" });
    }

    // Get event
    const event = await Event.findByPk(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if already joined
    const alreadyJoined = await UserEvent.findOne({
      where: {
        userId,
        eventId
      }
    });

    if (alreadyJoined) {
      return res.status(400).json({ message: "You have already joined this event" });
    }

    // Check if event is upcoming
    if (event.status !== "Upcoming") {
      return res.status(400).json({ message: "Can only join upcoming events" });
    }


    // Check for time conflicts
    const existingEvent = await UserEvent.findOne({
      where: {
        userId,
        status: "Registered"
      },
      include: {
        model: Event,
        required: true,
        where: {
          [Op.or]: [
            {
              startTime: {
                [Op.between]: [event.startTime, event.endTime]
              }
            },
            {
              endTime: {
                [Op.between]: [event.startTime, event.endTime]
              }
            }
          ]
        }
      }
    });

    if (existingEvent) {
      return res.status(400).json({ 
        message: "You already have an event scheduled for this time" 
      });
    }

    // Create user-event relationship
    const userEvent = await UserEvent.create({
      userId,
      eventId,
      status: "Registered"
    });

    // Increment current participants
    await event.increment('currentParticipants');

    res.status(200).json({ 
      message: "Successfully joined event",
      userEvent
    });
  } catch (error) {
    console.error("Error joining event:", error);
    res.status(500).json({ message: error.message });
  }
};


 export const updateEvent = async (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, startTime, endTime } = req.body;
  
      const event = await Event.findByPk(id);
  
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
  
      event.title = title;
      event.description = description;
      event.startTime = startTime;
      event.endTime=endTime;
      await event.save();
  
      return res.status(200).json({ message: "Event updated successfully", event });
    } catch (error) {
      console.error("Error updating event:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  };

// Get upcoming events
export const getUpcomingEvents = async (req, res) => {
  try {
    
    const events = await Event.findAll({
      where: {
        status: "Upcoming",
        startTime: {
          [Op.gt]: new Date() // event start time > current time
        } 
      },
      order: [['startTime', 'ASC']]
    });

    const eventsResponse = events.map(event => ({
      id: event.id,
      title: event.title,
      description: event.description,
      startTime: event.startTime,
      endTime: event.endTime,
      hostID: event.hostID,
      picture: event.picture,
      points: event.points,
    }));

    res.status(200).json(eventsResponse);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Get ongoing events
export const getOngoingEvents = async (req, res) => {
  try {
    const currentDate = new Date();

    // First, find all events regardless of status
    const allEvents = await Event.findAll();

    // 
    const ongoingEvents = await Event.findAll({
      where: {
        status: "Ongoing"
      }
    });
    


    // Format response
    const eventsResponse = ongoingEvents.map(event => ({
      id: event.id,
      title: event.title,
      description: event.description,
      startTime: event.startTime,
      endTime: event.endTime,
      hostID: event.hostID,
      status: event.status,
      points: event.points,
      currentParticipants: event.currentParticipants
    }));

    res.status(200).json({
      message: ongoingEvents.length > 0 ? "Ongoing events retrieved successfully" : "No ongoing events found",
      events: eventsResponse
    });
  } catch (error) {
    console.error("Error fetching ongoing events:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get event details
export const getEventDetails = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findByPk(eventId);
    
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }
    
    const eventDetails = {
      id: event.id,
      title: event.title,
      description: event.description,
      startTime: event.startTime,
      endTime: event.endTime,
      points: event.points,
      status: event.status,
      hostID: event.hostID,
      currentParticipants: event.currentParticipants,
      subject: event.subject,
      standard: event.standard,
      picture: event.picture
    };
    
    res.status(200).json(eventDetails);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};



// Start an event
export const startEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const hostId = req.user.id;

    const event = await Event.findByPk(eventId);
    if (!event) {
      console.log("Event not found:", eventId);
      return res.status(404).json({ message: "Event not found" });
    }

    if (event.hostID !== hostId) {
      console.log("Host ID mismatch:", { eventHostId: event.hostID, requestHostId: hostId });
      return res.status(403).json({ message: "You can only start events you created" });
    }

    if (event.status === "Ongoing") {
      return res.status(400).json({ message: "Event is already ongoing" });
    }
    if (event.status === "Completed") {
      return res.status(400).json({ message: "Event is already completed" });
    }

    await event.update({ status: "Ongoing" });

    if (global.io) {
      global.io.to(`event-${eventId}`).emit("event-started", {
        eventId: event.id,
        title: event.title,
        hostId: event.hostID,
        status: event.status,
        startTime: event.startTime
      });
      console.log("Socket.io event started:", event.id);
    }

    res.status(200).json({
      message: "Event started successfully",
      event
    });
  } catch (error) {
    console.error("Error starting event:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get events user has registered for
export const getRegisteredEvents = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find all user-event relationships for this user
    const registeredEvents = await UserEvent.findAll({
      where: {
        userId: userId,
        status: "Registered"
      },
      include: [{
        model: Event,
        attributes: ['id', 'title', 'description', 'startTime', 'endTime', 'status', 'points', 'currentParticipants']
      }]
    });

    // Format the response
    const events = registeredEvents.map(registration => ({
      id: registration.Event.id,
      title: registration.Event.title,
      description: registration.Event.description,
      startTime: registration.Event.startTime,
      endTime: registration.Event.endTime,
      status: registration.Event.status,
      points: registration.Event.points,
      currentParticipants: registration.Event.currentParticipants,
      registrationStatus: registration.status
    }));

    res.status(200).json({
      success: true,
      message: events.length > 0 ? "Registered events retrieved successfully" : "No registered events found",
      events: events
    });

  } catch (error) {
    console.error("Error fetching registered events:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


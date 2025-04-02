import Event from "../../models/Event.js";
import UserEvent from "../../models/UserEvents.js";
import { Op } from "sequelize";


// Create new event
export const createEvent = async (req, res) => {
  try {
    
    console.log(req.user.id);
    const { title, description, startTime, endTime, points, youtubeVideoId} = req.body; 
    const hostID = req.user.id;

    // Validate required fields
    if (!title || !description || !startTime || !endTime || !points ) {
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
      picture: event.picture
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

   

    // Get event
    const event = await Event.findByPk(eventId);
    if (!event) {
      console.log('Event not found:', eventId);
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if user is the host of this event
    if (event.hostID !== hostId) {
      console.log('Host ID mismatch:', { eventHostId: event.hostID, requestHostId: hostId });
      return res.status(403).json({ message: "You can only start events you created" });
    }

    // Check if event is already ongoing or completed
    if (event.status === "Ongoing") {
      console.log('Event already ongoing:', event.id);
      return res.status(400).json({ message: "Event is already ongoing" });
    }
    if (event.status === "Completed") {
      console.log('Event already completed:', event.id);
      return res.status(400).json({ message: "Event is already completed" });
    }

    // Update event status to "Ongoing"
    console.log('Updating event status to Ongoing:', event.id);
    await event.update({ status: "Ongoing" });

    

    // Notify only participants who have joined this event
    if (global.io) {
      global.io.to(eventId).emit('event-started', {
        eventId: updatedEvent.id,
        title: updatedEvent.title,
        hostId: updatedEvent.hostID,
        status: updatedEvent.status,
        startTime: updatedEvent.startTime
      });
      console.log('Socket.io notification sent for event start:', updatedEvent.id);
    } else {
      console.log('Socket.io not available, skipping notification');
    }

    res.status(200).json({
      message: "Event started successfully",
      event: {
        id: updatedEvent.id,
        title: updatedEvent.title,
        description: updatedEvent.description,
        startTime: updatedEvent.startTime,
        endTime: updatedEvent.endTime,
        points: updatedEvent.points,
        status: updatedEvent.status,
        currentParticipants: updatedEvent.currentParticipants,
        hostID: updatedEvent.hostID
      }
    });
  } catch (error) {
    console.error("Error starting event:", error);
    res.status(500).json({ message: error.message });
  }
};



// Join a live event
export const joinLiveEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    // Check if user is registered
    const registration = await UserEvent.findOne({
      where: {
        userId,
        eventId,
        status: "Registered"
      }
    });

    if (!registration) {
      return res.status(403).json({ message: "You must register for the event first" });
    }

    // Get event
    const event = await Event.findByPk(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if event is ongoing
    if (event.status !== "Ongoing") {
      return res.status(400).json({ message: "Event is not ongoing" });
    }

    // Update registration status to "Joined"
    await registration.update({ status: "Joined" });

    // Set up socket connection
    if (global.io) {
      const socket = global.io.sockets.sockets.get(userId);
      if (socket) {
        socket.join(`event-${eventId}`);
        socket.emit('joined-event-room', {
          eventId,
          status: 'Joined',
          message: 'Successfully joined live event'
        });
      }
    }

    res.status(200).json({ 
      message: "Successfully joined live event",
      event: {
        id: event.id,
        title: event.title,
        youtubeVideoId: event.youtubeVideoId
      }
    });
  } catch (error) {
    console.error("Error joining live event:", error);
    res.status(500).json({ message: error.message });
  }
};


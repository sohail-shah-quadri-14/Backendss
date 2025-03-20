import express from 'express';
// import { authenticateToken } from "../middleware/auth.js";
import { authenticate } from '../middleware/authmiddleware.js';
import {
  createEvent,
  registerEvent,
  getUpcomingEvents,
  getOngoingEvents,
  getEventDetails,
  updateEvent,
  joinLiveEvent,
  startEvent
} from "../controller/eventController/eventController.js";
import { checkRole } from "../middleware/checkRole.js";


const router = express.Router();

// Create event (Host only)
router.post("/create", authenticate, checkRole(["Host"]), createEvent);

// Join event (Student only)
router.post("/join/:eventId", authenticate, registerEvent);

// Join live event (Student only)
router.post("/join-live/:eventId", authenticate, joinLiveEvent);

// Start event (Host only)
router.post("/start/:eventId", authenticate, checkRole(["Host"]), startEvent);

// Get upcoming events (Public)
router.get("/upcoming", authenticate, getUpcomingEvents);

// Get ongoing events (Public)
router.get("/ongoing", authenticate, getOngoingEvents);

// Get event details (Public)
router.get("/:eventId", authenticate, getEventDetails);

// Update event (Host only)
router.put("/:eventId", authenticate, checkRole(["Host"]), updateEvent);

export default router;

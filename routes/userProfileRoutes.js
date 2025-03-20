import express from 'express';
import { authenticate } from '../middleware/authmiddleware.js';
const router = express.Router();
import { getUserProfile,updateUserProfile } from '../controller/userControllers/userProfileController.js';


router.get('/', authenticate, getUserProfile);
router.put('/', authenticate, updateUserProfile); // what is good /profile or /profile/:id ? 


export default router;
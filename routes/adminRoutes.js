import express from 'express';
import { authenticate } from '../middleware/authmiddleware.js';
import { checkRole } from '../middleware/checkRole.js';
import { 
  getAllUsers, 
  updateUserRole, 
  getAllHosts,
  getUserDetails
} from '../controller/adminController/adminController.js';

const router = express.Router();

// All routes require admin role
router.use(authenticate, checkRole(["Admin"]));

// Get all users
router.get('/users', getAllUsers);

// Get user details
router.get('/users/:userId', getUserDetails);

// Update user role (promote to host or demote)
router.patch('/users/:userId/role', updateUserRole);

// Get all hosts
router.get('/hosts', getAllHosts);

export default router;

import express from 'express';
const router = express.Router();
import {register,login, logout , forgotPassword , refreshAccessToken} from '../controller/userControllers/authController.js';
import { authenticate } from '../middleware/authmiddleware.js';


router.post('/register', register);

router.post('/login', login);

router.post('/forgotpassword', forgotPassword);

router.post('/logout', authenticate, logout);

// router.get("/verify-email", verifyEmail);

router.post('/refresh-token', refreshAccessToken);


export default router;
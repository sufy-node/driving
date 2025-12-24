import express from 'express';
import { getCompanyDashboard, manageUsers, addUser } from '../controllers/companyAdmin.js';
import { getBookingsPage, createBooking } from '../controllers/bookingController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All routes here are prefixed with /c/:companySlug
router.use(protect);

// Dashboard
router.get('/dashboard', getCompanyDashboard);

// User Management (Admin Only)
router.get('/users', authorize('COMPANY_ADMIN'), manageUsers);
router.post('/users/add', authorize('COMPANY_ADMIN'), addUser);

// Booking Module (Accessible by Admin and Trainers)
router.get('/bookings', authorize('COMPANY_ADMIN', 'TRAINER', 'CUSTOMER'), getBookingsPage);
router.post('/bookings/add', authorize('COMPANY_ADMIN', 'TRAINER'), createBooking);

export default router;
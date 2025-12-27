import express from 'express';

// Controller Imports
import * as companyAdminController from '../controllers/companyAdmin.js';
import * as vehicleController from '../controllers/vehicleController.js';
import * as enrollmentController from '../controllers/enrollmentController.js';
import * as attendanceController from '../controllers/attendanceController.js';
import * as paymentController from '../controllers/paymentController.js';
import * as trainerController from '../controllers/trainerController.js';

// Middleware Imports
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router({ mergeParams: true });

router.use(protect);

// --- 1. TRAINER PORTAL ---
router.get('/trainer/dashboard', authorize('TRAINER'), trainerController.getTrainerDashboard);

// --- 2. DASHBOARD & ANALYTICS ---
router.get('/dashboard', companyAdminController.getCompanyDashboard);
router.get('/reports', authorize('COMPANY_ADMIN'), companyAdminController.getReportsPage);

// --- 3. ATTENDANCE & DAILY LOGS ---
router.get('/attendance', authorize('COMPANY_ADMIN', 'TRAINER'), attendanceController.getDailySchedule);
router.post('/attendance/mark', authorize('COMPANY_ADMIN', 'TRAINER'), attendanceController.markAttendance);
router.post('/attendance/reset', authorize('COMPANY_ADMIN', 'TRAINER'), attendanceController.resetAttendance);

// --- 4. VEHICLE FLEET MANAGEMENT ---
router.get('/vehicles', authorize('COMPANY_ADMIN'), vehicleController.getVehiclesPage);
router.post('/vehicles/add', authorize('COMPANY_ADMIN'), vehicleController.addVehicle);
router.get('/vehicles/edit/:id', authorize('COMPANY_ADMIN'), vehicleController.getEditVehiclePage);
router.post('/vehicles/edit/:id', authorize('COMPANY_ADMIN'), vehicleController.updateVehicle);
router.post('/vehicles/toggle/:id', authorize('COMPANY_ADMIN'), vehicleController.toggleVehicleStatus);

// --- 5. STUDENT ENROLLMENTS & PROGRESS ---
router.get('/enrollments', authorize('COMPANY_ADMIN'), enrollmentController.getEnrollmentPage);
router.post('/enrollments/add', authorize('COMPANY_ADMIN'), enrollmentController.createEnrollment);
router.get('/enrollments/progress/:id', authorize('COMPANY_ADMIN', 'TRAINER'), enrollmentController.getStudentProgress);

// --- 6. MANUAL PAYMENTS ---
router.get('/payments', authorize('COMPANY_ADMIN'), paymentController.getPaymentsPage);
router.post('/payments/add', authorize('COMPANY_ADMIN'), paymentController.recordPayment);

// --- 7. USER MANAGEMENT ---
router.get('/users', authorize('COMPANY_ADMIN'), companyAdminController.manageUsers);
router.post('/users/add', authorize('COMPANY_ADMIN'), companyAdminController.addUser);
router.get('/users/edit/:id', authorize('COMPANY_ADMIN'), companyAdminController.getEditUserPage);
router.post('/users/edit/:id', authorize('COMPANY_ADMIN'), companyAdminController.updateUser);

// --- 8. SCHOOL SETTINGS (CONFIG) ---
router.get('/settings', authorize('COMPANY_ADMIN'), companyAdminController.getSettingsPage);
router.post('/settings/update', authorize('COMPANY_ADMIN'), companyAdminController.updateSettings);

export default router;
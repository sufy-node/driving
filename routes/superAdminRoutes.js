import express from 'express';
import { getDashboard, createCompany, toggleModule, accessCompany } from '../controllers/superAdmin.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All routes here require Super Admin role
router.use(protect, authorize('SUPER_ADMIN'));

router.get('/dashboard', getDashboard);
router.post('/companies/create', createCompany);
router.post('/companies/toggle-module', toggleModule);
router.get('/access/:companyId', accessCompany);

export default router;
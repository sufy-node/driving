import Session from '../models/Session.js';
import User from '../models/User.js';
import { catchAsync } from '../utils/appError.js';

/**
 * GET Trainer Dashboard
 * Optimized for mobile. Shows today's tasks and monthly stats.
 */
export const getTrainerDashboard = catchAsync(async (req, res, next) => {
    const companyId = req.tenant._id;
    const trainerId = req.user._id;

    // 1. Define Time Boundaries
    const now = new Date();
    const startOfToday = new Date(now.setHours(0, 0, 0, 0));
    const endOfToday = new Date(now.setHours(23, 59, 59, 999));
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 2. Fetch Data in Parallel
    const [todaysSessions, monthlyStats] = await Promise.all([
        // Today's Schedule
        Session.find({
            companyId,
            trainerId,
            date: { $gte: startOfToday, $lte: endOfToday }
        })
        .populate('studentId', 'name phone')
        .populate('vehicleId', 'name plateNumber')
        .sort({ startTime: 1 })
        .lean(),

        // Performance Stats for the current month
        Session.countDocuments({
            companyId,
            trainerId,
            date: { $gte: startOfMonth },
            status: 'PRESENT'
        })
    ]);

    res.render('company/trainerDashboard', {
        title: 'Trainer Portal',
        sessions: todaysSessions,
        completedThisMonth: monthlyStats,
        tenant: req.tenant,
        user: req.user
    });
});
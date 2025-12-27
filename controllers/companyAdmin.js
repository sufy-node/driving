import User from '../models/User.js';
import Company from '../models/Company.js';
import Session from '../models/Session.js';
import Enrollment from '../models/Enrollment.js';
import Vehicle from '../models/Vehicle.js';
import Payment from '../models/Payment.js';
import { getPaginatedRecords, updateRecord, insertRecord, findOneRecord } from '../services/dbService.js';
import { catchAsync, AppError } from '../utils/appError.js';

/**
 * GET Company Dashboard
 * The "Command Center". Now redirects Trainers to their specific portal.
 */
export const getCompanyDashboard = catchAsync(async (req, res, next) => {
    // SECURITY FIX: If user is a Trainer, don't show Admin KPIs, redirect to Trainer Portal
    if (req.user.role === 'TRAINER') {
        return res.redirect(res.locals.tenantUrl('/trainer/dashboard'));
    }

    const companyId = req.tenant._id;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
        totalStudents, totalTrainers, activeVehicles,
        activeEnrollments, todaysSessionsCount, pendingAttendanceCount
    ] = await Promise.all([
        User.countDocuments({ companyId, role: 'CUSTOMER' }),
        User.countDocuments({ companyId, role: 'TRAINER' }),
        Vehicle.countDocuments({ companyId, isActive: true }),
        Enrollment.countDocuments({ companyId, status: 'ACTIVE' }),
        Session.countDocuments({ companyId, date: { $gte: startOfToday, $lt: new Date(startOfToday.getTime() + 86400000) } }),
        Session.countDocuments({ companyId, date: { $lt: startOfToday }, status: 'PENDING' })
    ]);

    const upcomingSessions = await Session.find({ companyId, date: { $gte: startOfToday }, status: 'PENDING' })
        .populate('studentId', 'name phone').populate('trainerId', 'name')
        .sort({ date: 1, startTime: 1 }).limit(10).lean();

    res.render('company/dashboard', {
        title: `Dashboard | ${req.tenant.name}`,
        stats: { totalStudents, totalTrainers, activeVehicles, activeEnrollments, todaysSessions: todaysSessionsCount, pendingAttendanceCount },
        upcomingSessions, tenant: req.tenant, user: req.user
    });
});

/**
 * GET User Management (Paginated)
 */
export const manageUsers = catchAsync(async (req, res, next) => {
    const { page, role } = req.query;
    const query = { companyId: req.tenant._id };
    if (role) query.role = role;

    const result = await getPaginatedRecords(User, query, {
        page,
        limit: 10,
        sort: { name: 1 }
    });

    res.render('company/users', { 
        title: 'User Management', 
        users: result.data,
        pagination: result.pagination,
        tenant: req.tenant, 
        user: req.user 
    });
});

/**
 * POST Add User
 */
export const addUser = catchAsync(async (req, res, next) => {
    const { name, email, phone, password, role } = req.body;

    if (!name || !email || !password || !role) {
        return res.redirect(res.locals.tenantUrl('/users?error=Missing required fields'));
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.redirect(res.locals.tenantUrl('/users?error=Email already in use'));

    await insertRecord(User, { 
        name: name.trim(), 
        email: email.toLowerCase().trim(), 
        phone: phone.trim(),
        password, 
        role, 
        companyId: req.tenant._id 
    });

    res.redirect(res.locals.tenantUrl('/users?success=New user created successfully'));
});

/**
 * GET Edit User Page
 */
export const getEditUserPage = catchAsync(async (req, res, next) => {
    const targetUser = await findOneRecord(User, { _id: req.params.id, companyId: req.tenant._id });
    if (!targetUser) return next(new AppError('User not found', 404));

    res.render('company/editUser', { title: 'Edit User', targetUser, tenant: req.tenant, user: req.user });
});

/**
 * POST Update User
 */
export const updateUser = catchAsync(async (req, res, next) => {
    const { name, email, phone, role, isActive } = req.body;
    await updateRecord(User, { _id: req.params.id, companyId: req.tenant._id }, 
        { 
            name: name.trim(), 
            email: email.toLowerCase().trim(), 
            phone: phone.trim(),
            role, 
            isActive: isActive === 'on' 
        }
    );
    res.redirect(res.locals.tenantUrl('/users?success=User updated successfully'));
});

/**
 * GET Reports Page
 */
export const getReportsPage = catchAsync(async (req, res, next) => {
    if (!req.tenant.enabledModules?.reporting && req.user.role !== 'SUPER_ADMIN') {
        return next(new AppError("Reporting module is not enabled.", 403));
    }

    const companyId = req.tenant._id;
    const [totalLessons, completedLessons, cancelledLessons, trainerStats] = await Promise.all([
        Session.countDocuments({ companyId }),
        Session.countDocuments({ companyId, status: 'PRESENT' }),
        Session.countDocuments({ companyId, status: 'ABSENT' }),
        Session.aggregate([
            { $match: { companyId } },
            { $group: { _id: "$trainerId", count: { $sum: 1 } } },
            { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "trainer" } },
            { $unwind: "$trainer" }
        ])
    ]);

    res.render('company/reports', {
        title: 'School Analytics',
        tenant: req.tenant,
        user: req.user,
        stats: { totalLessons, completedLessons, cancelledLessons, completionRate: totalLessons > 0 ? ((completedLessons / totalLessons) * 100).toFixed(1) : 0, trainerStats }
    });
});

/**
 * GET Settings Page
 */
export const getSettingsPage = catchAsync(async (req, res, next) => {
    res.render('company/settings', { title: 'School Configuration', tenant: req.tenant, user: req.user });
});

/**
 * POST Update Settings
 */
export const updateSettings = catchAsync(async (req, res, next) => {
    const { name, primaryColor, secondaryColor, accentColor, address, phone, email } = req.body;
    await updateRecord(Company, { _id: req.tenant._id }, {
        name: name.trim(),
        primaryColor,
        secondaryColor,
        accentColor,
        'settings.address': address.trim(),
        'settings.phone': phone.trim(),
        'settings.email': email.toLowerCase().trim()
    });
    res.redirect(res.locals.tenantUrl('/settings?success=Configuration updated successfully'));
});
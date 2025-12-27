import User from '../models/User.js';
import Company from '../models/Company.js';
import Session from '../models/Session.js';
import Enrollment from '../models/Enrollment.js';
import Vehicle from '../models/Vehicle.js';
import { getPaginatedRecords, updateRecord, insertRecord, findOneRecord } from '../services/dbService.js';
import { catchAsync, AppError } from '../utils/appError.js';

/**
 * GET Company Dashboard
 * The "Command Center" for the School Admin
 */
// export const getCompanyDashboard = catchAsync(async (req, res, next) => {
//     const companyId = req.tenant._id;
    
//     // Define "Today" boundaries
//     const startOfToday = new Date();
//     startOfToday.setHours(0, 0, 0, 0);
//     const endOfToday = new Date();
//     endOfToday.setHours(23, 59, 59, 999);

//     // Parallel Execution for high-performance KPI fetching
//     const [
//         totalStudents,
//         totalTrainers,
//         activeVehicles,
//         activeEnrollments,
//         todaysSessions,
//         pendingAttendanceCount
//     ] = await Promise.all([
//         User.countDocuments({ companyId, role: 'CUSTOMER' }),
//         User.countDocuments({ companyId, role: 'TRAINER' }),
//         Vehicle.countDocuments({ companyId, isActive: true }),
//         Enrollment.countDocuments({ companyId, status: 'ACTIVE' }),
//         Session.countDocuments({ 
//             companyId, 
//             date: { $gte: startOfToday, $lte: endOfToday } 
//         }),
//         Session.countDocuments({ 
//             companyId, 
//             date: { $lt: startOfToday }, 
//             status: 'PENDING' 
//         })
//     ]);

//     // Fetch the next 5 upcoming sessions for the "Quick View"
//     const upcomingSessions = await Session.find({
//         companyId,
//         date: { $gte: startOfToday },
//         status: 'PENDING'
//     })
//     .populate('studentId', 'name')
//     .populate('trainerId', 'name')
//     .sort({ date: 1, startTime: 1 })
//     .limit(5)
//     .lean();

//     res.render('company/dashboard', {
//         title: `${req.tenant.name} | Admin Dashboard`,
//         stats: {
//             totalStudents,
//             totalTrainers,
//             activeVehicles,
//             activeEnrollments,
//             todaysSessions,
//             pendingAttendanceCount
//         },
//         upcomingSessions,
//         tenant: req.tenant, 
//         user: req.user
//     });
// });

/**
 * GET Reports Page
 */
export const getReportsPage = catchAsync(async (req, res, next) => {
    if (!req.tenant.enabledModules?.reporting && req.user.role !== 'SUPER_ADMIN') {
        return next(new AppError("Reporting module is not enabled for this school.", 403));
    }

    const companyId = req.tenant._id;

    const [totalLessons, completedLessons, cancelledLessons, trainerStats] = await Promise.all([
        Session.countDocuments({ companyId }),
        Session.countDocuments({ companyId, status: 'PRESENT' }),
        Session.countDocuments({ companyId, status: 'ABSENT' }),
        Session.aggregate([
            { $match: { companyId: companyId } },
            { $group: { _id: "$trainerId", count: { $sum: 1 } } },
            { 
                $lookup: { 
                    from: "users", 
                    localField: "_id", 
                    foreignField: "_id", 
                    as: "trainer" 
                } 
            },
            { $unwind: { path: "$trainer", preserveNullAndEmptyArrays: true } }
        ])
    ]);

    const completionRate = totalLessons > 0 ? ((completedLessons / totalLessons) * 100).toFixed(1) : 0;

    res.render('company/reports', {
        title: 'School Analytics',
        tenant: req.tenant,
        user: req.user,
        stats: {
            totalLessons,
            completedLessons,
            cancelledLessons,
            completionRate,
            trainerStats: trainerStats || []
        }
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
 * GET Edit User Page
 */
export const getEditUserPage = catchAsync(async (req, res, next) => {
    const targetUser = await findOneRecord(User, { _id: req.params.id, companyId: req.tenant._id });
    
    if (!targetUser) {
        return next(new AppError('User not found or access denied.', 404));
    }

    res.render('company/editUser', {
        title: `Edit User: ${targetUser.name}`,
        targetUser,
        tenant: req.tenant,
        user: req.user
    });
});

/**
 * POST Update User
 */
export const updateUser = catchAsync(async (req, res, next) => {
    const { name, email, role, isActive } = req.body;
    
    const updated = await updateRecord(User, 
        { _id: req.params.id, companyId: req.tenant._id }, 
        { 
            name: name.trim(), 
            email: email.toLowerCase().trim(), 
            role, 
            isActive: isActive === 'on' 
        }
    );

    if (!updated) return next(new AppError('Failed to update user.', 404));

    res.redirect(res.locals.tenantUrl('/users?success=User updated successfully'));
});

/**
 * POST Add User
 */
export const addUser = catchAsync(async (req, res, next) => {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
        return next(new AppError('Please provide all required user details', 400));
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return next(new AppError('Email already in use', 400));

    await insertRecord(User, { 
        name: name.trim(), 
        email: email.toLowerCase().trim(), 
        password, 
        role, 
        companyId: req.tenant._id 
    });

    res.redirect(res.locals.tenantUrl('/users?success=New user created successfully'));
});

/**
 * GET Settings Page
 */
export const getSettingsPage = catchAsync(async (req, res, next) => {
    res.render('company/settings', {
        title: 'School Settings',
        tenant: req.tenant,
        user: req.user
    });
});

/**
 * POST Update Settings
 */
export const updateSettings = catchAsync(async (req, res, next) => {
    const { name, primaryColor, address, phone } = req.body;
    
    await updateRecord(Company, { _id: req.tenant._id }, {
        name: name.trim(),
        primaryColor,
        'settings.address': address,
        'settings.phone': phone
    });

    res.redirect(res.locals.tenantUrl('/settings?success=School settings updated successfully'));
});


export const getCompanyDashboard = catchAsync(async (req, res, next) => {
    const companyId = req.tenant._id;
    
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Parallel Execution for KPIs
    const [
        totalStudents,
        totalTrainers,
        activeVehicles,
        activeEnrollments,
        todaysSessionsCount,
        pendingAttendanceCount
    ] = await Promise.all([
        User.countDocuments({ companyId, role: 'CUSTOMER' }),
        User.countDocuments({ companyId, role: 'TRAINER' }),
        Vehicle.countDocuments({ companyId, isActive: true }),
        Enrollment.countDocuments({ companyId, status: 'ACTIVE' }),
        Session.countDocuments({ 
            companyId, 
            date: { $gte: startOfToday, $lt: new Date(startOfToday.getTime() + 86400000) } 
        }),
        Session.countDocuments({ 
            companyId, 
            date: { $lt: startOfToday }, 
            status: 'PENDING' 
        })
    ]);

    // Fetch the next 10 upcoming sessions (Today and Future)
    // Sorted by Date first, then Time
    const upcomingSessions = await Session.find({
        companyId,
        date: { $gte: startOfToday },
        status: 'PENDING'
    })
    .populate('studentId', 'name')
    .populate('trainerId', 'name')
    .sort({ date: 1, startTime: 1 })
    .limit(10)
    .lean();

    res.render('company/dashboard', {
        title: `${req.tenant.name} | Admin Dashboard`,
        stats: {
            totalStudents,
            totalTrainers,
            activeVehicles,
            activeEnrollments,
            todaysSessions: todaysSessionsCount,
            pendingAttendanceCount
        },
        upcomingSessions,
        tenant: req.tenant, 
        user: req.user
    });
});

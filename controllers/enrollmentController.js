import Enrollment from '../models/Enrollment.js';
import Session from '../models/Session.js';
import User from '../models/User.js';
import Vehicle from '../models/Vehicle.js';
import Payment from '../models/Payment.js'; // <--- THIS WAS MISSING
import { insertRecord, getPaginatedRecords } from '../services/dbService.js';
import { catchAsync, AppError } from '../utils/appError.js';

/**
 * GET Enrollment Page
 * Fetches all necessary data for the enrollment form and paginated list
 */
export const getEnrollmentPage = catchAsync(async (req, res, next) => {
    const companyId = req.tenant._id;
    const page = req.query.page || 1;
    const limit = 10;

    // Parallel execution for high performance
    const [students, trainers, vehicles, enrollmentData] = await Promise.all([
        User.find({ companyId, role: 'CUSTOMER', isActive: true }).select('name').sort('name').lean(),
        User.find({ companyId, role: 'TRAINER', isActive: true }).select('name').sort('name').lean(),
        Vehicle.find({ companyId, isActive: true }).select('name plateNumber').sort('name').lean(),
        getPaginatedRecords(Enrollment, { companyId }, { 
            page, 
            limit, 
            populate: 'studentId trainerId vehicleId',
            sort: { createdAt: -1 }
        })
    ]);

    res.render('company/enrollments', {
        title: 'Student Enrollments',
        students,
        trainers,
        vehicles,
        enrollments: enrollmentData.data,
        pagination: enrollmentData.pagination,
        tenant: req.tenant,
        user: req.user
    });
});

/**
 * POST Create Enrollment
 * Includes 15-day conflict validation for Trainer, Vehicle, and Student
 */
export const createEnrollment = catchAsync(async (req, res, next) => {
    const { studentId, trainerId, vehicleId, planDays, startDate, startTime, endTime, skipSundays, totalPrice } = req.body;
    const companyId = req.tenant._id;

    // 1. Basic Validation
    if (!studentId || !trainerId || !vehicleId || !planDays || !startDate || !startTime || !endTime || !totalPrice) {
        return res.redirect(res.locals.tenantUrl('/enrollments?error=Please fill all required fields including Plan Price.'));
    }

    // 2. Generate the array of dates for the plan
    const sessionDates = [];
    let currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);
    const daysToGenerate = parseInt(planDays);

    while (sessionDates.length < daysToGenerate) {
        const isSunday = currentDate.getDay() === 0;
        if (!(isSunday && skipSundays === 'on')) {
            sessionDates.push(new Date(currentDate));
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }

    // 3. CONFLICT CHECK
    const conflict = await Session.findOne({
        companyId,
        date: { $in: sessionDates },
        status: { $ne: 'CANCELLED' },
        $or: [
            { trainerId: trainerId },
            { vehicleId: Number(vehicleId) },
            { studentId: studentId }
        ],
        $and: [
            { startTime: { $lt: endTime } },
            { endTime: { $gt: startTime } }
        ]
    }).populate('trainerId studentId vehicleId');

    if (conflict) {
        const entity = conflict.trainerId._id.toString() === trainerId ? `Trainer ${conflict.trainerId.name}` : 
                       conflict.vehicleId._id === Number(vehicleId) ? `Vehicle ${conflict.vehicleId.name}` : 
                       `Student ${conflict.studentId.name}`;
        
        return res.redirect(res.locals.tenantUrl(`/enrollments?error=CONFLICT: ${entity} is already busy on ${conflict.date.toDateString()} at ${conflict.startTime}`));
    }

    // 4. ATOMIC CREATION
    const enrollment = await insertRecord(Enrollment, {
        companyId,
        studentId,
        trainerId,
        vehicleId: Number(vehicleId),
        planDays: daysToGenerate,
        startDate: sessionDates[0],
        startTime,
        endTime,
        skipSundays: skipSundays === 'on',
        totalPrice: Number(totalPrice)
    });

    const sessionRecords = sessionDates.map(date => ({
        enrollmentId: enrollment._id,
        companyId,
        studentId,
        trainerId,
        vehicleId: Number(vehicleId),
        date,
        startTime,
        endTime,
        status: 'PENDING'
    }));

    await Session.insertMany(sessionRecords);

    res.redirect(res.locals.tenantUrl('/enrollments?success=Enrollment and schedule generated successfully!'));
});

/**
 * GET Student Progress History (The Digital Card)
 * Shows the full 15-day history and financial ledger for a specific enrollment
 */
export const getStudentProgress = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const companyId = req.tenant._id;

    // Parallel fetching of Enrollment, Sessions, and Payments
    const [enrollment, sessions, payments] = await Promise.all([
        Enrollment.findOne({ _id: id, companyId }).populate('studentId trainerId vehicleId').lean(),
        Session.find({ enrollmentId: id, companyId }).sort({ date: 1 }).lean(),
        Payment.find({ enrollmentId: id, companyId }).populate('recordedBy', 'name role').sort({ paymentDate: -1 }).lean()
    ]);

    if (!enrollment) {
        return next(new AppError('Enrollment record not found or access denied.', 404));
    }

    // Calculate Financials
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const balance = enrollment.totalPrice - totalPaid;

    res.render('company/studentProgress', {
        title: `Progress: ${enrollment.studentId.name}`,
        enrollment: {
            ...enrollment,
            totalPaid,
            balance
        },
        sessions,
        payments,
        tenant: req.tenant,
        user: req.user
    });
});
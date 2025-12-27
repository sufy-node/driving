import Enrollment from '../models/Enrollment.js';
import Session from '../models/Session.js';
import User from '../models/User.js';
import Vehicle from '../models/Vehicle.js';
import { insertRecord, getPaginatedRecords } from '../services/dbService.js';
import { catchAsync, AppError } from '../utils/appError.js';

export const getEnrollmentPage = catchAsync(async (req, res, next) => {
    const companyId = req.tenant._id;
    const page = req.query.page || 1;
    const limit = 10;

    const [students, trainers, vehicles, enrollmentData] = await Promise.all([
        User.find({ companyId, role: 'CUSTOMER', isActive: true }).select('name').sort('name').lean(),
        User.find({ companyId, role: 'TRAINER', isActive: true }).select('name').sort('name').lean(),
        Vehicle.find({ companyId, isActive: true }).select('name plateNumber').sort('name').lean(),
        getPaginatedRecords(Enrollment, { companyId }, { 
            page, limit, populate: 'studentId trainerId vehicleId', sort: { createdAt: -1 }
        })
    ]);

    res.render('company/enrollments', {
        title: 'Student Enrollments',
        students, trainers, vehicles,
        enrollments: enrollmentData.data,
        pagination: enrollmentData.pagination,
        tenant: req.tenant,
        user: req.user
    });
});

export const createEnrollment = catchAsync(async (req, res, next) => {
    const { studentId, trainerId, vehicleId, planDays, startDate, startTime, endTime, skipSundays, totalPrice } = req.body;
    const companyId = req.tenant._id;

    if (!studentId || !trainerId || !vehicleId || !planDays || !totalPrice) {
        return res.redirect(res.locals.tenantUrl('/enrollments?error=Missing required fields including Plan Price'));
    }

    const sessionDates = [];
    let currentDate = new Date(startDate);
    const daysToGenerate = parseInt(planDays);

    while (sessionDates.length < daysToGenerate) {
        if (!(currentDate.getDay() === 0 && skipSundays === 'on')) {
            sessionDates.push(new Date(currentDate));
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }

    const conflict = await Session.findOne({
        companyId,
        date: { $in: sessionDates },
        status: { $ne: 'CANCELLED' },
        $or: [{ trainerId }, { vehicleId: Number(vehicleId) }, { studentId }],
        $and: [{ startTime: { $lt: endTime } }, { endTime: { $gt: startTime } }]
    });

    if (conflict) {
        return res.redirect(res.locals.tenantUrl(`/enrollments?error=Schedule conflict detected.`));
    }

    const enrollment = await insertRecord(Enrollment, {
        companyId, studentId, trainerId, vehicleId: Number(vehicleId),
        planDays: daysToGenerate, startDate: new Date(startDate),
        startTime, endTime, skipSundays: skipSundays === 'on',
        totalPrice: Number(totalPrice) // Store the total cost
    });

    const sessionRecords = sessionDates.map(date => ({
        enrollmentId: enrollment._id, companyId, studentId, trainerId,
        vehicleId: Number(vehicleId), date, startTime, endTime, status: 'PENDING'
    }));

    await Session.insertMany(sessionRecords);
    res.redirect(res.locals.tenantUrl('/enrollments?success=Plan generated with price: ' + totalPrice));
});

export const getStudentProgress = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const companyId = req.tenant._id;

    // Parallel fetching of Enrollment, Sessions, and now PAYMENTS
    const [enrollment, sessions, payments] = await Promise.all([
        Enrollment.findOne({ _id: id, companyId }).populate('studentId trainerId vehicleId').lean(),
        Session.find({ enrollmentId: id, companyId }).sort({ date: 1 }).lean(),
        Payment.find({ enrollmentId: id, companyId }).populate('recordedBy', 'name').sort({ createdAt: -1 }).lean()
    ]);

    if (!enrollment) return next(new AppError('Enrollment not found', 404));

    // Calculate total paid for this specific plan
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    res.render('company/studentProgress', {
        title: `Progress: ${enrollment.studentId.name}`,
        enrollment: { ...enrollment, totalPaid, balance: enrollment.totalPrice - totalPaid },
        sessions,
        payments, // Pass the individual payment history
        tenant: req.tenant,
        user: req.user
    });
});


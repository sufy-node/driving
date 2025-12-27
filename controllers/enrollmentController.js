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
    const { studentId, trainerId, vehicleId, planDays, startDate, startTime, endTime, skipSundays } = req.body;
    const companyId = req.tenant._id;

    // 1. Generate dates
    const sessionDates = [];
    let currentDate = new Date(startDate);
    currentDate.setHours(0,0,0,0); // Normalize to midnight
    const daysToGenerate = parseInt(planDays);

    while (sessionDates.length < daysToGenerate) {
        if (!(currentDate.getDay() === 0 && skipSundays === 'on')) {
            sessionDates.push(new Date(currentDate));
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }

    // 2. STRICT CONFLICT CHECK
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

    // 3. Create
    const enrollment = await insertRecord(Enrollment, {
        companyId, studentId, trainerId, vehicleId: Number(vehicleId),
        planDays: daysToGenerate, startDate: sessionDates[0],
        startTime, endTime, skipSundays: skipSundays === 'on'
    });

    const sessionRecords = sessionDates.map(date => ({
        enrollmentId: enrollment._id, companyId, studentId, trainerId,
        vehicleId: Number(vehicleId), date, startTime, endTime, status: 'PENDING'
    }));

    await Session.insertMany(sessionRecords);
    res.redirect(res.locals.tenantUrl('/enrollments?success=Plan generated successfully!'));
});

export const getStudentProgress = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const [enrollment, sessions] = await Promise.all([
        Enrollment.findOne({ _id: id, companyId: req.tenant._id }).populate('studentId trainerId vehicleId').lean(),
        Session.find({ enrollmentId: id }).sort({ date: 1 }).lean()
    ]);
    if (!enrollment) return next(new AppError('Enrollment not found', 404));
    res.render('company/studentProgress', { title: 'Progress Card', enrollment, sessions, tenant: req.tenant, user: req.user });
});


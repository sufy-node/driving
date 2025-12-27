import Session from '../models/Session.js';
import Enrollment from '../models/Enrollment.js';
import { catchAsync, AppError } from '../utils/appError.js';

/**
 * GET Daily Schedule
 */
export const getDailySchedule = catchAsync(async (req, res, next) => {
    const companyId = req.tenant._id;
    const dateStr = req.query.date || new Date().toISOString().split('T')[0];
    const selectedDate = new Date(dateStr);
    selectedDate.setHours(0, 0, 0, 0);

    const nextDay = new Date(selectedDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const query = {
        companyId,
        date: { $gte: selectedDate, $lt: nextDay }
    };

    if (req.user.role === 'TRAINER') {
        query.trainerId = req.user._id;
    }

    const sessions = await Session.find(query)
        .populate('studentId', 'name')
        .populate('trainerId', 'name')
        .populate('vehicleId', 'name plateNumber')
        .sort({ startTime: 1 })
        .lean();

    res.render('company/attendance', {
        title: 'Daily Attendance',
        sessions,
        selectedDate: dateStr,
        tenant: req.tenant,
        user: req.user
    });
});

/**
 * POST Mark Attendance
 */
export const markAttendance = catchAsync(async (req, res, next) => {
    const { sessionId, status } = req.body;
    const companyId = req.tenant._id;

    const session = await Session.findOneAndUpdate(
        { _id: sessionId, companyId },
        { status },
        { new: true }
    );

    if (!session) return next(new AppError('Session not found', 404));

    if (status === 'ABSENT') {
        const enrollment = await Enrollment.findById(session.enrollmentId);
        const lastSession = await Session.findOne({ enrollmentId: session.enrollmentId }).sort({ date: -1 });

        let nextDate = new Date(lastSession.date);
        nextDate.setDate(nextDate.getDate() + 1);

        if (nextDate.getDay() === 0 && enrollment.skipSundays) {
            nextDate.setDate(nextDate.getDate() + 1);
        }

        await Session.create({
            enrollmentId: enrollment._id,
            companyId,
            studentId: session.studentId,
            trainerId: session.trainerId,
            vehicleId: session.vehicleId,
            date: nextDate,
            startTime: session.startTime,
            endTime: session.endTime,
            status: 'PENDING'
        });
    }

    if (status === 'PRESENT') {
        await Enrollment.findByIdAndUpdate(session.enrollmentId, { $inc: { completedDays: 1 } });
    }

    res.status(200).json({ success: true, message: 'Attendance updated' });
});

/**
 * POST Reset Attendance
 * Reverts status to PENDING and cleans up plan extensions
 */
export const resetAttendance = catchAsync(async (req, res, next) => {
    const { sessionId } = req.body;
    const companyId = req.tenant._id;

    const session = await Session.findOne({ _id: sessionId, companyId });
    if (!session) return next(new AppError('Session not found', 404));
    
    const oldStatus = session.status;
    if (oldStatus === 'PENDING') return next(new AppError('Session is already pending', 400));

    // 1. Revert Session Status
    session.status = 'PENDING';
    await session.save();

    // 2. Revert Enrollment Progress
    if (oldStatus === 'PRESENT') {
        await Enrollment.findByIdAndUpdate(session.enrollmentId, { $inc: { completedDays: -1 } });
    } 
    
    // 3. Remove the extra day if it was an absence
    if (oldStatus === 'ABSENT') {
        // Find the very last session for this enrollment that is still PENDING
        const extraSession = await Session.findOne({ 
            enrollmentId: session.enrollmentId, 
            status: 'PENDING' 
        }).sort({ date: -1 });

        if (extraSession) {
            await Session.findByIdAndDelete(extraSession._id);
        }
    }

    res.status(200).json({ success: true, message: 'Session reset to pending' });
});
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import { insertRecord, findTenantRecords } from '../services/dbService.js';

export const getBookingsPage = async (req, res) => {
    try {
        // 1. Fetch all bookings for this company
        const bookings = await Booking.find({ companyId: req.tenant._id })
            .populate('studentId', 'name')
            .populate('trainerId', 'name')
            .lean();

        // 2. Fetch trainers and students for the "New Booking" dropdowns
        const trainers = await User.find({ companyId: req.tenant._id, role: 'TRAINER' }).lean();
        const students = await User.find({ companyId: req.tenant._id, role: 'CUSTOMER' }).lean();

        res.render('company/bookings', {
            title: 'Lesson Schedule',
            bookings,
            trainers,
            students,
            tenant: req.tenant,
            user: req.user
        });
    } catch (error) {
        res.status(500).send("Error loading bookings: " + error.message);
    }
};

export const createBooking = async (req, res) => {
    try {
        const { studentId, trainerId, lessonDate, notes } = req.body;

        // Security check: Ensure module is enabled
        if (!req.tenant.enabledModules.bookings) {
            return res.status(403).send("Booking module is disabled.");
        }

        await insertRecord(Booking, {
            companyId: req.tenant._id,
            studentId,
            trainerId,
            lessonDate: new Date(lessonDate),
            notes
        });

        res.redirect(res.locals.tenantUrl('/bookings?success=Lesson Booked'));
    } catch (error) {
        res.status(500).send("Error creating booking: " + error.message);
    }
};
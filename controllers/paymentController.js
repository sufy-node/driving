import Payment from '../models/Payment.js';
import Enrollment from '../models/Enrollment.js';
import User from '../models/User.js';
import { getPaginatedRecords, insertRecord } from '../services/dbService.js';
import { catchAsync, AppError } from '../utils/appError.js';

/**
 * GET Payments Page
 * Includes Filter by Student and Audit Trail (Recorded By)
 */
export const getPaymentsPage = catchAsync(async (req, res, next) => {
    const companyId = req.tenant._id;
    const page = req.query.page || 1;
    const { studentId } = req.query; // Capture the filter from URL

    // 1. Build the query for payments
    const paymentQuery = { companyId };
    if (studentId) {
        paymentQuery.studentId = studentId;
    }

    // 2. Fetch data in parallel for performance
    const [enrollmentsRaw, allStudents, paymentData] = await Promise.all([
        // For the "Record Payment" dropdown (Active plans only)
        Enrollment.find({ companyId, status: 'ACTIVE' }).populate('studentId', 'name').lean(),
        
        // For the "Filter" dropdown (All students who have ever enrolled)
        User.find({ companyId, role: 'CUSTOMER' }).select('name').sort('name').lean(),
        
        // The actual paginated payment records
        getPaginatedRecords(Payment, paymentQuery, {
            page,
            limit: 15,
            populate: 'studentId enrollmentId recordedBy', // Populate recordedBy to get the Admin/Staff name
            sort: { paymentDate: -1 }
        })
    ]);

    // 3. Calculate balances for the "Record Payment" dropdown
    const enrollments = await Promise.all(enrollmentsRaw.map(async (e) => {
        const pms = await Payment.find({ enrollmentId: e._id, companyId });
        const totalPaid = pms.reduce((sum, p) => sum + p.amount, 0);
        return { 
            ...e, 
            totalPaid,
            balance: e.totalPrice - totalPaid 
        };
    }));

    res.render('company/payments', {
        title: 'Financial Ledger',
        payments: paymentData.data,
        pagination: paymentData.pagination,
        enrollments,
        students: allStudents, // Pass students for the filter dropdown
        selectedStudent: studentId || '',
        tenant: req.tenant,
        user: req.user
    });
});

/**
 * POST Record Payment
 * Saves the transaction and logs the ID of the person who recorded it
 */
export const recordPayment = catchAsync(async (req, res, next) => {
    const { enrollmentId, amount, method, notes, paymentDate } = req.body;
    const companyId = req.tenant._id;

    // 1. Validation
    if (!enrollmentId || !amount || !method) {
        return res.redirect(res.locals.tenantUrl('/payments?error=Please fill all required fields'));
    }

    // 2. Find the enrollment to get the studentId
    const enrollment = await Enrollment.findOne({ _id: enrollmentId, companyId });
    if (!enrollment) return next(new AppError('Enrollment not found', 404));

    // 3. Create Payment Record with Audit Trail
    await insertRecord(Payment, {
        companyId,
        enrollmentId,
        studentId: enrollment.studentId,
        amount: Number(amount),
        method,
        notes: notes ? notes.trim() : '',
        paymentDate: paymentDate || new Date(),
        recordedBy: req.user._id // This saves the ID of the logged-in Admin/Staff
    });

    res.redirect(res.locals.tenantUrl('/payments?success=Payment recorded successfully'));
});
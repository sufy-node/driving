import mongoose from 'mongoose';
import { randomUUID } from 'crypto';

const paymentSchema = new mongoose.Schema({
    _id: { type: String, default: () => randomUUID() },
    companyId: { type: Number, ref: 'Company', required: true },
    enrollmentId: { type: String, ref: 'Enrollment', required: true },
    studentId: { type: String, ref: 'User', required: true },
    amount: { type: Number, required: true },
    paymentDate: { type: Date, default: Date.now },
    method: { 
        type: String, 
        enum: ['CASH', 'ONLINE', 'BANK_TRANSFER', 'CHEQUE'], 
        default: 'CASH' 
    },
    status: { 
        type: String, 
        enum: ['PAID', 'PARTIAL', 'PENDING'], 
        default: 'PAID' 
    },
    notes: String,
    recordedBy: { type: String, ref: 'User' } // Admin who took the money
}, { timestamps: true, _id: false });

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
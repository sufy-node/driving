import mongoose from 'mongoose';
import { randomUUID } from 'crypto';

const sessionSchema = new mongoose.Schema({
    _id: { type: String, default: () => randomUUID() },
    enrollmentId: { type: String, ref: 'Enrollment', required: true },
    companyId: { type: Number, ref: 'Company', required: true },
    studentId: { type: String, ref: 'User', required: true },
    trainerId: { type: String, ref: 'User', required: true },
    vehicleId: { type: Number, ref: 'Vehicle', required: true },
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    status: { 
        type: String, 
        enum: ['PENDING', 'PRESENT', 'ABSENT', 'CANCELLED'], 
        default: 'PENDING' 
    },
    notes: String
}, { timestamps: true, _id: false });

const Session = mongoose.model('Session', sessionSchema);
export default Session;
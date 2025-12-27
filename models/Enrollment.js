import mongoose from 'mongoose';
import { randomUUID } from 'crypto';

const enrollmentSchema = new mongoose.Schema({
    _id: { type: String, default: () => randomUUID() },
    companyId: { type: Number, ref: 'Company', required: true },
    studentId: { type: String, ref: 'User', required: true },
    trainerId: { type: String, ref: 'User', required: true },
    vehicleId: { type: Number, ref: 'Vehicle', required: true },
    planDays: { type: Number, required: true }, // 10, 15, 20 etc.
    completedDays: { type: Number, default: 0 },
    startTime: { type: String, required: true }, // e.g., "09:00"
    endTime: { type: String, required: true },   // e.g., "09:30"
    startDate: { type: Date, required: true },
    status: { type: String, enum: ['ACTIVE', 'COMPLETED', 'CANCELLED'], default: 'ACTIVE' },
    skipSundays: { type: Boolean, default: true }
}, { timestamps: true, _id: false });

const Enrollment = mongoose.model('Enrollment', enrollmentSchema);
export default Enrollment;
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';

const bookingSchema = new mongoose.Schema({
    _id: { type: String, default: () => randomUUID() }, // UUID for bookings
    companyId: { type: Number, ref: 'Company', required: true },
    studentId: { type: String, ref: 'User', required: true },
    trainerId: { type: String, ref: 'User', required: true },
    lessonDate: { type: Date, required: true },
    duration: { type: Number, default: 60 }, // Duration in minutes
    status: { 
        type: String, 
        enum: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'], 
        default: 'PENDING' 
    },
    notes: String
}, { timestamps: true, _id: false });

const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;
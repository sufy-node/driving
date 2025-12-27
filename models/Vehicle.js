import mongoose from 'mongoose';

const vehicleSchema = new mongoose.Schema({
    _id: { type: Number }, // We will use auto-increment for vehicles too
    companyId: { type: Number, ref: 'Company', required: true },
    name: { type: String, required: true }, // e.g., "Red Toyota Swift"
    plateNumber: { type: String, required: true },
    isActive: { type: Boolean, default: true }
}, { timestamps: true, _id: false });

const Vehicle = mongoose.model('Vehicle', vehicleSchema);
export default Vehicle;
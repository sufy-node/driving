import mongoose from 'mongoose';

const companySchema = new mongoose.Schema({
    _id: { type: Number }, // Integer ID
    name: { type: String, required: true },
    subdomain: { type: String, required: true, unique: true, lowercase: true },
    logo: { type: String, default: 'default-logo.png' },
    primaryColor: { type: String, default: '#3498db' },
    isActive: { type: Boolean, default: true },
    enabledModules: {
        payments: { type: Boolean, default: false },
        bookings: { type: Boolean, default: true },
        reporting: { type: Boolean, default: false }
    },
    settings: {
        address: String,
        phone: String,
        email: String
    }
}, { timestamps: true, _id: false }); // Disable automatic ObjectId

const Company = mongoose.model('Company', companySchema);
export default Company;
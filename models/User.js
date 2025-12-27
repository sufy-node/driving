import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const userSchema = new mongoose.Schema({
    _id: { type: String, default: () => randomUUID() }, // UUID for security
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true }, // Added for Trainer/Student communication
    password: { type: String, required: true, select: false }, // Hidden by default for security
    role: { 
        type: String, 
        enum: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'TRAINER', 'DRIVER', 'CUSTOMER', 'STAFF'],
        required: true 
    },
    companyId: { 
        type: Number, // Matches Company Integer _id
        ref: 'Company',
        default: null 
    },
    isActive: { type: Boolean, default: true }
}, { timestamps: true, _id: false });

// Production Security: Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Security: Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const userSchema = new mongoose.Schema({
    _id: { type: String, default: () => randomUUID() }, // UUID
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
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

userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
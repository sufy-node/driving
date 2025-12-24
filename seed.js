import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Company from './models/Company.js';
import Counter from './models/Counter.js';
import connectDB from './config/db.js';
import { insertCompany } from './services/dbService.js';

dotenv.config();

const seedData = async () => {
    try {
        await connectDB();

        // Clear everything
        await User.deleteMany({});
        await Company.deleteMany({});
        await Counter.deleteMany({});

        console.log('Database cleared. Starting seed with UUIDs and Integer IDs...');

        // 1. Create Super Admin (UUID generated automatically)
        const superAdmin = await User.create({
            name: 'Global Admin',
            email: 'admin@saas.com',
            password: '123',
            role: 'SUPER_ADMIN'
        });
        console.log('Super Admin created with UUID:', superAdmin._id);

        // 2. Create Companies using the Auto-Increment helper
        const company1 = await insertCompany(Company, {
            name: 'Elite Driving Academy',
            subdomain: 'elite',
            primaryColor: '#27ae60',
            enabledModules: { payments: true, bookings: true }
        });
        console.log('Company 1 created with Integer ID:', company1._id);

        const company2 = await insertCompany(Company, {
            name: 'Safe Start Motors',
            subdomain: 'safestart',
            primaryColor: '#e67e22',
            enabledModules: { payments: false, bookings: true }
        });
        console.log('Company 2 created with Integer ID:', company2._id);

        // 3. Create Users linked to Integer IDs
        await User.create([
            {
                name: 'Elite Admin',
                email: 'admin@elite.com',
                password: '123',
                role: 'COMPANY_ADMIN',
                companyId: company1._id
            },
            {
                name: 'Safe Admin',
                email: 'admin@safestart.com',
                password: '123',
                role: 'COMPANY_ADMIN',
                companyId: company2._id
            }
        ]);

        console.log('Seeding complete. All IDs are now UUID (Users) or Auto-Inc Integer (Companies).');
        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

seedData();
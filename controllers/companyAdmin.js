import User from '../models/User.js';
import { findTenantRecords, insertRecord } from '../services/dbService.js';

export const getCompanyDashboard = async (req, res) => {
    try {
        // Data isolation: Only fetch users for THIS company
        const trainers = await User.countDocuments({ companyId: req.tenant._id, role: 'TRAINER' });
        const students = await User.countDocuments({ companyId: req.tenant._id, role: 'CUSTOMER' });

        res.render('company/dashboard', {
            title: `${req.tenant.name} Dashboard`,
            stats: { trainers, students },
            // req.tenant is populated by identifyTenant middleware
            tenant: req.tenant, 
            user: req.user
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error loading company dashboard");
    }
};

export const manageUsers = async (req, res) => {
    try {
        const users = await findTenantRecords(User, req.tenant._id);
        res.render('company/users', { 
            title: 'Manage Users', 
            users,
            tenant: req.tenant,
            user: req.user
        });
    } catch (error) {
        res.status(500).send("Error loading users");
    }
};

export const addUser = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        
        if (role === 'SUPER_ADMIN') return res.status(403).send('Forbidden');

        await insertRecord(User, {
            name,
            email,
            password,
            role,
            companyId: req.tenant._id 
        });

        res.redirect(res.locals.tenantUrl('/users'));
    } catch (error) {
        res.status(500).send('Error creating user: ' + error.message);
    }
};
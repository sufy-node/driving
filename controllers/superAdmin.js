import Company from '../models/Company.js';
import User from '../models/User.js';
import { insertCompany, insertRecord, findRecords, updateRecord } from '../services/dbService.js';

export const getDashboard = async (req, res) => {
    try {
        const companies = await findRecords(Company);
        const totalUsers = await User.countDocuments({ role: { $ne: 'SUPER_ADMIN' } });
        
        res.render('superadmin/dashboard', { 
            title: 'Super Admin Insights',
            companies,
            totalUsers,
            success: req.query.success || null
        });
    } catch (error) {
        res.status(500).send("Error loading dashboard");
    }
};

export const createCompany = async (req, res) => {
    try {
        const { name, subdomain, adminEmail, adminPassword } = req.body;

        const newCompany = await insertCompany(Company, { 
            name, 
            subdomain: subdomain.toLowerCase().trim(),
            enabledModules: { payments: false, bookings: true, reporting: false }
        });

        await insertRecord(User, {
            name: `${name} Admin`,
            email: adminEmail,
            password: adminPassword,
            role: 'COMPANY_ADMIN',
            companyId: newCompany._id 
        });

        res.redirect('/superadmin/dashboard?success=Company Created Successfully');
    } catch (error) {
        res.status(500).send("Error: " + error.message);
    }
};

/**
 * AJAX Toggle for Modules
 */
export const toggleModule = async (req, res) => {
    try {
        const { companyId, moduleName, status } = req.body;
        
        // IMPORTANT: Cast companyId to Number because of our new ID structure
        const query = { _id: Number(companyId) };
        
        // Ensure status is a proper boolean
        const isEnabled = status === true || status === 'true';
        
        const updateData = { 
            [`enabledModules.${moduleName}`]: isEnabled 
        };
        
        const updated = await updateRecord(Company, query, updateData);
        
        if (!updated) {
            return res.status(404).json({ success: false, message: "Company not found" });
        }

        res.json({ success: true, message: `Module ${moduleName} updated` });
    } catch (error) {
        console.error("Toggle Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const accessCompany = async (req, res) => {
    try {
        const { companyId } = req.params;
        const company = await Company.findById(Number(companyId));
        if (!company) return res.status(404).send("Company not found");

        res.redirect(`/c/${company.subdomain}/dashboard`);
    } catch (error) {
        res.status(500).send("Error accessing company");
    }
};
import Company from '../models/Company.js';
import User from '../models/User.js';
import Session from '../models/Session.js';
import Enrollment from '../models/Enrollment.js';
import { insertCompany, insertRecord, findRecords, updateRecord, findOneRecord } from '../services/dbService.js';
import { catchAsync } from '../utils/appError.js';

/**
 * GET Super Admin Dashboard
 * Redesigned for high-level SaaS insights
 */
export const getDashboard = catchAsync(async (req, res, next) => {
    // Parallel execution for massive performance boost
    const [
        companies, 
        totalUsers, 
        totalSessions, 
        activeEnrollments,
        recentCompanies
    ] = await Promise.all([
        findRecords(Company),
        User.countDocuments({ role: { $ne: 'SUPER_ADMIN' } }),
        Session.countDocuments(),
        Enrollment.countDocuments({ status: 'ACTIVE' }),
        Company.find().sort({ createdAt: -1 }).limit(5).lean()
    ]);

    // Calculate Module Adoption Rates
    const totalCount = companies.length || 1;
    const moduleStats = {
        payments: ((await Company.countDocuments({ 'enabledModules.payments': true })) / totalCount * 100).toFixed(0),
        bookings: ((await Company.countDocuments({ 'enabledModules.bookings': true })) / totalCount * 100).toFixed(0),
        reporting: ((await Company.countDocuments({ 'enabledModules.reporting': true })) / totalCount * 100).toFixed(0)
    };

    res.render('superadmin/dashboard', { 
        title: 'Global System Overview',
        companies,
        recentCompanies,
        stats: {
            totalUsers,
            totalSessions,
            activeEnrollments,
            totalCompanies: companies.length,
            moduleStats
        },
        success: req.query.success || null
    });
});

export const createCompany = catchAsync(async (req, res, next) => {
    const { name, subdomain, adminEmail, adminPassword } = req.body;

    // Validation
    const existing = await Company.findOne({ subdomain: subdomain.toLowerCase().trim() });
    if (existing) return res.redirect('/superadmin/dashboard?error=Subdomain already exists');

    const newCompany = await insertCompany(Company, { 
        name: name.trim(), 
        subdomain: subdomain.toLowerCase().trim(),
        enabledModules: { payments: false, bookings: true, reporting: false }
    });

    await insertRecord(User, {
        name: `${name} Admin`,
        email: adminEmail.toLowerCase().trim(),
        password: adminPassword,
        role: 'COMPANY_ADMIN',
        companyId: newCompany._id 
    });

    res.redirect('/superadmin/dashboard?success=New school onboarded successfully');
});

export const toggleModule = catchAsync(async (req, res, next) => {
    const { companyId, moduleName, status } = req.body;
    const isEnabled = status === true || status === 'true';
    
    await updateRecord(Company, { _id: Number(companyId) }, { 
        [`enabledModules.${moduleName}`]: isEnabled 
    });
    
    res.json({ success: true, message: `Module ${moduleName} updated` });
});

export const accessCompany = catchAsync(async (req, res, next) => {
    const { companyId } = req.params;
    const company = await findOneRecord(Company, { _id: Number(companyId) });
    if (!company) return res.status(404).render('error', { message: "Company not found" });
    res.redirect(`/c/${company.subdomain}/dashboard`);
});
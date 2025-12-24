import Company from '../models/Company.js';
import { findOneRecord } from '../services/dbService.js';

export const identifyTenant = async (req, res, next) => {
    // We look for /c/:companySlug in the URL
    const pathParts = req.path.split('/');
    
    // If the URL starts with /c/ we extract the next part as the company slug
    if (pathParts[1] === 'c' && pathParts[2]) {
        const slug = pathParts[2].toLowerCase();
        
        try {
            const company = await findOneRecord(Company, { subdomain: slug, isActive: true });
            
            if (!company) {
                return res.status(404).render('error', { message: 'Driving School not found' });
            }

            req.tenant = company;
            res.locals.tenant = company; // For EJS
            req.isMainDomain = false;
            
            // Helper to build URLs easily in EJS
            res.locals.tenantUrl = (path) => `/c/${slug}${path}`;
            
            return next();
        } catch (error) {
            return next(error);
        }
    }

    // If not a company path, it's a global path (Super Admin or Landing)
    req.isMainDomain = true;
    next();
};
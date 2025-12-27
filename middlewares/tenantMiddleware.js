import Company from '../models/Company.js';
import { findOneRecord } from '../services/dbService.js';

export const identifyTenant = async (req, res, next) => {
    // 1. Try to get slug from params (Express standard)
    // 2. Fallback: Extract from path manually if params are empty
    let slug = req.params.companySlug;
    
    if (!slug) {
        const parts = req.path.split('/');
        if (parts[1] === 'c' && parts[2]) {
            slug = parts[2];
        }
    }

    if (!slug) {
        req.isMainDomain = true;
        return next();
    }

    try {
        const company = await findOneRecord(Company, { subdomain: slug.toLowerCase(), isActive: true });
        
        if (!company) {
            return res.status(404).render('error', { 
                title: 'School Not Found', 
                message: 'The driving school you are looking for does not exist.' 
            });
        }

        // Attach company info
        req.tenant = company;
        res.locals.tenant = company; 
        req.isMainDomain = false;
        
        // Helper for URLs
        res.locals.tenantUrl = (path) => `/c/${slug}${path}`;
        
        next();
    } catch (error) {
        next(error);
    }
};
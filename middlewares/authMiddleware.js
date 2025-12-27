import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Company from '../models/Company.js';
import { findOneRecord } from '../services/dbService.js';

// 1. Force Authentication (for protected routes)
export const protect = async (req, res, next) => {
    let token = req.cookies.jwt;

    if (!token) {
        return res.redirect('/auth/login');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await findOneRecord(User, { _id: decoded.id });

        if (!user) return res.redirect('/auth/login');

        // Security Check: Ensure user belongs to the current tenant
        // SUPER_ADMIN is allowed to enter ANY company path
        if (!req.isMainDomain && user.role !== 'SUPER_ADMIN') {
            if (user.companyId !== req.tenant._id) {
                return res.status(403).send('Unauthorized access: This account does not belong to this school.');
            }
        }

        req.user = user;
        res.locals.user = user;
        next();
    } catch (error) {
        res.clearCookie('jwt');
        return res.redirect('/auth/login');
    }
};

// 2. Just check if user exists (for UI/Navbars/Error pages)
export const checkUser = async (req, res, next) => {
    const token = req.cookies.jwt;
    res.locals.user = null;

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id).lean();
            if (user) {
                req.user = user;
                res.locals.user = user;
                
                // If they are a company user, attach the tenant URL helper
                if (user.companyId) {
                    const company = await Company.findById(user.companyId).lean();
                    if (company) {
                        res.locals.tenant = company;
                        res.locals.tenantUrl = (path) => `/c/${company.subdomain}${path}`;
                    }
                }
            }
        } catch (err) {
            res.locals.user = null;
        }
    }
    next();
};

// 3. Role-Based Access Control (RBAC)
export const authorize = (...roles) => {
    return (req, res, next) => {
        // GOD MODE: If user is SUPER_ADMIN, they can access EVERYTHING
        if (req.user.role === 'SUPER_ADMIN') {
            return next();
        }

        // Otherwise, check if their role is in the allowed list
        if (!roles.includes(req.user.role)) {
            return res.status(403).render('error', { 
                title: 'Access Denied', 
                message: 'You do not have permission to perform this action.' 
            });
        }
        next();
    };
};
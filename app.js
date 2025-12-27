import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import expressLayouts from 'express-ejs-layouts';

// Database & Utilities
import connectDB from './config/db.js';
import { AppError } from './utils/appError.js';
import { identifyTenant } from './middlewares/tenantMiddleware.js';
import { checkUser } from './middlewares/authMiddleware.js';

// Route Imports
import authRoutes from './routes/authRoutes.js';
import superAdminRoutes from './routes/superAdminRoutes.js';
import companyRoutes from './routes/companyRoutes.js';

dotenv.config();
connectDB();

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- 1. GLOBAL SECURITY & PERFORMANCE ---
app.use(helmet({ contentSecurityPolicy: false })); // XSS & Security Headers
app.use(mongoSanitize()); // NoSQL Injection Protection
app.use(compression()); // Gzip compression for faster page loads

if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev')); // Request logging
}

// Rate Limiting: Prevent Brute Force on Auth
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 login requests per window
    message: 'Too many login attempts, please try again after 15 minutes'
});
app.use('/auth/login', loginLimiter);

app.use(express.json({ limit: '10kb' })); 
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// --- 2. VIEW ENGINE SETUP ---
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/main');
app.use(express.static(path.join(__dirname, 'public')));

// --- 3. GLOBAL CONTEXT ---
app.use((req, res, next) => {
    res.locals.req = req;
    res.locals.success = req.query.success || null;
    res.locals.error = req.query.error || null;
    next();
});

app.use(checkUser);

// --- 4. ROUTES ---
app.use('/auth', authRoutes);
app.use('/superadmin', superAdminRoutes);
app.use('/c/:companySlug', identifyTenant, companyRoutes);

// Root Redirect
app.get('/', (req, res) => {
    if (res.locals.user) {
        if (res.locals.user.role === 'SUPER_ADMIN') return res.redirect('/superadmin/dashboard');
        if (res.locals.tenant) return res.redirect(`/c/${res.locals.tenant.subdomain}/dashboard`);
    }
    res.render('landing', { title: 'Welcome to Driving SaaS' });
});

// --- 5. ERROR HANDLING ---
app.all('*', (req, res, next) => {
    next(new AppError(`The page ${req.originalUrl} does not exist.`, 404));
});

app.use((err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    
    // Production Error Handling: Redirect POST errors back to form with Toast
    if (req.method === 'POST' && err.isOperational) {
        const referer = req.header('Referer') || '/';
        const url = new URL(referer, `http://${req.headers.host}`);
        url.searchParams.set('error', err.message);
        return res.redirect(url.pathname + url.search);
    }

    res.status(err.statusCode).render('error', {
        title: 'System Error',
        message: err.isOperational ? err.message : 'An unexpected error occurred. Please try again later.',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Production Server running on port ${PORT}`);
});
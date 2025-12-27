import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
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

// 1. SECURITY MIDDLEWARES
app.use(helmet({ contentSecurityPolicy: false })); 
app.use(mongoSanitize());
app.use(express.json({ limit: '10kb' })); 
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// 2. VIEW ENGINE SETUP
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/main');
app.use(express.static(path.join(__dirname, 'public')));

// 3. GLOBAL MESSAGE & CONTEXT MIDDLEWARE
// This is the "Engine" for your Toasts
app.use((req, res, next) => {
    // Capture messages from Query Strings (for Redirects)
    // or from res.locals (for direct Renders)
    res.locals.success = req.query.success || res.locals.success || null;
    res.locals.error = req.query.error || res.locals.error || null;
    res.locals.req = req;
    next();
});

// 4. AUTHENTICATION
app.use(checkUser);

// 5. ROUTES
app.use('/auth', authRoutes);
app.use('/superadmin', superAdminRoutes);
app.use('/c/:companySlug', identifyTenant, companyRoutes);

app.get('/', (req, res) => {
    if (res.locals.user) {
        if (res.locals.user.role === 'SUPER_ADMIN') return res.redirect('/superadmin/dashboard');
        if (res.locals.tenant) return res.redirect(`/c/${res.locals.tenant.subdomain}/dashboard`);
    }
    res.render('landing', { title: 'Welcome' });
});

// 6. ERROR HANDLERS
app.all('*', (req, res, next) => {
    next(new AppError(`Page ${req.originalUrl} not found`, 404));
});

app.use((err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    // In production, we redirect back with an error toast instead of showing a crash page
    if (req.method === 'POST' && err.isOperational) {
        const redirectUrl = req.header('Referer') || '/';
        const separator = redirectUrl.includes('?') ? '&' : '?';
        return res.redirect(`${redirectUrl}${separator}error=${encodeURIComponent(err.message)}`);
    }
    
    res.status(err.statusCode).render('error', {
        title: 'Error',
        message: err.message
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
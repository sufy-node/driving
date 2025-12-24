import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import path from 'path';
import { fileURLToPath } from 'url';
import expressLayouts from 'express-ejs-layouts';

import connectDB from './config/db.js';
import { identifyTenant } from './middlewares/tenantMiddleware.js';
import superAdminRoutes from './routes/superAdminRoutes.js';
import authRoutes from './routes/authRoutes.js';
import companyRoutes from './routes/companyRoutes.js'; 

dotenv.config();
connectDB();

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Security & Middleware
app.use(helmet({ contentSecurityPolicy: false })); // CSP disabled for easier EJS development
app.use(mongoSanitize());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
import { checkUser } from './middlewares/authMiddleware.js'; // Add this import at top
app.use(checkUser); // Add this line

// View Engine
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/main');

// Static Files
app.use(express.static(path.join(__dirname, 'public')));

// Multi-Tenancy Middleware
app.use(identifyTenant);

// Routes
app.use('/auth', authRoutes);
app.use('/superadmin', superAdminRoutes);

// // Root Route
// app.get('/', (req, res) => {
//     if (req.isMainDomain) {
//         res.render('landing', { title: 'Welcome to SaaS' });
//     } else {
//         res.render('company/login', { title: req.tenant.name, layout: 'layouts/company_layout' });
//     }
// });

// 2. Company-Specific Routes (With company context)
// All routes inside companyRoutes will now be prefixed with /c/:companySlug
app.use('/c/:companySlug', (req, res, next) => {
    // This ensures the identifyTenant middleware has run
    if (!req.tenant) return res.status(404).send("School not found");
    next();
}, companyRoutes);

// Root Route
// app.get('/', (req, res) => {
//     // If user is already logged in via cookie, try to redirect them home
//     if (req.cookies.jwt) {
//         return res.redirect('/auth/login'); // The login logic will handle the redirect
//     }
//     res.render('landing', { title: 'Welcome to Driving SaaS' });
// });

// Root Route: Intelligent Redirect
app.get('/', (req, res) => {
    if (res.locals.user) {
        if (res.locals.user.role === 'SUPER_ADMIN') {
            return res.redirect('/superadmin/dashboard');
        }
        if (res.locals.tenant) {
            return res.redirect(`/c/${res.locals.tenant.subdomain}/dashboard`);
        }
    }
    res.render('landing', { title: 'Welcome to Driving SaaS' });
});


const PORT = process.env.PORT || 3000;

// 404 Handler
app.use((req, res) => {
    res.status(404).render('error', { title: '404 Not Found', message: 'Page not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).render('error', { 
        title: 'Error', 
        message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message 
    });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
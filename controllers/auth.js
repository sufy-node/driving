import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Company from '../models/Company.js'; // Added to find the slug

const signToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '1d' });
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // 1. Find user and include password for comparison
        const user = await User.findOne({ email }).select('+password'); 

        if (!user || !(await user.comparePassword(password))) {
            return res.render('login', { 
                title: 'Login', 
                layout: 'layouts/full-width', 
                error: 'Invalid email or password' 
            });
        }

        // 2. Generate Token
        const token = signToken(user._id);
        res.cookie('jwt', token, { 
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Lax'
        });

        // 3. Redirect based on role
        if (user.role === 'SUPER_ADMIN') {
            return res.redirect('/superadmin/dashboard');
        }

        // 4. For Company Users: Find their company slug to build the URL
        const company = await Company.findById(user.companyId);
        if (!company) {
            return res.status(404).send("Your account is not linked to an active company.");
        }

        // Redirect to /c/slug/dashboard
        res.redirect(`/c/${company.subdomain}/dashboard`);

    } catch (error) {
        console.error("Login Error:", error);
        res.render('login', { 
            title: 'Login', 
            layout: 'layouts/full-width', 
            error: 'An error occurred during login.' 
        });
    }
};

export const logout = (req, res) => {
    res.clearCookie('jwt');
    res.redirect('/auth/login');
};
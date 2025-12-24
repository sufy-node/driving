import express from 'express';
import { login, logout } from '../controllers/auth.js';

const router = express.Router();

router.get('/login', (req, res) => {
    // If already logged in, redirect home (which now handles dashboard routing)
    if (res.locals.user) {
        return res.redirect('/');
    }
    res.render('login', { title: 'Login', layout: 'layouts/full-width' });
});

router.post('/login', login);
router.get('/logout', logout);

export default router;
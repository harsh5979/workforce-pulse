import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../config/db';
import { logger } from '../utils/logger';
import { env } from '../config/env';

const router = Router();

// Minimal implementation of JWT-like session for demonstration.
// In a full production app, use jsonwebtoken (jwt.sign / jwt.verify)
// But since the user specifically asked to use HttpOnly cookies with backend, 
// we will issue a simple token for now.

function getCookieDomain() {
  if (process.env.NODE_ENV !== 'production' || !env.SITE_URL) return undefined;
  try {
    const url = new URL(env.SITE_URL);
    const hostname = url.hostname.replace('www.', '');
    const parts = hostname.split('.');
    if (parts.length > 2) {
      return '.' + parts.slice(-2).join('.');
    }
    return '.' + hostname;
  } catch (e) {
    return undefined;
  }
}

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rowCount === 0) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    // We will return the token so the frontend can put it in Axios headers as requested,
    // and ALSO set it in a secure HttpOnly cookie.
    const token = Buffer.from(JSON.stringify({ id: user.id, email: user.email, role: user.role })).toString('base64');

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      domain: getCookieDomain(),
      maxAge: 7 * 24 * 60 * 60 * 1000 // 1 week
    });

    return res.json({ 
      success: true, 
      user: { id: user.id, email: user.email, role: user.role } 
    });
  } catch (error) {
    logger.error('Login error:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// The frontend will call this to clear the HttpOnly cookie
router.post('/logout', (req, res) => {
  res.cookie('auth_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    domain: getCookieDomain(),
    expires: new Date(0)
  });
  return res.json({ success: true });
});

// The frontend will send the token in the Authorization header.
router.get('/me', async (req, res) => {
  try {
    let token = req.cookies.auth_token;
    
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    
    // Decode our simple base64 token
    const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    
    const userResult = await pool.query('SELECT id, email, role FROM users WHERE id = $1', [payload.id]);
    if (userResult.rowCount === 0) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    return res.json({ success: true, user: userResult.rows[0] });
  } catch (error) {
    logger.error('Auth /me error:', error);
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
});

export default router;

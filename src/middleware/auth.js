import { verifyToken } from '../utils/jwt.js';
import { error } from '../utils/response.js';

const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return error(res, 'No token provided', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    req.user = decoded; // { id, username, email }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return error(res, 'Token expired, please log in again', 401);
    }
    return error(res, 'Invalid token', 401);
  }
};

export { authenticate };

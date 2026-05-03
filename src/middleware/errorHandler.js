import logger from '../utils/logger.js';

const errorHandler = (err, req, res, next) => {
  logger.error(err.message, { stack: err.stack, path: req.path });

  if (err.code === '23505') { // PostgreSQL unique violation
    return res.status(409).json({ success: false, message: 'Resource already exists' });
  }
  if (err.code === '23503') { // Foreign key violation
    return res.status(400).json({ success: false, message: 'Referenced resource not found' });
  }

  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;

  return res.status(statusCode).json({ success: false, message });
};

export default errorHandler;

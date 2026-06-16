const jwt = require('jsonwebtoken');
module.exports = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ error: 'No token. Please log in.' });
  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET || 'dev-secret');
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    next();
  } catch(e) {
    res.status(401).json({ error: 'Token expired. Please log in again.' });
  }
};

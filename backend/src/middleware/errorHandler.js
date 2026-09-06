function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.code === '23505') {
    return res.status(409).json({ error: 'A record with these details already exists' });
  }
  if (err.code === '23503') {
    return res.status(409).json({ error: 'This action conflicts with related records' });
  }

  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Something went wrong on the server' });
}

module.exports = errorHandler;
// Centralized error handler. Controllers that don't need a custom error
// response just do `catch (err) { next(err); }` and this takes care of
// logging it and sending a consistent JSON response, instead of every
// controller repeating its own res.status(500).json({...}) block.
module.exports = (err, req, res, next) => {
    console.error(`[${req.method} ${req.originalUrl}]`, err);

    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Something went wrong' });
};
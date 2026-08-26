class AppError extends Error {
    constructor(msg, statusCode, field = null) {
        super(msg);

        this.statusCode = statusCode;
        this.field = field; // OPTIONAL: which form field caused the error
        this.error = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true; // KNOWN/EXPECTED ERROR — SAFE TO EXPOSE MESSAGE

        Error.captureStackTrace(this, this.constructor);
    }
}

export default AppError
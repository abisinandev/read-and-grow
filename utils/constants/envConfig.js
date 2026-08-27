import dotenv from 'dotenv';
dotenv.config();

const REQUIRED_ENV_VARS = [
    'PORT',
    'MONGO_URI',
    'JWT_SECRET',
    'JWT_EXPIRES',
    'SESSION_SECRET',
    // 'MAIL_USER',
    // 'MAIL_PASS',
    // 'GOOGLE_CLIENT_ID',
    // 'GOOGLE_CLIENT_SECRET',
    // 'GOOGLE_CALLBACK_URL',
    // 'CLOUDINARY_CLOUD_NAME',
    // 'CLOUDINARY_API_KEY',
    // 'CLOUDINARY_API_SECRET',
];

// Validate envs
for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar]) {
        console.error(`🚨 FATAL ERROR: Missing required environment variable: ${envVar}`);
        process.exit(1);
    }
}

export const CONFIG = {
    PORT: process.env.PORT || 3999,
    MONGO_URI: process.env.MONGO_URI,

    // Auth & JWT
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES: process.env.JWT_EXPIRES || '1d',
    SESSION_SECRET: process.env.SESSION_SECRET || 'fallback_secret',

    // Email
    MAIL_USER: process.env.MAIL_USER,
    MAIL_PASS: process.env.MAIL_PASS,

    // Google OAuth
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3999/auth/google/callback',

    // Base URL
    BASE_URL: process.env.BASE_URL || 'http://localhost:3999',

    // Cloudinary (if used later)
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
};

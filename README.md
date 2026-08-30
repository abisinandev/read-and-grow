# Read & Grow 📚

An ecommerce web app for selling best-selling books, built with Node.js and Express using the MVC pattern.

## Features
- User authentication (email/password + Google OAuth)
- Product browsing, cart, and checkout
- Razorpay payment integration
- Order invoices (PDF) and admin sales reports (Excel)
- Image uploads via Cloudinary
- Email/OTP verification with Nodemailer

## Tech Stack
- **Backend:** Node.js, Express
- **View Engine:** EJS
- **Database:** MongoDB (Mongoose)
- **Architecture:** MVC
- **Payments:** Razorpay
- **Auth:** Passport.js (Google OAuth), JWT, bcrypt

## Getting Started
```bash
npm install
npm run dev   # development (nodemon)
npm start     # production
```

Configure environment variables in a `.env` file (MongoDB URI, Razorpay keys, Cloudinary credentials, Google OAuth credentials, mail credentials, etc.).

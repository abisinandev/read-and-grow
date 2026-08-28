import mongoose from "mongoose";
import nodemailer from "nodemailer"
import mailSender from "../utils/mailSender.js";
import { OTP_EXPIRY_SECONDS } from "../utils/constants/otp.js";
const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true
    },
    otp: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: OTP_EXPIRY_SECONDS,
    },

})


async function sendVerficationEmail(email, otp) {
    try {

        const title = `Verfication Email`
        const mailResponse = await mailSender(
            email,
            title,
            `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OTP Verification - Read & Grow</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            background-color: #000000;
            margin: 0;
            padding: 0;
            color: #ffffff;
        }
        .container {
            max-width: 500px;
            background-color: #111111;
            margin: 40px auto;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 6px 20px rgba(255, 0, 0, 0.3);
            text-align: center;
            border-top: 5px solidrgb(106, 106, 106);
        }
        .logo {
            width: 120px;
            margin-bottom: 20px;
        }
        .header {
            font-size: 24px;
            font-weight: bold;
            color:rgb(255, 255, 255);
        }
        .otp-box {
            display: inline-block;
            background-color:rgb(17, 204, 145);
            color: #ffffff;
            font-size: 26px;
            font-weight: bold;
            padding: 12px 25px;
            border-radius: 8px;
            margin: 25px 0;
            letter-spacing: 4px;
            box-shadow: 0 4px 10px rgba(255, 0, 0, 0.5);
        }
        .message {
            font-size: 16px;
            color: #bbbbbb;
            margin-bottom: 20px;
            line-height: 1.5;
        }
        .footer {
            font-size: 14px;
            color:rgb(255, 255, 255);
            margin-top: 30px;
        }
        .footer a {
            color: #ff3b3b;
            text-decoration: none;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="container">
        <img src="https://via.placeholder.com/120/000000/ff3b3b?text=Read+%26+Grow" alt="Read & Grow Logo" class="logo">
        <div class="header">Your OTP Code</div>
        <p class="message">Use the code below to verify your email. This OTP is valid for <strong>${Math.round(OTP_EXPIRY_SECONDS / 60)} minutes</strong>.</p>
        <div class="otp-box">${otp}</div>
        <p class="message">If you did not request this OTP, please ignore this email or contact support.</p>
        <div class="footer">
            Need help? <a href="#">Contact Support</a><br>
            &copy; 2025 Read & Grow. All rights reserved.
        </div>
    </div>
</body>
</html>`
        )

        console.log(`Email sent Successfully : ${mailResponse}`)
    } catch (error) {

        console.log(`OTP verification failed ${error.message}`)
    }
}

otpSchema.pre("save", async function (next) {

    console.log("Only save new Docs")

    if (this.isNew) {
        await sendVerficationEmail(this.email, this.otp)
    }
    next()
})

const OTP = mongoose.model('otp', otpSchema)

export default OTP
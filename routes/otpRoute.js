import express from "express"
import {
    sendOTP,
    otpVerifyGet,
    otpVerifyPost

} from "../controllers/otpController.js"
import { renderEmailVerify } from "../controllers/user/userController.js"

const router = express.Router()

router.get("/otp-verify", otpVerifyGet)
router.post('/otp-verify', otpVerifyPost)

router.post("/send-otp", async (req, res) => {
    try {
        if (!req.session.temp && !req.session.update) {
            return res.status(400).json({
                success: false,
                message: "Your session has expired. Please start over.",
                redirect: '/signup'
            });
        }

        const email = req.session.update ? req.session.updateNew : req.session.temp.email
        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Your session has expired. Please start over.",
                redirect: '/signup'
            });
        }

        const result = await sendOTP(email);

        return res.status(result.success ? 200 : 400).json(result);

    } catch (error) {
        console.error("Error in send-otp route:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to send OTP",
        });
    }
});
//export
export default router
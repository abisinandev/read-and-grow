import otpGenerator from "otp-generator"
import OTP from '../models/otpSchema.js';
import User from '../models/userSchema.js';
import jwt from "jsonwebtoken"
import AppError from "../utils/errorHandler.js";
import { CONFIG } from "../utils/constants/envConfig.js";
import { AUTH_ERRORS } from "../utils/constants/errorMessages.js";
import { STATUS } from "../utils/constants/statusCodes.js";
import { getReferralReward } from "../services/referralReward.js";

export const sendOTP = async (email) => {
    try {
        const checkUserPresent = await User.findOne({ email });

        if (checkUserPresent) {
            return {
                success: false,
                message: AUTH_ERRORS.USERNAME_TAKEN
            }
        }

        //GENERATE OTP 4 DIGITS
        let otp = otpGenerator.generate(4, {
            lowerCaseAlphabets: false,
            upperCaseAlphabets: false,
            specialChars: false
        })

        //FIND OTP IF ALREADY EXIST IN DB
        let result = await OTP.findOne({ otp: otp })

        //THIS LOOP FOR GETTING UNIQUE OTP
        while (result) {
            otp = otpGenerator.generate(4, {
                upperCaseAlphabets: false
            })
            result = await OTP.findOne({ otp: otp })//IF NULL LOOP BREAKS
        }

        const otpPayload = { email, otp }

        //STORE NEW OTP IN DB
        await OTP.create(otpPayload)
        console.log(`OTP : ${otpPayload.otp}`)

        return {
            success: true,
            message: "OTP sent successfully",
            // redirect : we need to define next process
        }

    } catch (error) {

        console.log(error.message)
        return {
            success: false,
            message: AUTH_ERRORS.OTP_SEND_FAILED,
            error: error.message
        }
    }
}


export const otpVerifyGet = async (req, res, next) => {
    try {
        //UPDATE EMAIL AND  SIGNUP ARE WORK HERE
        if (req.session.temp || req.session.update) {
            return res.render("user/otp")
        }
        return res.status(404)
    } catch (error) {
        console.log("otp verification : ", error.message)
    }
}


export const otpVerifyPost = async (req, res, next) => {
    try {
        const { otp } = req.body
        console.log("otp : ", otp)

        if (!req.session.temp && !req.session.update) {
            return res.status(STATUS.BAD_REQUEST).json({ 
                success: false,
                message: AUTH_ERRORS.SESSION_EXPIRED
            })
        } 

        ///FOR UPDATE EMAIL
        if (req.session.update) {
            // console.log('req.session.update',req.session.update)

            const getOtp = await OTP.find({ email: req.session.updateNew })
                .sort({ createdAt: -1 })
                .limit(1)

            // console.log("getOtp : ", getOtp)

            // if (!getOtp[0].otp.length==0) {
            //     return res.status(400).json({
            //         success: false,
            //         message: "Otp is not valid"
            //     })
            // } 

            //EXPIRY TIME (30 seconds)
            if (Date.now() - getOtp[0].createdAt.getTime() > 30 * 1000) {
                return res.status(STATUS.BAD_REQUEST).json({
                    success: false,
                    message: AUTH_ERRORS.OTP_EXPIRED
                })
            }

            if (getOtp[0].otp.toString() !== otp.toString()) {
                return res.status(STATUS.BAD_REQUEST).json({
                    success: false,
                    message: AUTH_ERRORS.INVALID_OTP
                })
            }

            //UPDATE NEW EMAIL
            const updatedUser = await User.findOneAndUpdate(
                { email: req.session.update },
                { $set: { email: req.session.updateNew } },
                { new: true }
            );

            //CLEAR SESSION
            req.session.update = null
            req.session.updateNew = null

            return res.status(200).json({
                success: true,
                message: "Email updated.",
                redirect: "/"
            })
        }

        //===========SIGN UP OTP VERIFY====================
        const { username, email, phoneNumber, password, referralCode } = req.session.temp
        console.log("temp session otp", req.session.temp)

        const getOtp = await OTP.find({ email: email }).sort({ createdAt: -1 }).limit(1)
        console.log("getOtp : ", getOtp)

        if (!getOtp || getOtp.length === 0) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: AUTH_ERRORS.INVALID_OTP
            })
        }

        //EXPIRY TIME (30 seconds)
        if (Date.now() - getOtp[0].createdAt.getTime() > 30 * 1000) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: AUTH_ERRORS.OTP_EXPIRED
            })
        }

        if (getOtp[0].otp.toString() !== otp.toString()) {
            return res.status(STATUS.BAD_REQUEST).json({
                success:false,
                message: AUTH_ERRORS.INVALID_OTP
            })
        }

        //CREATE NEW USER 
        const newUser = new User({
            username,
            email,
            phoneNumber: Number(phoneNumber),
            password,
            role: 'user',
            isEmailVerfied: true
        })
        await newUser.save()
        // console.log("user saved :", newUser.username);
 

        //CALLING REFERRAL CODE FUNCTON FOR GETTING REWARD 
        await getReferralReward(referralCode, newUser._id)
        req.session.temp = null;//CLEAR SESSION

        //CREATE JWT TOKEN
        const token = jwt.sign({ id: newUser._id, username: newUser.username, role:newUser.role }, CONFIG.JWT_SECRET, { expiresIn: CONFIG.JWT_EXPIRES })
        //STORE JWT IN COOKIES
        res.cookie('jwt', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 })
        return res.status(200).json({
            success: true,
            message: "Account created successfully",
            redirect: "/"
        }) 
  
    } catch (error) {
        console.log(error.message)
        next(new AppError(`otp verfication failed : ${error}`, STATUS.INTERNAL_SERVER_ERROR))
    }
}
 
 
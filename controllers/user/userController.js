import mongoose from "mongoose"
import bcrypt from "bcrypt"
import User from "../../models/userSchema.js"
import jwt from "jsonwebtoken"
import OTP from "../../models/otpSchema.js"
import { sendOTP } from "../otpController.js"
import AppError from "../../utils/errorHandler.js"
import Product from "../../models/productSchema.js"
import nodemailer from "nodemailer"
import Category from "../../models/categorySchema.js"
import Address from "../../models/addressSchema.js"
import Cart from "../../models/cartSchema.js"
import Wishlist from "../../models/wishListSchema.js"
import Order from "../../models/orderSchema.js"
import { CONFIG } from "../../utils/constants/envConfig.js"
import { AUTH_ERRORS, PROFILE_ERRORS, GENERAL_ERRORS } from "../../utils/constants/errorMessages.js"
import { STATUS } from "../../utils/constants/statusCodes.js"


export const renderSignPage = async (req, res, next) => {
    try {
        if (req.cookies.jwt) {
            const token = req.cookies.jwt
            const docodeToken = jwt.verify(token, process.env.JWT_SECRET)
            if (docodeToken.role === 'admin') {
                return res.redirect('/admin/dashboard')
            } else {
                return res.redirect("/")
            }
        }
        return res.render("user/signup")

    } catch (error) {
        return next(new AppError(`User signup ${req.method} method failed `, 500))
    }
}

export const handleSignupPage = async (req, res, next) => {
    try {
        const { username, password, confirmPassword, email, phoneNumber, referralCode } = req.body
        // console.log(req.body)
        console.log(referralCode)

        if (password !== confirmPassword) {
            return res.status(STATUS.BAD_REQUEST).json({ success: false, message: AUTH_ERRORS.PASSWORDS_DO_NOT_MATCH, field: 'confirmPassword' })
        }
        
        let StrongPassword = password; // Passwords already match, so we can use it

        //VALIDATION
        if (!username || !email || !phoneNumber || !password || !confirmPassword) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: AUTH_ERRORS.ALL_FIELDS_REQUIRED
            })
        }

        //REFERRAL CODE VALDATION
        if (referralCode) {
            const isValidReferral = await User.findOne({ referralCode });
            if (!isValidReferral) {
                return res.status(404).json({ success: false, message: "Invalid referral code" })
            }
        }

        const userExist = await User.findOne({ $or: [{ username }, { email }, { phoneNumber }] })
        if (userExist) {
            if (userExist.username == username) {
                console.log(username)
                return res.status(STATUS.BAD_REQUEST).json({ success: false, message: AUTH_ERRORS.USERNAME_TAKEN, field: 'username' })
            }
            if (userExist.email == email) {
                return res.status(STATUS.BAD_REQUEST).json({ success: false, message: AUTH_ERRORS.EMAIL_TAKEN, field: 'email' })
            }
            if (userExist.phoneNumber == phoneNumber) {
                return res.status(STATUS.BAD_REQUEST).json({ success: false, message: AUTH_ERRORS.PHONE_TAKEN, field: 'phoneNumber' })
            }
        }

        req.session.temp = email //FOR RESEND OTP
        const otpResult = await sendOTP(email)
        console.log("Send Otp response :", otpResult)//DEBUG

        if (!otpResult.success) {
            return res.status(500).json(otpResult.message)
        }

        let salt = await bcrypt.genSalt(10)
        let hashPassword = await bcrypt.hash(StrongPassword, salt)

        //STORE EMAIL IN SESSION FOR VARIFY OTP
        req.session.temp = {
            username,
            email,
            password: hashPassword,
            phoneNumber,
            referralCode
        }
        const token = jwt.sign({ email: email }, CONFIG.JWT_SECRET, { expiresIn: CONFIG.JWT_EXPIRES })

        // console.log('sign up Temp session :', req.session.temp, token)
        return res.status(200).json({
            success: true,
            message: otpResult.message,
            redirect: '/otp/otp-verify',
            token
        })

    } catch (error) {
        res.status(500).json({ success: false, message: "Something went wrong" })
        return next(new AppError(`User signup ${req.method} method failed `, 500))
    }
}



export const renderLoginPage = async (req, res, next) => {
    try {
        //CHECK TOKEN AVAILABLE FOR SESSION MANAGMENT
        if (req.cookies.jwt) {
            const token = req.cookies.jwt
            const docodeToken = jwt.verify(token, process.env.JWT_SECRET)
            if (docodeToken.role === 'admin') {
                return res.redirect('/admin/dashboard')
            } else {
                return res.redirect("/")
            }
        }

        return res.render("user/login")
    } catch (error) {
        return next(new AppError(`User login failed : ${error}`, 500))
    }
}


export const handleLoginPage = async (req, res, next) => {
    try {
        let { username, password } = req.body

        console.log("userLoginPost", req.body)
        const isUser = await User.findOne({
            $or: [{ username: username }, { email: username }]
        });


        if (!isUser) {
            return res.status(STATUS.BAD_REQUEST).json({ success: false, message: AUTH_ERRORS.USER_NOT_FOUND })
        }
        console.log("isUser : ", isUser)

        //IGNORE IF USER IS ADMIN
        if (isUser.role === 'admin') {
            return res.status(STATUS.BAD_REQUEST).json({ success: false, message: AUTH_ERRORS.ADMIN_LOGIN_DENIED })
        }

        //COMPARE PASSWORD FROM DB
        const comparePassword = await bcrypt.compare(password, isUser.password)

        if (!comparePassword) {
            return res.status(STATUS.BAD_REQUEST).json({ success: false, message: AUTH_ERRORS.INCORRECT_PASSWORD, field: 'password' })
        }

        //IGNORE BLOCKED USERS
        if (isUser.isBlocked == true) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: AUTH_ERRORS.USER_BLOCKED
            })
        }

        //GENERATING JWT TOKEN
        const token = jwt.sign({ id: isUser._id, username: isUser.username, role: isUser.role }, CONFIG.JWT_SECRET, { expiresIn: CONFIG.JWT_EXPIRES })
        //STORE JWT IN COOKIES
        res.cookie('jwt', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 })

        // req.session.user = isUser
        return res.status(STATUS.OK).json({
            success: true,
            message: "successfully logged",
            redirect: "/"
        })

    } catch (error) {
        console.log(error)
        return next(new AppError(`Login page error : ${error.message}`, 500))
    }
}


//==================forgot password================== 
export const renderEmailVerify = async (req, res, next) => {
    try {
        return res.render('user/emailVerify')
    } catch (error) {
        next(new AppError(`Forgot password failed : ${error} `, 500))
    }
}

export const requestPasswordReset = async (req, res, next) => {
    const { email } = req.body
    try {
        console.log(email)
        const user = await User.findOne({ email: email })//FIND EMAIL

        //IF EMAIL NOT MATCHING
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Please give a valid emailId"
            })
        }

        //CREATE JWT SCRET WITH USER PASSWORD
        const secret = process.env.JWT_SECRET + user.password;
        //JWT TOKEN CREATE
        const token = jwt.sign({ id: user._id, email: email }, secret, { expiresIn: '1h' });

        const baseUrl = process.env.BASE_URL || `http://localhost:3999`
        //PASS WITH API LIKE QUERY
        const resetURL = `${baseUrl}/resetPassword?id=${user._id}&token=${token}`;

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASS
            },
        });

        //FOR SEND REQUEST TO MAIL
        const mailOptions = {
            to: email,
            from: process.env.MAIL_USER,
            subject: 'Password Reset Request',
            text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n
            Please click on the following link, or paste this into your browser to complete the process:\n\n
            ${resetURL}\n\n
            If you did not request this, please ignore this email and your password will remain unchanged.\n`,
        };

        await transporter.sendMail(mailOptions);

        return res.status(200).json({
            success: true,
            message: 'Password reset link sent'
        })
    } catch (error) {
        next(new AppError(`Forgot password failed : ${error} `, 500))
    }
}

export const renderResetPassword = async (req, res, next) => {
    try {
        return res.render('user/forgot')
    } catch (error) {
        next(new AppError(`Forgot password failed : ${error},500`))
    }
}


export const resetPassword = async (req, res, next) => {
    const { id, token } = req.query;// TAKE ID AND TOKEN FROM QUERY
    const { password } = req.body;
    console.log("Reset password :", req.query)

    try {
        const user = await User.findOne({ _id: id });
        if (!user) {
            return res.status(400).json({ message: "User not exists!" });
        }

        const secret = process.env.JWT_SECRET + user.password;

        //VERIFY WITH GIVE TOKEN  
        const verify = jwt.verify(token, secret);
        //HASH PASSWORD
        const encryptedPassword = await bcrypt.hash(password, 10);

        //UPDATE WITH NEW PASSWORD
        await User.findByIdAndUpdate(
            id,
            {
                $set: {
                    password: encryptedPassword,
                },
            }
        );

        await user.save();

        res.status(200).json({ message: 'Password has been reset' });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Something went wrong' });
    }
};



//========User profile===============

export const renderProfilePage = async (req, res, next) => {
    try {
        console.log("req.user :",req.user)
        const user = await User.findById(req.user.id)
        if (!user) {
            return res.status(STATUS.NOT_FOUND).json({ success: false, message: PROFILE_ERRORS.USER_NOT_FOUND })
        }

        return res.render("user/profile", { user })
    } catch (error) {
        next(new AppError('User profile loading failed'))
    }
}

export const editProfile = async (req, res, next) => {
    try {
        const { username, phoneNumber } = req.body
        const user = req.user
        console.log(req.body)

        //VALIDATION
        if (!username || !phoneNumber) {
            return res.status(STATUS.BAD_REQUEST).json({ success: false, message: PROFILE_ERRORS.USERNAME_PHONE_REQUIRED })
        }

        //CHECK DUPLICATE USERNAME OR PHONE FOR OTHER USERS
        const isDuplicate = await User.findOne({
            _id: { $ne: user.id },
            $or: [{ username }, { phoneNumber }]
        })
        if (isDuplicate) {
            if (isDuplicate.username === username) {
                return res.status(STATUS.BAD_REQUEST).json({ success: false, message: PROFILE_ERRORS.USERNAME_TAKEN, field: 'username' })
            }
            return res.status(STATUS.BAD_REQUEST).json({ success: false, message: PROFILE_ERRORS.PHONE_TAKEN, field: 'phoneNumber' })
        }

        await User.findByIdAndUpdate(
            user.id,
            { username, phoneNumber }
        )
        return res.status(200).json({ success: true, message: "Profile updated." })

    } catch (error) {
        next(new AppError(`User profile update Failed : ${error}`, 500))
    }
}


export const renderChangePassword = async (req, res, next) => {
    try {
        const { id } = req.params
        const user = await User.findOne({ _id: id })
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User detailes not found"
            })
        }
        return res.render("user/changePassword", { user })
    } catch (error) {
        next(new AppError(`Change password : ${error}`, 500))
    }
}

export const changePasswordRequest = async (req, res, next) => {
    try {
        const { oldPassword, newPassword, confirmPassword } = req.body
        // console.log(req.body)
        const data = req.user
        const user = await User.findOne({ _id: data.id })

        //GOOGLE AUTH USERS DON'T HAVE A PASSWORD
        if (!user.password) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: AUTH_ERRORS.GOOGLE_NO_PASSWORD
            })
        }

        //BCRYPT COMPPARE OLD PASSWORD WITH NEW PASSWORD
        const comparePassword = await bcrypt.compare(oldPassword, user.password)

        if (!comparePassword) {
            return res.status(STATUS.BAD_REQUEST).json({ success: false, message: AUTH_ERRORS.OLD_PASSWORD_MISMATCH, field: 'oldPassword' })
        }

        if (newPassword !== confirmPassword) {
            return res.status(STATUS.BAD_REQUEST).json({ success: false, message: AUTH_ERRORS.CONFIRM_PASSWORD_MISMATCH, field: 'confirmPassword' })
        }

        //IF MATCH ? GENERATE SALT
        let salt = await bcrypt.genSalt(10)
        let hashPassword = await bcrypt.hash(newPassword, salt)

        //UPDATE
        await User.findByIdAndUpdate(
            user._id,
            { password: hashPassword }
        )

        return res.status(200).json({
            success: true,
            message: "Password updated",
            data
        })
    } catch (error) {
        next(new AppError(`Change password : ${error}`, 500))
    }
}

export const renderChangeEmail = async (req, res, next) => {
    try {
        const id = req.params
        const user = await User.findById(id.id)//FIND USER

        //IF USER NOT FOUND REDIRECT BACK TO PROFILE
        if (!user) {
            return res.redirect(`/profile/${id.id}`)
        }

        //SET EMAIL TO SESSION 
        req.session.update = user.email
        return res.render("user/editEmail", { id })

    } catch (error) {
        next(new AppError(`Change email : ${error}`, 500))
    }
}


export const changeEmailRequest = async (req, res, next) => {
    try {
        const { email } = req.body
        const id = req.user
        // console.log(email)

        const isExist = await User.findById(id.id)//FIND USER

        // CHECK  EMAIL MATCHING 
        if (isExist.email !== email) {
            return res.status(STATUS.BAD_REQUEST).json({ success: false, message: AUTH_ERRORS.EMAIL_NOT_VALID, field: 'email' })
        }

        const baseUrl = CONFIG.BASE_URL
        //RESET URL IN A VARIBLE
        const resetURL = `${baseUrl}/new-email/${id.id}`;

        //SEND REQUEST TO MAILID
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: CONFIG.MAIL_USER,
                pass: CONFIG.MAIL_PASS
            },
        });
        // console.log(transporter)
        const mailOptions = {
            to: email,
            from: CONFIG.MAIL_USER,
            subject: 'Update Email Address - Read & Grow',
            text: `You are receiving this because you requested to update your email address.\n\n
            Please click on the following link, or paste this into your browser to complete the process:\n\n
            ${resetURL}\n\n
            If you did not request this, please ignore this email and your account will remain unchanged.\n
            `,
        };

        await transporter.sendMail(mailOptions);

        return res.status(200).json({
            success: true,
            message: "Please check your email"
        })

    } catch (error) {
        next(new AppError(`change email request failed : ${error}`, 500))
    }
}


export const renderUpdateMail = async (req, res, next) => {
    try {
        if (req.session.update) {
            return res.render("user/updateNewMail", { user: req.user })
        }
        return res.status(404).redirect('/notFound')
    } catch (error) {
        next(new AppError(`Update Mail failed : ${error}`, 500))
    }
}

export const updateNewMail = async (req, res, next) => {
    try {
        const { email } = req.body
        console.log(email)

        const isExists = await User.findOne({ email: email })
        //CHECK ALREADY AVAILABLE
        if (isExists) {
            return res.status(STATUS.BAD_REQUEST).json({ success: false, message: AUTH_ERRORS.EMAIL_ALREADY_IN_USE, field: 'email' })
        }

        const otpResult = await sendOTP(email)//PASS EMAIL TO SEND OTP FUNCTION
        console.log("Send Otp response  :", otpResult)

        if (!otpResult.success) {
            return res.status(500).json(otpResult.message)
        }

        //SET NEW SESSION WHEN EMAIL ITS FINE
        req.session.updateNew = email
        return res.status(200).json({
            success: true,
            message: otpResult.message,
            redirect: "/otp/verify"//VERIFY NEW EMAIL
        })

    } catch (error) {
        next(new AppError(`updateNew Mail : ${email}`, 500))
    }
}


export const renderAddressPage = async (req, res, next) => {
    try {
        const user = req.user
        const address = await Address.find({ userId: user.id })
        res.render("user/address", { user, address })
    } catch (error) {
        next(new AppError(`Address page : ${error}`, 500))
    }
}


export const addAddress = async (req, res, next) => {
    try {
        const {
            firstName,
            lastName,
            street,
            city,
            state,
            zip,
            phone,
            addressType
        } = req.body
        const user = req.user

        //VALIDATIONS
        if (!firstName || !lastName || !street || !city || !state || !zip || !phone) {
            return res.status(400).json({
                success: false,
                message: "Please add your address"
            })
        }

        console.log("Add address :", req.body)
        const phoneNumber = parseInt(phone)

        if (isNaN(phoneNumber)) {
            return res.status(400).json({ success: false, message: "Number must be digits" })
        }

        //CREATE NEW ADDRESS
        const newAddress = new Address({
            firstName,
            lastName,
            street,
            city,
            state,
            pincode: zip,
            phoneNumber: parseInt(phone),
            addressType,
            userId: user.id
        })

        await newAddress.save()
        if (!newAddress) {
            return res.status(400).json({
                success: false,
                message: "Address can't save to db"
            })
        }

        return res.status(200).json({
            success: true,
            message: "Address added successfully."
        })

    } catch (error) {
        next(new AppError(`Add address is failed : ${error}`, 500))
    }
}


export const editAddress = async (req, res, next) => {
    try {
        const {
            firstName,
            lastName,
            street,
            city,
            state,
            phone,
            zip,
            addressType
        } = req.body;

        const user = req.user;
        const addressId = req.params.addressId
        console.log("Address edit : ", addressId)

        //VALIDATION
        if (!firstName || !lastName || !street || !city || !state || !phone || !zip || !addressType) {
            return res.status(400).json({
                success: false,
                message: "All fields are required."
            });
        }

        const phoneNumber = parseInt(phone)
        if (isNaN(phoneNumber)) {
            return res.status(400).json({ success: false, message: "Number must be digits" })
        }

        //UPDATE ADDRESS
        const updateAddress = await Address.findByIdAndUpdate(
            addressId,
            {
                $set: {
                    firstName,
                    lastName,
                    street,
                    city,
                    state,
                    pincode: zip,
                    phoneNumber,
                    addressType,
                }
            });


        if (!updateAddress) {
            return res.status(400).json({
                success: false,
                message: "Address not found or can't be changed."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Address edited successfully.",

        });
    } catch (error) {
        next(new AppError(`Edit address failed: ${error}`, 500));
    }
};


export const deleteAddress = async (req, res, next) => {
    try {
        const id = req.params.id
        console.log(id)
        const deleteAddress = await Address.findByIdAndDelete(id)
        if (!deleteAddress) {
            return res.status(400).json({
                success: false,
                message: "Address not found"
            })
        }

        return res.status(200).json({
            success: true,
            message: "Address deleted."
        })
    } catch (error) {
        next(new AppError(`Address delete failed : ${error}`, 500))
    }
}

export const setDefault = async (req, res, next) => {
    try {
        const addressId = req.params.id
        const isChecked = req.body.isDefault//SELECTED (TRUE/FALSE)
        console.log("Address set defualt : ", isChecked)

        const address = await Address.findById(addressId)
        if (!address) {
            return res.status(400).json({ success: false, message: "Address not found" })
        }

        if (isChecked) {
            //SET ONLY ONE ADDRESS AS DEFAULT IF MULITPLE ADDRESS AVAILABLE
            await Address.updateMany(
                { user: address.user, _id: { $ne: addressId } },
                { $set: { isDefault: false } }
            );
        }

        //UPDATE ISDEFAULT
        const updateAddress = await Address.findByIdAndUpdate(
            addressId,
            { $set: { isDefault: isChecked } },
            { new: true }
        )

        if (!updateAddress) {
            return res.status(400).json({
                success: false,
                message: "Failed to update address"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Address as set default"
        })
    } catch (error) {
        next(new AppError(`Default address : ${error}`, 500))
    }
}


export const selectAddress = async (req, res, next) => {
    try {
        const addressId = req.params.id
        const isChecked = req.body.isSelected//(TRUE/FALSE)
        console.log("Address is selected : ", isChecked)

        const address = await Address.findById(addressId)
        if (!address) {
            return res.status(400).json({ success: false, message: "Address not found" })
        }

        //USER CAN ONLY SELECT ONE ADDRESS
        if (isChecked) {
            await Address.updateMany(
                { user: address.user, _id: { $ne: addressId } },
                { $set: { isSelected: false } }
            );
        }

        //UPDATE
        const updateAddress = await Address.findByIdAndUpdate(
            addressId,
            { $set: { isSelected: isChecked } },
            { new: true }
        )

        if (!updateAddress) {
            return res.status(400).json({
                success: false,
                message: "Failed to select addresss"
            });
        }

        if (isChecked) {
            return res.status(200).json({
                success: true,
                message: "Address is selected"
            })
        } else {
            return res.status(200).json({
                success: true,
                message: "Please select an address"
            })
        }
    } catch (error) {
        next(new AppError(`Default address : ${error}`, 500))
    }
}


//============Logout=================== 
export const logout = async (req, res, next) => {
    try {
        res.clearCookie("jwt")//CLEAR JWT TOKENS
        req.session.user = null//CLEAR AVAILABLE SESSION
        return res.json({ success: true, message: "Logged out successfully." })

    } catch (error) {
        next(new AppError(`Logout Failed : ${error}`, 500))
    }
}
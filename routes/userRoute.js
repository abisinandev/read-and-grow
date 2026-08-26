import express from "express"
const router = express.Router()
import userAuth from "../middlewares/userAuth.js"
import { CONFIG } from "../utils/constants/envConfig.js"
import {

    resetPassword,
    requestPasswordReset,
    logout,
    changePasswordRequest,
    handleLoginPage,
    renderLoginPage,
    renderSignPage,
    handleSignupPage,
    renderEmailVerify,
    renderResetPassword,
    renderProfilePage,
    renderChangePassword,
    editProfile,
    changeEmailRequest,
    renderChangeEmail,
    renderUpdateMail,
    updateNewMail,
    renderAddressPage,
    addAddress,
    editAddress,
    deleteAddress,
    setDefault,
    selectAddress,

} from "../controllers/user/userController.js"
import passport from "passport"
import jwt from "jsonwebtoken"
import { renderWallet } from "../controllers/user/walletController.js"
import uploadProfileImage from "../utils/profileMulter.js"
import User from "../models/userSchema.js"

//LOGIN
router.get('/login', renderLoginPage)
router.post('/login', handleLoginPage)

//SIGNUP
router.get("/signup", renderSignPage)
router.post('/signup', handleSignupPage)

//EMAIL AND PASSWORD CHANGE
router.get('/email-verify', renderEmailVerify)
router.post('/requestPasswordReset', requestPasswordReset)
router.get('/resetPassword', renderResetPassword)
router.post('/resetPassword', resetPassword)
router.get('/change-password/:id', userAuth, renderChangePassword)
router.post('/change-password', userAuth, changePasswordRequest)
router.get('/change-email/:id', userAuth, renderChangeEmail)
router.post('/change-email', userAuth, changeEmailRequest)
router.get('/new-email/:id', userAuth, renderUpdateMail)
router.post('/new-email', userAuth, updateNewMail)

//ADDRESS
router.get('/address/:id', userAuth, renderAddressPage)
router.post('/address', userAuth, addAddress)
router.put('/address/:userId/:addressId', userAuth, editAddress)
router.patch('/address/:id/set-default', userAuth, setDefault)
router.delete('/address/:id', userAuth, deleteAddress)
router.patch('/address/:id/select-address', selectAddress)

//WALLET
router.get('/wallet/:id',userAuth,renderWallet)
router.get('/profile/:id', userAuth, renderProfilePage)
router.patch('/profile/:id', userAuth, editProfile)


//UPLOAD IMAGE
router.post("/upload-profile", userAuth, (req, res, next) => {
    const upload = uploadProfileImage.single("profileImage");
    upload(req, res, function (err) {
        if (err) {
            // Multer error or invalid file type
            return res.status(400).json({ success: false, message: err.message });
        }
        next();
    });
}, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }

        const userId = req.user.id; 
        const filePath = `/profile_images/${req.file.filename}`;

        // Update user profile image in database
        const user = await User.findByIdAndUpdate(userId, { profileImage: filePath }, { new: true });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.json({ success: true, message: "Profile image uploaded successfully", filePath });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});


//LOGOUT
router.post('/logout', logout)

//GOOGLE AUTH
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
        if (!req.user) {
            console.error("Google OAuth failed: No user found");
            return res.redirect('/signup');
        }

        // Store user ID in session
        req.session.user = req.user._id;
        console.log('Session User ID:',  req.user.email);

        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.redirect('/signup');
            }

            // SET JWT TOKEN
            const token = jwt.sign({ 
                id: req.user._id ,
                username:req.user.username,
                email:req.user.email,
                role:req.user.role,
                }, CONFIG.JWT_SECRET, {
                expiresIn: CONFIG.JWT_EXPIRES,
            });

            res.cookie('jwt', token, {
                httpOnly: true,
                maxAge: 24 * 60 * 60 * 1000, // 1 Day
            });

            console.log('Google signup done');
            return res.redirect('/');
        });
    }
);



//EXPORT ALL ROUTERS
export default router 
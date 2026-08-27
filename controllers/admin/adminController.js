import User from "../../models/userSchema.js";
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken";
import AppError from "../../utils/errorHandler.js";

//=====================admin login get ==================
export const adminLoginGet = async (req, res) => {
    try {
        if (req.cookies.jwt) {
            const token = req.cookies.jwt
            const docodeToken = jwt.verify(token, process.env.JWT_SECRET)
            if (docodeToken.role == 'admin') {
                return res.redirect('/admin/dashboard')
            } else {
                return res.redirect("/")
            }
        }

        return res.render("admin/login")

    } catch (error) {
        console.error(`admin_login failed : ${error.message}`)
    }
}

//=======================login admin post
export const adminLoginPost = async (req, res, next) => {
    try {
        let { username, password } = req.body

        const admin = await User.findOne({ username })

        if (!admin) {
            return res.status(400).json({ success: false, message: "Please enter valid admin details" })
        }

        const comparePassword = await bcrypt.compare(password, admin.password)
        if (!comparePassword) {
            return res.status(400).json({ success: false, message: "Incorrect password" })
        }

        if (admin.role !== 'admin') {
            return res.status(403).json({ success: false, message: "You are not authorized to access the admin panel" })
        }

        //CREATE JWT TOKEN
        const token = jwt.sign({ id: admin._id, name: admin.username, role: admin.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES })

        //STORE JWT TOKEN IN COOKIES
        res.cookie('jwt', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 })

        return res.status(200).json({ success: true, message: "Logged successfully", redirect: "/admin/dashboard" })


    } catch (error) {
        return next(new AppError(`admin Login ${req.method} method failed `, 500))
    }
}

//===================Logout button================================
export const adminLogout = async (req, res, next) => {
    try {
        res.clearCookie('jwt')
        res.json({ success: true, message: "Logged out successfully." })
    } catch (error) {
        console.log('admin Logout failed : ', error.message)
        res.status(500).json({ success: false, message: "something went wrong" })
    }

}

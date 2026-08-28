import express from "express"
import dotenv from "dotenv"
import path from "path";
import session from "express-session";
import cors from "cors"
import morgan from "morgan";
import passport from "./utils/passportAuth.js";
import MongoStore from "connect-mongo"

import adminRoutes from "./routes/adminRoute.js"
import userRoute from "./routes/userRoute.js"
import otpRoute from "./routes/otpRoute.js"
import ordersRoute from "./routes/ordersRoute.js"
import shopingCartRoute from "./routes/shopingCartRoute.js"

import nocache from "nocache";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import methodOverride from "method-override"

import { CONFIG } from "./utils/constants/envConfig.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express()
app.set("views", path.resolve("views"))//VIEW ENGINE SETUP
app.set("view engine", "ejs")
app.use(express.static(path.join(__dirname, "public")))

app.use(cookieParser())
app.use(express.json())//PARSE JSON DATAS
app.use(express.urlencoded({ extended: true }))//SUBMIT FORMS..
app.use(nocache())
app.use(methodOverride('_method'))

//STORE SESSION IN DB FOR PERSISTENCE
app.use(session({
    secret: CONFIG.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
    store: MongoStore.create({
        mongoUrl: CONFIG.MONGO_URI, // MongoDB URL
        collectionName: 'sessions', // Collection where sessions will be stored
        ttl: 1 * 60 * 60 // Session expiration time in seconds (14 days)
    }),
}))

app.use(cors())
app.use(morgan("dev"))//LOG EACH API CALLS
app.use(passport.initialize())
app.use(passport.session())

//ROUTERS
app.use("/admin", adminRoutes)
app.use("/", userRoute)
app.use("/", ordersRoute)
app.use("/", shopingCartRoute)
app.use("/otp", otpRoute)

//ERROR HANDLING MIDDLERWARE CLASS APPERROR
app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server error";
    console.error(`Error: ${message}, statusCode :${statusCode}`);

    if (err.name === 'MulterError') {
        const multerMessages = {
            LIMIT_FILE_SIZE: 'Each image must be less than 5MB.',
            LIMIT_FILE_COUNT: 'Too many images uploaded.',
            LIMIT_UNEXPECTED_FILE: 'Too many images, or an unexpected upload field.',
        };
        return res.status(400).json({
            success: false,
            message: multerMessages[err.code] || 'Image upload failed. Please try again.'
        });
    }

    if (err.isOperational) {
        return res.status(statusCode).json({
            success: false,
            message: message,
            field: err.field || null
        });
    }

    //UNEXPECTED ERRORS CATHING
    return res.status(500).json({
        success: false,
        message: "Something went wrong. Please try again"
    });
});


app.get('/notFound', (req, res) => {
    res.render('admin/notFound')
})
app.get('*', (req, res) => {
    res.status(404).render('admin/notFound')
})


export default app;
import express from "express"
import connectDb from './db/dbConnection.js';
import dotenv from "dotenv"
import path from "path";
import session from "express-session";
import cors from "cors"
dotenv.config()//ENV FILE CONFIGURATION
import morgan from "morgan";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import passport from "./utils/passportAuth.js";
import MongoStore from "connect-mongo"

import adminRoutes from "./routes/adminRoute.js"
import userRoute from "./routes/userRoute.js"
import otpRoute from "./routes/otpRoute.js" 
import ordersRoute from "./routes/ordersRoute.js" 
import shopingCartRoute from "./routes/shopingCartRoute.js"

// import { errorHandling } from "./middlewares/error_handling.js";
import nocache from "nocache";
import { fileURLToPath } from "url";
import { error } from "console";
import AppError from "./utils/errorHandler.js";
import cookieParser from "cookie-parser";
import methodOverride from "method-override"
import User from "./models/userSchema.js";
 
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express()
app.set("views", path.resolve("views"))//VIEW ENGIVE SETUP
app.set("view engine", "ejs")
app.use(express.static(path.join(__dirname, "public")))  
 
app.use(cookieParser())
app.use(express.json())//PARSE JSON DATAS
app.use(express.urlencoded({ extended: true }))//SUBMIT FORMS..
app.use(nocache())

//STORE SESSION IN DB FOR PERSISTENCE
app.use(session({ 
    secret: process.env.SESSION_SCERET,
resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
    store: MongoStore.create({
        mongoUrl: process.env.DB_CONNECTION, // MongoDB URL
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
app.use("/otp",otpRoute)
app.use(methodOverride('_method'))

//ERROR HANDLING MIDDLERWARE CLASS APPERROR
app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server error";
    console.error(`Error: ${message}, statusCode :${statusCode}`);
    
    return res.status(statusCode).json({
        success:false, 
        message:"Something went wrong" }); 
}); 
   

//THIS FOR CLOSE SERVER CLEANLY INSTEAD OF FORCEFULLY QUITTING
process.on('SIGINT', () => {
    console.log("Closing server..."); 
    process.exit();
});


app.get('/',(req,res)=>{
    res.redirect('/')
})
app.get('/notFound', (req, res) => {
    res.render('admin/notFound')
})
app.get('*', (req, res) => {
    res.status(404).render('admin/notFound')
})


export default app;
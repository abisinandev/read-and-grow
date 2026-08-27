import mongoose from "mongoose"
import dotenv from "dotenv"
import { CONFIG } from "../utils/constants/envConfig.js"
dotenv.config()

const connectDb = async () => {
    try {
        await mongoose.connect(CONFIG.MONGO_URI)
        console.log(`MONGODB DATABASE CONNECTED..`)
    } catch (error) {
        console.error(`Database connection failed : ${error.message}`)
    }
}

export default connectDb

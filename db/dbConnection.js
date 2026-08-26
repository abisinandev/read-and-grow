import mongoose from "mongoose"
import dotenv from "dotenv"
dotenv.config()

const localDB = process.env.DB_CONNECTION // db connection link from .env

const connectDb = async () => {
    try {
        await mongoose.connect(localDB)
        console.log(`MONGODB DATABASE CONNECTED..`)
    } catch (error) {
        console.error(`Database connection failed : ${error.message}`)
    }
}

export default connectDb


import mongoose from "mongoose";
import { Schema } from "mongoose";
import { generateReferralCode } from "../utils/generateReferralCode.js";
const addressSchema = new Schema({
    street: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true, default: "India" },
})

const userSchema = new Schema({
    id: {
        type: String,
        // unique: true
    },
    username: {
        type: String,
        trim: true,
        // required: true,// if i on this show error
    },
    referralCode: { type: String },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        unique: true,
        required: true,
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address']
    },
    password: {
        type: String,
        required: false,
        minlength: 6,
        select: true
    },
    phoneNumber: {
        type: String,
        required: false,
        unique: true,
        sparse: true
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true,
    },
    address: addressSchema,
    role: {
        type: String,
        default: "user"
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    isEmailVerfied: {
        type: Boolean,
        default: false
    },
    profileImage: {
        type: String
    },

}, { timestamps: true })



userSchema.pre("save", async function (next) {
    if (!this.referralCode) {
        this.referralCode = generateReferralCode();
    }
    next();
});

const User = mongoose.model('User', userSchema)
export default User 
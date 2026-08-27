
import mongoose, { Schema } from "mongoose";
import { type } from "os";

const orderSchema = new Schema({
    userId: {
        type: mongoose.Types.ObjectId,
        ref: "User",
        required: true,
    },
    orderId: {
        type: String
        , required: true
    },
    addressId: {
        type: mongoose.Types.ObjectId,
        ref: "Address",
        required: true
    },
    status: {
        type: String,
        default: "Pending"
    },
    payment: {
        type: String,
        default: "COD"
    },
    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        productName: String,
        quantity: Number,
        price: Number,
        discountPrice: { type: Number },
        isCancelled: { type: Boolean, default: false },
        isReturned: { type: Boolean, default: false },
        isRequested: { type: Boolean, default: false },
        status: { type: String, default: "Pending" },
        paymentStatus: { type: String, default: 'Pending' },
        reason: { type: String, default: null },
    }],
    subTotal: { type: Number },
    shippingCharge: { type: Number, default: 99 },
    discount: { type: Number },
    totalAmount: { type: Number, required: true },
    // Was `default: false` — a boolean default on a String field. Mongoose casts it to the
    // literal string "false" whenever paymentStatus isn't explicitly set, which is never a
    // meaningful status value anywhere else in the app (paid/pending/failed/Refunded).
    paymentStatus: { type: String, default: "pending" },
    reason: { type: String, default: null },
    updatedAt: { type: Date, default: Date.now },
    isCouponAvailable: { type: Boolean, default: false },
    coupon: {
        type: mongoose.Schema.Types.ObjectId, ref: "Coupon"
    },

}, { timestamps: true })

const Order = mongoose.model('Order', orderSchema)
export default Order
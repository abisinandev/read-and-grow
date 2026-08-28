import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
    },
    authorName: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    stock: {
        type: Number,
        required: true
    },
    category: {
        type: String
    },
    images: [{
        type: String
    }],
    isBlocked: {
        type: Boolean,
        default: false
    },

    rating: { type: Number, min: 0, max: 5, default: 0 },
    offers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Offer" }],
    bestOffer: { type: Number }

}, { timestamps: true })

const Product = mongoose.model('Product', productSchema)
export default Product
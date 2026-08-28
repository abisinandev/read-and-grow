import mongoose from "mongoose"
import User from "../../models/userSchema.js"
import jwt from "jsonwebtoken"
import AppError from "../../utils/errorHandler.js"
import Product from "../../models/productSchema.js"
import Category from "../../models/categorySchema.js"
import Cart from "../../models/cartSchema.js"
import Wishlist from "../../models/wishListSchema.js"
import Order from "../../models/orderSchema.js"
import Offer from "../../models/offersSchema.js"
import Review from "../../models/reviewSchema.js"
import { CONFIG } from "../../utils/constants/envConfig.js"

const escapeRegExp = (string = '') => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');


export const renderHomePage = async (req, res, next) => {
    try {
        const token = req.cookies.jwt // TOKEN
        let user = null
        if (req.session.order) req.session.order = null//ORDER CONFIRMATION PAGE SESSION MANAGE

        // THIS FOR FORCEFULLY REMOVING USER WHEN ITS BLOCKED OR UNAVAILABLE
        if (token) {
            try {
                const decoded = jwt.verify(token, CONFIG.JWT_SECRET)
                user = decoded

                const isUser = await User.findById(user.id, { role: "user" })
                if (!isUser) {
                    res.clearCookie("jwt")
                    return res.redirect('/')
                }

            } catch (error) {
                console.log('Invalid jwt :', error)
            }
        }

        //FOR SHOWING MOST SELLED PRODUCTS
        const orders = await Order?.aggregate([
            { $match: { isBlocked: { $ne: true } } },
            { $unwind: "$items" },
            { $group: { _id: "$items.productId", totalQty: { $sum: "$items.quantity" } } },
            { $sort: { "items.quantity": -1 } },
            { $limit: 3 }
        ])

        const products = []
        for (let order of orders) {
            const product = await Product?.findById(order?._id)
            if (product && !product.isBlocked) products.push(product)
        }

        const [managedCategories, rawCategoryValues, wishlist] = await Promise.all([
            Category.find({ status: { $ne: "inactive" } }),
            Product.distinct('category', { isBlocked: { $ne: true } }),
            user ? Wishlist?.findOne({ userId: user.id }) : null
        ]);

        const activeCategoryNames = new Set(managedCategories.map(c => c.categoryName.trim().toLowerCase()));
        const hasManagedCategories = activeCategoryNames.size > 0;
        const categoryMap = new Map();
        rawCategoryValues.forEach(value => {
            if (!value) return;
            const trimmed = value.trim();
            const key = trimmed.toLowerCase();
            if (!trimmed) return;
            if (hasManagedCategories && !activeCategoryNames.has(key)) return;
            if (!categoryMap.has(key)) categoryMap.set(key, trimmed);
        });
        const categories = Array.from(categoryMap.values())
            .sort((a, b) => a.localeCompare(b))
            .slice(0, 6)
            .map(categoryName => ({ categoryName }));

        const wishlistProductIds = (wishlist?.items || []).map(item => item.productId.toString());

        return res.render('user/home', { products, user, categories, wishlistProductIds })

    } catch (error) {
        return next(new AppError(`User Dashboard failed : ${error} `, 500))
    }
}


export const renderProductDetails = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.user

        const product = await Product.findById(id)
            .populate('offers')//LOOKUP OFFERS

        if (!product) {
            return res.status(400).json({
                success: false,
                message: "Product not found"
            });
        }

        let currentDate = new Date()
        //FOR REMOVING EXPIRED OFFERS
        await Offer.updateMany(
            { validTo: { $lt: currentDate } },
            { $set: { status: false } }
        )

        const category = await Category.findOne({ categoryName: product.category })
            .populate('offers') //LOOKUP OFFERS

        // FINDING RELATED PRODUCTS
        const relatedProducts = await Product.find(
            { category: product.category, _id: { $ne: id } }
        );


        let wishlistItems = []
        const wishlist = await Wishlist?.findOne({ userId: user.id })
        if (wishlist) {
            for (let item of wishlist?.items) {
                const product = await Product.findById(item.productId).lean()
                if (product) {
                    wishlistItems.push(product) //PUSH ONCE, FIXED DUPLICATE BUG
                } else {
                    console.log(`No product found for wishlist item`)
                }
            }
        }

        let cartItems = []
        const cart = await Cart.findOne({ userId: user.id })
        if (cart) {
            for (let item of cart.items) {
                const product = await Product.findById(item.productId)
                if (!product) {
                    console.log(`No product found`)
                    // return res.status(400).json({ success: false, message: "No products found" })
                }
                cartItems.push(product)
            }
        }
        console.log(cartItems, 'cartItems')//DEBUG
        const date = new Date(product.createdAt).toDateString();// SHOWING UPDATED DATE OF PRODUCT

        //FETCH BEST REIVIEWS
        const reviews = await Review.find({ product: id }).populate('user').sort({ createdAt: -1 })

        res.render("user/product", {
            product,
            date,
            user: req.user,
            relatedProducts,
            wishlistItems,
            // bestOffer,
            cartItems,
            reviews
        });

    } catch (error) {
        return next(new AppError(`Product details page : ${error}`, 500))
    }
};


export const renderShopPage = async (req, res, next) => {
    try {
        const user = req.user;
        const category = req.query.category || '';
        const author = req.query.author || '';
        const search = req.query.search || '';
        const price = req.query.price || '';
        let page = req.query.page || 1;
        let limit = req.query.limit || 6;
        let sort = req.query.sort || '';

        page = parseInt(page) || 1;
        limit = parseInt(limit) || 6;
        let skip = (page - 1) * limit;

        let query = { isBlocked: { $ne: true } };//QUERYING DATA SET TO AN OBJECT FOR SIMPLYFING CODE WE CAN ALSO SET WRITE MANUALLY MONGODB

        if (category) {
            query.category = { $regex: '^' + escapeRegExp(category.trim()) + '\\s*$', $options: 'i' };
        }

        if (author) {
            query.authorName = { $regex: author, $options: "i" };
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { category: { $regex: search, $options: 'i' } },
                { authorName: { $regex: search, $options: 'i' } }
            ];
        }

        if (price) { // FILTER PRICE RANGES
            switch (price) {
                case 'under-449':
                    query.price = { $lt: 449 };
                    break;
                case '400-599':
                    query.price = { $gte: 400, $lte: 599 };
                    break;
                case 'above-600':
                    query.price = { $gt: 600 };
                    break;
            }
        }

        let sortQuery = { createdAt: -1 };
        if (sort === 'name_asc') sortQuery = { name: 1 };
        if (sort === 'name_desc') sortQuery = { name: -1 };
        if (sort === 'price_asc') sortQuery = { price: 1 };
        if (sort === 'price_desc') sortQuery = { price: -1 };

        const [
            products,
            managedCategories,
            rawCategoryValues,
            authors,
            wishlist,
            totalProducts
        ] = await Promise.all([
            Product.find(query).sort(sortQuery).skip(skip).limit(limit),

            Category.find({ status: { $ne: "inactive" } }),
            Product.distinct('category', { isBlocked: { $ne: true } }),

            Product.distinct('authorName', { isBlocked: { $ne: true } }),

            user ? Wishlist?.findOne({ userId: user.id }) : null,

            Product.countDocuments(query)
        ]);

        const activeCategoryNames = new Set(managedCategories.map(c => c.categoryName.trim().toLowerCase()));
        const hasManagedCategories = activeCategoryNames.size > 0;

        const categoryMap = new Map(); // dedupe case-insensitively, keep first-seen display casing
        rawCategoryValues.forEach(value => {
            if (!value) return;
            const trimmed = value.trim();
            const key = trimmed.toLowerCase();
            if (!trimmed) return;
            if (hasManagedCategories && !activeCategoryNames.has(key)) return;
            if (!categoryMap.has(key)) categoryMap.set(key, trimmed);
        });
        const categories = Array.from(categoryMap.values())
            .sort((a, b) => a.localeCompare(b))
            .map(categoryName => ({ categoryName }));

        let wishlistItems = [];
        if (wishlist?.items?.length) {
            const wishlistProductIds = wishlist.items.map(item => item.productId);
            wishlistItems = await Product.find({ _id: { $in: wishlistProductIds } }).lean();
        }

        const totalPages = Math.ceil(totalProducts / limit);

        const responseData = {
            success: true,
            allProducts: products,
            totalProducts,
            totalPages,
            page,
            limit,
            price: price || "",
            search: search || "",
            category: category || "",
            author: author || "",
            categories,
            authors,
            errorMessage: products?.length === 0 ? "No products found." : null,
            user: req.user,
            wishlistItems,
            currentSort: sort || "default",

        };

        if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {//FETCH WITHOUT RENDERING
            return res.status(200).json(responseData);
        }

        return res.render("user/shop", responseData);
    } catch (error) {
        console.error('Shop page error:', error);
        next(new AppError(`Shop product error: ${error.message}`, 500));
    }
};


export const sortProducts = async (req, res, next) => {
    try {
        console.log("jello")
        const page = parseInt(req.query.page) || 1;
        const limit = 6;
        const skip = (page - 1) * limit;

        let sort = req.params.sort || "";//SORT TYPE
        console.log("Order sort:", sort);

        let sortCondition = {};

        switch (sort) {
            case "name_asc":
                sortCondition = { name: 1 };
                sort = 'A to Z'
                break;
            case "name_desc":
                sortCondition = { name: -1 };
                sort = 'Z to A'
                break;
            case "price_asc":
                sortCondition = { price: 1 };
                sort = 'Price: Low to High'
                break;
            case "price_desc":
                sortCondition = { price: -1 };
                sort = 'Price: High to Low'
                break;
            default:
                sortCondition = { createdAt: -1 };
        }

        console.log("sortCondition", sortCondition)//DEBUG
        const products = await Product.find({ isBlocked: false })
            .sort(sortCondition)
            .skip(skip)
            .limit(limit);

        const totalProducts = await Product.countDocuments({ isBlocked: false });
        const totalPages = Math.ceil(totalProducts / limit);

        return res.render("user/shop", {
            allProducts: products,
            page, limit,
            totalPages,
            success: true,
            price: req.query.price || "",
            search: req.query.search || "",
            category: null,
            author: req.query.author || "",
            categories: [],
            authors: [],
            errorMessage: products.length === 0 ? "No products found." : null,
            user: req.user,
            wishlistItems: [],
            currentSort: sort || '',
        });
    } catch (error) {
        next(new AppError(`Product sorting failed: ${error.message}`, 500));
    }
};


const recalculateProductRating = async (productId) => {
    const [result] = await Review.aggregate([
        { $match: { product: new mongoose.Types.ObjectId(productId) } },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);
    const averageRating = result ? Math.round(result.avg * 10) / 10 : 0;
    const ratingCount = result ? result.count : 0;
    await Product.findByIdAndUpdate(productId, { $set: { rating: averageRating } });
    return { averageRating, ratingCount };
};

export const rateProduct = async (req, res, next) => {
    try {
        const { rating } = req.body
        const productId = req.params.id
        const user = req.user

        const ratingNum = Number(rating)
        if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
            return res.status(400).json({ success: false, message: "Rating must be between 1 and 5" })
        }

        const product = await Product.findById(productId)
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" })
        }

        await Review.findOneAndUpdate(
            { user: user.id, product: productId },
            { $set: { rating: ratingNum } },
            { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
        )

        const { averageRating, ratingCount } = await recalculateProductRating(productId)

        return res.status(200).json({ success: true, message: "Rated", rating: averageRating, ratingCount })
    } catch (error) {
        return next(new AppError(`Rating product failed: ${error.message}`, 500))
    }
}


export const addReview = async (req, res, next) => {
    try {
        const { review, productId, rating } = req.body
        const user = req.user

        const ratingNum = Number(rating)
        if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
            return res.status(400).json({ success: false, message: "Please choose a star rating before submitting your review" })
        }
        if (!review || !review.trim() || review.trim().length < 5) {
            return res.status(400).json({ success: false, message: "Review must be at least 5 characters" })
        }

        const product = await Product.findById(productId)
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" })
        }

        await Review.findOneAndUpdate(
            { user: user.id, product: productId },
            { $set: { rating: ratingNum, comment: review.trim() } },
            { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
        )

        const { averageRating, ratingCount } = await recalculateProductRating(productId)

        return res.status(200).json({ success: true, message: "Review submitted", rating: averageRating, ratingCount })
    } catch (error) {
        return next(new AppError(`Adding review failed: ${error.message}`, 500))
    }
}
import mongoose from "mongoose"
import AppError from "../../utils/errorHandler.js"
import Product from "../../models/productSchema.js"
import Cart from "../../models/cartSchema.js"
import Wishlist from "../../models/wishListSchema.js"
import Order from "../../models/orderSchema.js"
import User from "../../models/userSchema.js"

export const renderWishListPage = async (req, res, next) => {
    try {
        const user = req.user;

        let wishlistItems = []
        const wishlist = await Wishlist.findOne({ userId: user.id })

        const itemsToRemove = [];//PUSH REMOVED ITEMS
        if (!wishlist) {
            return res.render('user/wishlist', {
                user,
                wishlist: null,
                wishlistItems: []
            })
        }

        const cart = await Cart.findOne({ userId: user.id })
        const cartProductIds = cart ? cart.items.map(i => i.productId.toString()) : [];

        for (let item of wishlist.items) {
            const product = await Product.findById(item.productId).lean()

            if (!product) {
                console.log(`Product not found for wishlist item, skipping`);
                continue;
            }

            //ONLY SHOW ITEMS NOT ALREADY IN CART (DISPLAY FILTER — DOES NOT MODIFY DB)
            if (!cartProductIds.includes(product._id.toString())) {
                wishlistItems.push(product)
            }
        }

        return res.render("user/wishlist", {
            user,
            wishlist,
            wishlistItems
        });

    } catch (error) {
        console.error("Wishlist error:", error);
        next(new AppError(`Wishlist failed : ${error}`, 500));
    }
};


export const addToWishlist = async (req, res, next) => {
    try {
        console.log("product id ", req.body)//DEBUG
        const productId = req.body.productId
        const user = req.user//FROM JWT TOKEN

        if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {//THIS WILL ENSURE INVALID ID FORMAT LIKE (_id:'abc').
            return res.status(400).json({ success: false, message: "Invalid or missing product ID" });
        }

        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: "User not authenticated" });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(400).json({ success: false, message: "Product not found" });
        }

        let wishlist = await Wishlist?.findOne({ userId: user.id });
        if (!wishlist) {
            //CREATE NEW WISHLIST FOR USER
            wishlist = new Wishlist({
                userId: user.id,
                items: [{ productId }]
            });
        } else {
            //ADDING TO WISHLIST WITH AVOID DUPLICATES
            if (!wishlist?.items.some(item => item.productId.toString() === productId)) {
                wishlist.items.push({ productId });
            } else {
                return res.status(400).json({ success: false, message: "Product already in wishlist" });
            }
        }

        await wishlist.save()

        return res.status(200).json({
            success: true,
            message: "Added to wishlist"
        })

    } catch (error) {
        next(new AppError(` Wishlist product adding faield : ${error} `, 500))
    }
}


export const deleteWishlist = async (req, res, next) => {
    try {
        const { productId } = req.body
        const user = req.user
        console.log("productId", productId)
        console.log("userId", user.id)

        if (!mongoose.isValidObjectId(productId)) {
            return res.status(400).json({ success: false, message: "Invalid Product ID format" });
        }
        const validProductId = new mongoose.Types.ObjectId(productId);

        const wishlist = await Wishlist.findOne({ userId: user.id });//GETING THE ID OF WISHLIST

        if (!wishlist) {
            return res.status(400).json({ success: false, message: "Wishlist not found" });
        }

        const validWishlistId = new mongoose.Types.ObjectId(wishlist._id)

        const result = await Wishlist.updateOne(
            { _id: validWishlistId, userId: user.id },
            { $pull: { items: { productId: validProductId } } }
        );

        console.log('Updated result : ', result);

        return res.status(200).json({
            success: true,
            message: "Product removed from wishlist"
        })

    } catch (error) {
        next(new AppError(`wishlist product deletion failed : ${error}`, 500))
    }
}


//=======================CART MANAGMENT==============================

export const renderCartManagment = async (req, res, next) => {
    try {
        const user = req.user
        const cartItems = await Cart?.findOne({ userId: user.id })//FIND CART

        if (!cartItems) {
            return res.render('user/cart', { user, allCartProducts: [], cartItems: [] });
        }

        let allCartProducts = [], totalAmount = 0
        for (let item of cartItems.items) {
            const product = await Product.findById(item.productId).lean()//LEAN FOR CLEAN JS OBJECT

            if (!product) {
                console.log(`Not product found in this cart`)
                return res.status(400).redirect('/shop')
            }

            //REMOVE BLOCKED PRODUCTS FROM CART 
            if (product.isBlocked) {
                cartItems.items.pull({ productId: product._id })
                await cartItems.save()
                continue;
            }

            totalAmount += item.quantity * product.price//CART TOTAL AMOUNT
            const cartProduct = {
                ...product,
                quantity: item.quantity,

            };
            allCartProducts.push(cartProduct);
        }

        //CHECK WHOLE STOCK COUNT GREATER THAN THEIR QUANTITY (TRUE/FALSE)
        const isAvailableStock = allCartProducts.every(product => product.stock >= product.quantity)
        
        return res.render("user/cart", {
            user,
            allCartProducts,
            cartItems, totalAmount, isAvailableStock
        })

    } catch (error) {
        console.log(error.message)
        next(new AppError(`Cart managment failed : ${error}`, 500))
    }
}

export const addToCart = async (req, res, next) => {
    try {
        const productId = req.body.productId
        const user = req.user
        console.log("productId : ", productId)
        console.log("user:", user.id)

        const product = await Product.findById(productId)

        //NULL CHECK MUST COME BEFORE ACCESSING ANY PROPERTY
        if (!product || product.isBlocked) {
            return res.status(400).json({
                success: false,
                message: "Product unavailable."
            })
        }

        if (product.stock <= 0) {
            return next(new AppError(`Out of stock`, 400))
        }

        let cart = await Cart.findOne({ userId: user.id })

        if (cart) {
            //FIND INDEX
            const existItemIndex = cart.items.findIndex(
                item => item.productId.toString() === productId.toString()
            )

            //CHECK ALREADY INCLUDES 
            if (existItemIndex >= 0) {

                //VALIDATE ADD QUANTITY
                if (cart.items[existItemIndex].quantity + 1 > product.stock) {
                    console.log('No enough stock')
                    return res.status(400).json({
                        success: false, message: "No enough stock"
                    })
                }

                //MINIMUM LIMIT ORDER(3) VALIDATE
                if (cart.items[existItemIndex].quantity + 1 > 3) {
                    return res.status(400).json({
                        success: false, message: "Order limit is reached"
                    })
                }

                //INCREASE QAUNTITY
                cart.items[existItemIndex].quantity += 1;


            } else {
                //IF NO CART AVAILABLE FOR USER CREATE NEW CART
                cart.items.push({
                    productId: new mongoose.Types.ObjectId(product._id),
                    quantity: 1,
                    stock: parseInt(product.stock)
                })

            }

            const saveCart = (await cart.save()) ? true : false

            if (!saveCart) {
                return res.status(400).json({
                    success: false, message: "Maximum limit reached"
                })
            }

        } else {
            //IF NO CART FOR USER. CREATE NEW ONE
            const addCart = new Cart({
                userId: new mongoose.Types.ObjectId(user.id),
                items:
                    [
                        {
                            productId: new mongoose.Types.ObjectId(product._id),
                            quantity: 1,
                            stock: parseInt(product.stock)
                        }
                    ]
            })
            await addCart.save()
            await product.save()
        }

        //REMOVE PRODUCT FROM WISH LIST IF ITS FROM ADDED FROM WISHLIST
        await Wishlist.findOneAndUpdate(
            { userId: user.id },
            { $pull: { items: { productId: productId } } }
        );


        return res.status(200).json({
            success: true,
            message: "Product is moved to cart"
        })
    } catch (error) {
        next(new AppError(`Add To cart Failed : ${error}`, 500))
    }
}

export const removeFromCart = async (req, res, next) => {
    try {
        const productId = req.params.id
        const user = req.user
        console.log("productId", productId)

        const product = await Product.findById(productId)
        const cartItem = await Cart.findOne({ userId: user.id })
        console.log("cartItem", cartItem)//DEBUG

        // const stockCount = cartItem.items.find(p => {
        //     if (p.productId.toString() == product._id.toString()) return p.quantity
        // })
        // console.log("stockCount before", stockCount.quantity)

        const updateCart = await Cart.updateOne(
            { userId: user.id },
            {
                $pull: { items: { productId: product._id } }
            }
        )

        if (!updateCart) {
            return res.status(200).json({
                success: false,
                message: "Removing failed "
            })
        }
        return res.status(200).json({
            success: true,
            message: "Product is removed from cart"
        })
    } catch (error) {
        next(new AppError(`Remove cart data Failed : ${error}`, 500))
    }
}


export const updateQuantity = async (req, res, next) => {
    try {
        const productId = req.params.id
        const newQty = req.body.quantity//+ve
        const minusQty = req.body.minusQty//-ve
        const user = req.user

        const product = await Product.findById(productId)
        console.log("current stock:", product.stock)

        const cart = await Cart.findOne({ userId: user.id })
        console.log('cart', cart)

        //CONDITION FOR ADD QUANTITY
        if (newQty) {

            if (newQty > product.stock) {
                return res.status(400).json({
                    success: false,
                    message: "No enough stock"
                })
            }

            //LIMIT 3
            if (newQty > 3) {
                return res.status(400).json({
                    success: false, message: "Quantity maximum 3"
                })
            }
            console.log("newQty :", newQty)
            console.log("current stock:", product.stock)

            const item = cart.items.find(item => item.productId.toString() === product._id.toString())
            if (!item) {
                return res.status(400).json({
                    success: false,
                    message: "Item not found in cart"
                })
            }

            item.quantity += 1//INCREASE QTY BY 1
            await cart.save()
        }

        //CONDITION FOR MINUS QUANTITY
        if (minusQty) {
            console.log("newQty :", newQty)
            console.log("current stock:", product.stock)

            const item = cart.items.find(item => item.productId.toString() === product._id.toString())
            if (!item) {
                return res.status(400).json({
                    success: false,
                    message: "Item not found in cart"
                })
            }

            item.quantity -= 1//DECREASE QTY

            await cart.save()
            console.log("updated Stock :", product.stock)
        }
        
        return res.status(200).json({
            success: true,
            message: "Done"
        })
    } catch (error) {
        next(new AppError(`Update quantity failed : ${error}`, 500))
    }
}






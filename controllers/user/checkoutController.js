import mongoose from "mongoose"
import User from "../../models/userSchema.js"
import AppError from "../../utils/errorHandler.js"
import Product from "../../models/productSchema.js"
import Category from "../../models/categorySchema.js"
import Address from "../../models/addressSchema.js"
import Cart from "../../models/cartSchema.js"
import Wishlist from "../../models/wishListSchema.js"
import Order from "../../models/orderSchema.js"
import Offer from "../../models/offersSchema.js"
import Coupon from "../../models/couponSchema.js"



//==========================CHECKOUT MANAGEMENT===============================
export const renderCheckoutPage = async (req, res, next) => {
    try {
        const user = req.user
        const cartId = req.params.id
        const rawAddresses = await Address.find({ userId: user.id })

        const defaultIdx = rawAddresses.findIndex(a => a.isDefault);
        const selectedIdx = defaultIdx >= 0 ? defaultIdx : 0;
        const address = rawAddresses.map((a, i) => ({
            ...a.toObject(),
            isSelected: i === selectedIdx
        }))

        const userCart = await Cart.findById(cartId)//FETCH CART DATA

        //CHECK CART HAVE DATA
        if (userCart.items.length <= 0) {
            return res.status(400).redirect('/shop')
        }

        const offers = await Offer.find()

        const now = new Date()
        const allCoupons = await Coupon.find({ isActive: true, isUsed: { $nin: [user.id] } })
            .sort({ createdAt: -1 })
        const coupons = allCoupons.filter(c => now <= c.expiryDate)

        let subTotal = 0
        let totalDiscount = 0
        let bestOffer
        let shippingCharge = 99
        let finalPrice = shippingCharge
        const checkoutProducts = []

        //
        for (let item of userCart.items) {
            const product = await Product.findById(item.productId).lean()
                .populate('offers')//LOOKUP 

            const category = await Category.findOne({ categoryName: product.category })
                .populate('offers')

            if (!product) {
                console.log(`Not product found in this cart`)
                throw new Error('Product not found in cart')
            }

            //VALIDATE STOCK AVAILABILITY
            if (product.stock === 0 || product.stock < item.quantity) {
                console.log('Out of stock')
                return res.status(400).redirect('/cart')
            }

            let discountValue = (product.bestOffer / 100) * product.price//CALCULATE EACH PRODUCT DISCOUNT
            console.log(product.bestOffer, 'product.bestOffer')
            subTotal += (product.price * item.quantity)//CHECKOUT TOTAL WIHOUT DISCOUNT
            totalDiscount += parseInt(discountValue) || 0;
            console.log(totalDiscount)

            finalPrice += (product.price * item.quantity) - (discountValue || 0)  //PRICE USER WANT TO PAY
            checkoutProducts.push(product);
        }

        let appliedCoupon
        //WHEN USER APPLIED COUPON ITS WILL STORE IN SESSION
        if (req.session.applyCoupon) {
            finalPrice = req.session.applyCoupon.totalAmount
            appliedCoupon = req.session.applyCoupon.coupon
        }

        console.log("finalPrice : ", finalPrice)

        req.session.orderDetails = finalPrice//FOR GETTING REALTIME UPDATE FRONTEND

        console.log("checkoutProducts", checkoutProducts)
        res.render('user/checkout', {
            user,
            address,
            finalPrice,
            checkoutProducts,
            userCart,
            subTotal,
            shippingCharge,
            totalDiscount: Number(totalDiscount),
            coupons,
            appliedCoupon
        })
    } catch (error) {
        next(new AppError(`Checkout page : ${error}`, 500))
    }
}


export const confirmOrder = async (req, res, next) => {
    try {
        const user = req.user
        const {
            addressId,
            paymentMethod,
            paymentStatus,
            subTotal,
            shippingCharge,
            finalPrice,
            discount,
            // currency,
            // receipt,
            // notes  
        } = req.body
        console.log(req.body, 'confimr order req.body')

        if (!paymentMethod) {
            return res.status(400).json({
                success: false,
                message: "Please select payment method"
            })
        }

        console.log("paymentMethod :", paymentMethod)

        let address = "";

        if (addressId) {
            address = await Address.findById(addressId) || "";
        }
        console.log('Delivery Address :', address)

        if (!address) {
            address = await Address.findOne({ userId: user.id, isDefault: true });
            if (!address) {
                return res.status(400).json({
                    success: false,
                    message: "Please select address"
                })
            }
        }

        const totalAmount = req.session.orderDetails
        console.log("totalAmount : ", totalAmount)

        //CREATE ORDERID
        const orderID = `ORD-${Date.now()}`;
        console.log("orderID :", orderID)

        const cart = await Cart.findOne({ userId: user?.id })

        // Two passes on purpose: validate every cart item FIRST, then only mutate stock once
        // everything has passed. Doing the stock decrement inside the same loop as validation
        // meant that if item #3 (say) failed its stock check, items #1 and #2 had already had
        // their stock permanently decremented and saved — with no order ever created to back
        // it, and the cart left untouched. That's a real inventory leak on every checkout that
        // fails partway through.
        const products = []
        for (let item of cart.items) {
            const product = await Product.findById(item.productId)

            if (!product) {
                console.log(`Not product found in this cart`)
                throw new Error('Product not found in cart')
            }

            //VALIDATE STOCK AVAILABILITY
            if (product.stock === 0 || product.stock < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Out of stock`
                })
            }

            products.push({ product, quantity: item.quantity })
        }

        let items = []
        for (let { product, quantity } of products) {
            items.push({
                productId: product._id,
                productName: product.name,
                price: Number(product.price),
                quantity: quantity,
                discountPrice: Number((product.bestOffer / 100) * product.price) || 0
            })

            //UPDATE INVENTORY
            product.stock -= quantity
            await product.save()
        }

        const coupon = req.session.applyCoupon || null

        console.log(coupon)
        const newOrder = new Order({
            userId: user.id,
            orderId: orderID,
            addressId: address._id,
            payment: paymentMethod,
            items,
            shippingCharge: parseInt(shippingCharge),
            discount: parseInt(discount),
            subTotal: parseInt(subTotal),
            totalAmount: parseInt(finalPrice),
            paymentStatus: paymentStatus,
            coupon: coupon?.coupon?._id,
            isCouponAvailable: (coupon) ? true : false
        })

        req.session.applyCoupon = null //CLEAR COUPON FROM SESSOIN APPLIED ONE

        const saveOrder = await newOrder.save()
        console.log(`New order saved ${saveOrder}`)

        if (!saveOrder) {
            return res.json({
                success: false, message: "Order failed"
            })
        }

        //MARK COUPON AS USED ONLY AFTER ORDER IS SAVED SUCCESSFULLY
        if (coupon?.coupon?._id) {
            await Coupon.findByIdAndUpdate(coupon.coupon._id, {
                $addToSet: { isUsed: user.id }
            })
        }

        //REMOVE CART ITEMS
        await Cart.findByIdAndUpdate(cart._id, { $set: { items: [] } })
        req.session.order = saveOrder
        return res.status(200).json({
            success: true, message: "Order confirmed"
        })
    } catch (error) {
        next(new AppError(`Checkout Confirm order : ${error}`, 500))
    }

}


export const successPage = async (req, res, next) => {
    try {
        const userId = req.user
        console.log("req.session.order", req.session.order)

        if (!req.session.order) {
            return res.redirect('/')
        }

        const user = await User.findById(userId.id)
        const orders = await Order.findById(req.session.order._id);
        console.log("Order details : ", orders)

        // Fetch delivery address for the confirmation page
        let deliveryAddress = null;
        if (orders && orders.addressId) {
            deliveryAddress = await Address.findById(orders.addressId);
        }

        req.session.order = null
        return res.render('user/orderConfirmed', {
            user,
            orders,
            deliveryAddress
        })
    } catch (error) {
        next(new AppError(`Order confirmation failed : ${error}`, 500))
    }
}


export const applyCoupon = async (req, res, next) => {
    try {
        const { couponCode, totalAmount } = req.body
        const user = req.user
        console.log(req.body)
        const coupon = await Coupon.findOne({ couponCode })
        if (!coupon) {
            return res.status(400).json({ success: false, message: "Invalid coupon code" })
        }

        //VALIDATE MULTIPLE USAGE SAME COUPON
        if (coupon.isUsed.some(id => id.toString() === user.id)) {
            return res.status(400).json({ success: false, message: 'Already used this coupon' });
        }

        if (new Date > coupon.expiryDate) {
            return res.status(400).json({ success: false, message: "Coupon has expired" })
        }

        if (totalAmount < coupon.minPurchase) {
            return res.status(400).json({ success: false, message: `Minimum purchase is ${coupon.minPurchase}` })
        }

        let discountAmount = coupon.discountValue

        // if (discountAmount > coupon.maxDiscount) {
        //     discountAmount = coupon.maxDiscount
        // }

        let totalAmountWithCoupon = totalAmount - discountAmount

        //FOR SEE APPLIED COUPON IN CHECKOUT PAGE
        req.session.applyCoupon = { coupon, totalAmount: totalAmountWithCoupon }

        return res.status(200).json({
            success: true,
            message: `Coupon applied! You saved ₹${discountAmount.toFixed(2)}`,
            totalAmountWithCoupon,
            discountAmount,
            couponId: coupon._id,
            couponCode: coupon.couponCode
        })
    } catch (error) {
        next(new AppError(`Apply coupon failed ${error}`, 500))
    }
}


export const removeCoupon = async (req, res, next) => {
    try {
        const applied = req.session.applyCoupon
        // Restore the pre-coupon total symmetrically from what was subtracted at apply-time,
        // instead of recomputing from the cart — keeps it exact and avoids re-fetching products.
        const restoredTotal = applied ? applied.totalAmount + applied.coupon.discountValue : null

        req.session.applyCoupon = null
        return res.status(200).json({ success: true, message: "Coupon removed", finalPrice: restoredTotal });
    } catch (error) {
        next(new AppError(`Remove coupon failed: ${error.message}`, 500));
    }
};

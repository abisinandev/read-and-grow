import { render } from "ejs"
import Order from "../../models/orderSchema.js"
import AppError from "../../utils/errorHandler.js"
import Address from "../../models/addressSchema.js"
import mongoose from "mongoose"
import User from "../../models/userSchema.js"
import Product from "../../models/productSchema.js"
import Category from "../../models/categorySchema.js"
import Wallet from "../../models/walletSchema.js"
import Coupon from "../../models/couponSchema.js"


export const getOrderPage = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const query = req.query.query || '';
        let skip = (page - 1) * limit;

        const basePipeline = [
            { $unwind: "$items" },
            { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "customer" } },
            { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
            { $lookup: { from: "products", localField: "items.productId", foreignField: "_id", as: "product" } },
            { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
        ];

        if (query) {
            basePipeline.push({
                $match: {
                    $or: [
                        { orderId: { $regex: query, $options: "i" } },
                        { "customer.username": { $regex: query, $options: "i" } },
                        { "customer.email": { $regex: query, $options: "i" } }
                    ]
                }
            });
        }

        const allOrders = await Order.aggregate([
            ...basePipeline,
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit }
        ])

        const totalOrdersCountResult = await Order.aggregate([
            ...basePipeline,
            { $count: "count" }
        ]);
        const totalOrders = totalOrdersCountResult[0]?.count || 0;
        const totalPages = Math.ceil(totalOrders / limit);

        if (!allOrders.length) {
            if (req.headers["x-requested-with"] === "XMLHttpRequest") {
                return res.status(200).json({ success: true, allOrders: [], totalOrders, totalPages, limit, page });
            }
            return res.render('admin/orders', {
                allOrders: [],
                limit,
                page,
                skip,
                totalOrders,
                totalPages,
                query
            })
        }

        if (req.headers["x-requested-with"] === "XMLHttpRequest") {
            return res.json({
                success: true,
                allOrders,
                totalOrders,
                totalPages,
                limit,
                page
            });
        }

        return res.render('admin/orders', {
            allOrders,
            limit,
            page,
            skip,
            totalOrders,
            totalPages,
            query
        });

    } catch (error) {
        next(new AppError(`Admin order management error: ${error}`, 500));
    }
};


export const viewOrder = async (req, res, next) => {
    try {
        const orderId = req.params.orderId
        const productId = req.params.productId

        const order = await Order.findById(orderId)
            .populate("addressId")
            .populate('coupon')

        if (!order) {
            return res.status(404).redirect('/admin/orders')
        }

        console.log(order)
        const user = await User.findById(order.userId)

        let index
        let totalQty = 0
        order.items.forEach((item, i) => {
            if (item.productId.toString() == productId) {
                index = i
            }
            totalQty += item.quantity
        });

        // The URL's productId should always match one of the order's items when reached
        // through a normal "View Details" click, but a stale/edited link (or item data that's
        // shifted since the link was generated) previously crashed here instead of failing
        // cleanly — order.items[undefined] is undefined, and Product.findById(undefined.productId)
        // throws.
        if (index === undefined) {
            return res.status(404).redirect('/admin/orders')
        }

        // A product that's since been deleted from the catalog leaves this null — the page
        // used to crash rendering the product image/name/category rather than showing the
        // order with a "product no longer available" note.
        const viewOrder = await Product.findById(order.items[index].productId)
        console.log(viewOrder, 'vieworder')

        return res.render('admin/orderDetails', {
            order, index
            , user, viewOrder, totalQty
        })

    } catch (error) {

        next(new AppError(` viewOrder detials : ${error}`, 500))
    }
}

export const updateStatus = async (req, res, next) => {
    try {
        const { action, productId } = req.body;
        const orderId = req.params.orderId;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        const index = order.items.findIndex(item => item.productId.toString() === productId);
        if (index === -1) {
            return res.status(404).json({ success: false, message: "Product not found in the order" });
        }

        const item = order.items[index];

        switch (action) {
            case "Pending":
                if (item.status !== "Cancelled") {
                    item.status = "Pending";
                } else {
                    return res.status(400).json({ success: false, message: "Product already cancelled" });
                }
                break;

            case "Cancelled":
                if (item.status === "Delivered") {
                    return res.status(400).json({ success: false, message: "Delivered items cannot be cancelled" });
                }
                item.status = "Cancelled";
                item.isCancelled = true;
                break;

            case "Delivered":
                if (item.status === "Cancelled") {
                    return res.status(400).json({ success: false, message: "Cancelled items cannot be marked as Delivered" });
                }else if (item.status === 'Returned'){
                    return res.status(400).json({ success: false, message: "Returned items cannot be marked as Delivered" });
                }
                item.status = "Delivered";
                item.isReturned = false;
                order.paymentStatus = "paid";
                break;

            case "Returned":
                if (item.status === "Delivered") {
                    item.status = "Returned";
                    item.isReturned = true;
                    order.paymentStatus = 'refunded';
                } else {
                    return res.status(400).json({ success: false, message: "Only delivered items can be returned" });
                }
                break;

            default:
                return res.status(400).json({ success: false, message: "Invalid status action" });
        }

        if (order.items.every(item => item.status === "Delivered")) {
            order.status = "Delivered";
        } else if (order.items.every(item => item.status === "Cancelled")) {
            order.status = "Cancelled";
        } else if (order.items.some(item => item.status === "Returned")) {
            order.status = "Returned";
        }

        await order.save();
        return res.status(200).json({ success: true, message: "Status updated successfully" });

    } catch (error) {
        next(new AppError(`Update status failed: ${error.message}`, 500));
    }
};


export const acceptReturn = async (req, res, next) => {
    try {
        const { productId, orderId } = req.params;

        //FIND ORDERS WITH LOOKUP COUPON
        const orders = await Order.findById(orderId).populate('coupon');

        if (!orders) throw new AppError('Order not found', 404);

        const product = await Product.findById(productId);
        if (!product) throw new AppError('Product not found', 404);

        const userId = orders.userId;

        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            wallet = await Wallet.create({
                userId,
                balance: 0,
                transactions: []
            });
        }

        const transactionID = `TRANS-${Date.now()}`;
        let applyCouponAmount = 0
        applyCouponAmount = orders.coupon?.discountValue || 0;

        let refundAmount = 0
        for (let orderItem of orders.items) {
            if (orderItem.productId.toString() === productId.toString()) {

                //TAKE UNCANCELLED PRODUCTS
                const remainingItems = orders.items.filter(item =>
                    item.status !== 'Cancelled' &&
                    item.status !== 'Returned'
                );

                let remainingItemsTotal = applyCouponAmount;//REMAINING ITEMS TOTAL PRICE
                for (let item of remainingItems) {
                    const discount = item.discountPrice || 0;//PRODUCT OR CATEGORY OFFERS 
                    remainingItemsTotal += (item.price - discount) * item.quantity;
                }
                console.log("remainingItemsTotal", remainingItemsTotal);//DEBUG

                //PAID AMOUNT GREATER THAN MINIMUM PURCHASE
                if (orders.coupon && remainingItemsTotal >= orders.coupon?.minPurchase) {

                    if (orderItem.discountPrice > 0) {
                        refundAmount += (orderItem.price * orderItem.quantity) - orderItem.discountPrice
                        orders.totalAmount -= refundAmount
                    } else {
                        refundAmount += (orderItem.price * orderItem.quantity)
                        orders.totalAmount -= refundAmount
                    }

                } else {
                    if (orders.coupon) {
                        // remainingItemsTotal -= orders.coupon.discountValue
                        refundAmount -= orders.coupon.discountValue//KEEP -VE COUPON VALUE REFUNDAMOUNT ITS WILL SOLVE WHEN PRODUCT AMOUNT ADDED
                        orders.isCouponAvailable = false//MAKE COUPON FALSE

                        //REMOVE APPLIED COUPON 
                        await Coupon.findByIdAndUpdate(
                            orders.coupon._id,
                            { $pull: { isUsed: userId } }//MARK UNUSED
                        );
                        console.log(`Coupon amount ${applyCouponAmount} reverted`);

                    }

                    //REFUND SETTING
                    if (orderItem.discountPrice > 0) {
                        refundAmount += (orderItem.price * orderItem.quantity) - orderItem.discountPrice
                        orders.totalAmount -= refundAmount
                    } else {
                        refundAmount += (orderItem.price * orderItem.quantity)
                        orders.totalAmount -= refundAmount
                    }
                }

                console.log(refundAmount, "refundAmount without coupon")

                //UPDATE INVENTORY
                await Product.findByIdAndUpdate(productId, { $inc: { stock: orderItem.quantity } })
                orderItem.status = 'Returned',
                    orderItem.isReturned = true
                orderItem.isRequested = false

                //UPDATE WALLET
                wallet.balance += Number(refundAmount) || 0;
                wallet.transactions.push({
                    orderId: orders._id,
                    transactionId: transactionID,
                    amount: Number(refundAmount),
                    transactionType: 'credit',
                    source: 'refund',
                    createdAt: new Date(),
                    productId
                });
            }
            console.log("userWallets ", wallet)
        }

        if (orders.items.every(item => item.status === 'Returned' || item.status === 'Cancelled')) {
            orders.paymentStatus = 'Refunded';
        }
        if (orders.items.every(item => item.status === 'Cancelled')) {
            orders.status = 'Cancelled';
        } else if (orders.items.every(item => item.status === 'Returned')) {
            orders.status = 'Returned';
        }

        //SAVE UPDATES
        await orders.save();
        await wallet.save();

        return res.status(200).json({
            success: true,
            message: 'Order returned successfully',
            refundAmount,
            walletBalance: wallet.balance,
            order: orders
        });

    } catch (error) {
        next(new AppError(`Accept return failed: ${error.message}`, 500));
    }
};



export const rejectReturn = async (req, res, next) => {
    const productId = req.params.productId
    const orderId = req.params.orderId
    try {
        // Previously this looped over EVERY item in the order and cleared isRequested on all
        // of them — so rejecting one item's return request silently wiped out any OTHER item's
        // separate pending return request in the same order. Now it targets only the item this
        // request is actually about.
        const order = await Order.findOneAndUpdate(
            { _id: orderId, "items.productId": productId },
            { $set: { "items.$.isRequested": false } },
            { new: true }
        );

        if (!order) {
            return res.status(404).json({ success: false, message: "Order or item not found" });
        }

        return res.status(200).json({ success: true, message: "Request rejected" })
    } catch (error) {
        next(new AppError(`Reject return request failed ${error}`, 500))
    }
}
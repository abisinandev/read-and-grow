import User from "../../models/userSchema.js";
import Order from "../../models/orderSchema.js";
import Coupon from "../../models/couponSchema.js";
import AppError from "../../utils/errorHandler.js"; // Assuming you have an error handler
import moment from "moment";
import PDFDocument from "pdfkit";
import { format } from "date-fns";
// import createDateFilter from "../utils/dateFilter.js"; // Ensure correct utility function
// import createTable from "../utils/pdfTable.js"; 
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Category from "../../models/categorySchema.js";
import Product from "../../models/productSchema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


export const adminDashboardGet = async (req, res, next) => {
    try {
        //RENDER DASHBOARD
        res.render("admin/dashboard")
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
};


export const updateDashboard = async (req, res, next) => {
    try {
        const { filter, startDate, endDate } = req.query;

        const filterDate = dateFilter(filter, startDate, endDate);//FILTER DATES

        //TAKEING ALL DATA ACCORDING TO FILTER DATA
        const topProduct = await getTopProducts(filterDate);
        const totalSales = await getTotalSales(filterDate);
        const countProducts = await getTotalProductsSold(filterDate);
        const totalCoupons = await getActiveCouponsCount();
        const deliveredOrdersCount = await getDeliveredOrdersCount(filterDate);
        const dailySales = await getDailySales(filterDate);
        const categoryBasedSales = await getCategoryBasedSales(filterDate);
        const topSellingBooks = await getTopSelledItems(filterDate)

        return res.json({
            dailySales,
            categoryBasedSales,
            topProduct,
            totalSales,
            countProducts,
            totalCoupons,
            deliveredOrdersCount,
            topSellingBooks
        });
    } catch (error) {
        console.error(`Update graph failed: ${error.message}`);
        return res.status(500).json({ message: 'Update graph failed' });
    }
};

// FILTER FUNCTION
const dateFilter = (filter, startDate, endDate) => {
    const now = new Date();
    let start;

    switch (filter) {
        case 'daily':
            start = new Date(now.setHours(0, 0, 0, 0));
            return { createdAt: { $gte: start } };

        case 'weekly':
            start = new Date(now.setDate(now.getDate() - now.getDay()));
            start.setHours(0, 0, 0, 0);
            return { createdAt: { $gte: start } };

        case 'monthly':
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            return { createdAt: { $gte: start } };

        case 'yearly':
            start = new Date(now.getFullYear(), 0, 1);
            return { createdAt: { $gte: start } };

        case 'custom':
            if (!startDate || !endDate) throw new Error('Start and end dates are required for custom filter');
            return {
                createdAt: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            };

        default:
            return {};
    }
};

const getTopProducts = async (dateFilter) => {
    return Order.aggregate([
        { $match: dateFilter },//MATCH FILTER DATE
        { $unwind: "$items" },//TAKE EACH ITEMS SEPERATELY
        { $match: { "items.status": "Delivered" } },//MATCH DELIVERED ITEMS
        {
            $group: {
                _id: "$items.productId",
                quantity: { $sum: "$items.quantity" },
                totalSales: { $sum: { $multiply: ["$items.quantity", "$items.price"] } }//FIND SALES PRICE 
            }
        },
        {
            //LOOKUP PRODUCT DETAILS
            $lookup: {
                from: "products",
                localField: "_id",
                foreignField: "_id",
                as: "productDetails"
            }
        },
        { $sort: { totalSales: -1 } }//SORT WITH ASCENDING
    ]);
};

const getTotalSales = async (dateFilter) => {
    //ALL DELIVERED PRODUCTS PRICES
    return Order.aggregate([
        { $match: dateFilter },
        { $unwind: "$items" },
        { $match: { "items.status": "Delivered" } },
        { $group: { _id: null, totalSum: { $sum: "$items.price" } } }
    ]);
};

const getTotalProductsSold = async (dateFilter) => {
    //FIND TOTAL PRODUCT SOLD USING THEIR QTY
    return Order.aggregate([
        { $match: dateFilter },
        { $unwind: "$items" },
        { $match: { "items.status": "Delivered" } },
        {
            $group: {
                _id: "$items.productId",
                quantity: { $sum: "$items.quantity" },
                totalSales: { $sum: { $multiply: ["$items.quantity", "$items.price"] } }
            }
        },
        {
            $lookup: {
                from: "products",
                localField: "_id",
                foreignField: "_id",
                as: "productDetails"
            }
        },
        { $sort: { totalSales: -1 } },
        {
            $group: {
                _id: null,
                totalSoldProducts: { $sum: "$quantity" }
            }
        }
    ]);
};

const getActiveCouponsCount = async () => {
    //GET ACTIVE COUPONS COUNTS
    return Coupon.countDocuments({ isActive: true });
};

const getDeliveredOrdersCount = async (dateFilter) => {
    //FIND DELIVERED ORDER COUNTS
    return Order.aggregate([
        { $match: dateFilter },
        { $unwind: "$items" },
        { $match: { "items.status": "Delivered" } },
        { $group: { _id: null, count: { $sum: 1 } } }
    ]).then(result => result[0]?.count || 0);
};

const getDailySales = async (dateFilter) => {
    return Order.aggregate([
        { $match: dateFilter },
        { $unwind: "$items" },
        { $match: { "items.status": "Delivered" } },
        {
            $group: {
                _id: {
                    $dateToString: {
                        format: "%Y-%m-%d",
                        date: "$createdAt"
                    }
                },
                totalSales: { $sum: "$items.price" }
            }
        },
        { $sort: { _id: 1 } }
    ]);
};

const getCategoryBasedSales = async (dateFilter) => {
    const allOrders = await Order.aggregate([
        { $match: dateFilter },
        { $unwind: "$items" },
        { $match: { "items.status": "Delivered" } }
    ]);
    const products = await Product.find();
    const categoryBasedSales = {};

    for (const product of products) {
        for (const order of allOrders) {
            if (order.items.productId.toString() === product._id.toString()) {
                categoryBasedSales[product.category] = (categoryBasedSales[product.category] || 0) + 1;
            }
        }
    }
    return categoryBasedSales;
};

const getTopSelledItems = async (dataFilter) => {
    const allOrders = await Order.aggregate([
        { $match: dataFilter },
        { $unwind: "$items" },
        { $group: { _id: "$items.productId", totalQty: { $sum: "$items.quantity" } } },
        { $sort: { "totalQty": -1 } },
        { $limit: 3 },
    ])

    const topProducts = []
    for (let order of allOrders) {
        const products = await Product.findById(order._id)
        topProducts.push(products)
    }

    return topProducts
}








import Coupon from "../../models/couponSchema.js"
import AppError from "../../utils/errorHandler.js"


export const renderCouponsPage = async (req, res, next) => {
    try {
        let { page, limit } = req.query
        page = parseInt(page) || 1
        limit = parseInt(limit) || 6
        const skip = (page - 1) * limit

        const coupons = await Coupon.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)

        console.log("coupon : ", coupons)

        const totalCoupons = await Coupon.find().countDocuments()
        const totalPages = Math.ceil(totalCoupons / limit)

        return res.render('admin/coupon', {
            totalCoupons,
            totalPages,
            page, limit,
            coupons
        })
    } catch (error) {
        next(new AppError(`Coupons page :${error}`, 500))
    }
}

export const renderAddCoupon = async (req, res, next) => {
    try {
        return res.render('admin/addCoupon')
    } catch (error) {
        next(new AppError(`Add coupon page failed : ${error}`, 500))
    }
}

export const addCoupon = async (req, res, next) => {
    try {
        console.log('hello')
        const {
            couponCode,
            discountValue,
            expiryDate,
            minPurchase,
            maxDiscount,
            isActive
        } = req.body

        if (!couponCode || !discountValue || !expiryDate || !minPurchase || !maxDiscount) {
            return res.status(400).json({ success: false, message: "All fields are required" })
        }

        if (maxDiscount < discountValue) {
            return res.status(400).json({ success: false, message: "maxDiscount must be greater than discount value" })
        }

        const newCoupon = new Coupon({
            couponCode,
            discountValue,
            expiryDate,
            minPurchase,
            maxDiscount,
            isActive
        })

        const save = await newCoupon.save()
        console.log('save coupone', save)
        return res.status(201).json({ success: true, message: 'Coupon created' })
    } catch (error) {
        next(new AppError(`Coupon adding ${error} `, 500))
    }
}


export const deleteCoupon = async (req, res, next) => {
    try {

        const coupon = await Coupon.findById(req.params.id)
        if (!coupon) {
            return res.status(400).json({ success: false, message: 'Not found coupon' })
        }
        await Coupon.findByIdAndDelete(coupon._id)
        return res.status(200).json({
            success: false, message: 'coupon removed from the list'
        })
    } catch (error) {
        next(new AppError(`delete coupon Failed : ${error}`, 500))
    }
}

export const renderEditCoupon = async (req, res, next) => {
    try {
        if (req.params.id) {
            const coupon = await Coupon.findById(req.params.id)

            return res.render('admin/editCoupon', { coupon })
        }
        return res.status(400).json({ success: false, message: 'Coupon not found' })
    } catch (error) {
        next(new AppError(`edit coupon page failed : ${error}`, 500))
    }
}

export const editCoupon = async (req, res, next) => {
    try {
        console.log(req.params.id, 1)
        const couponId = req.params.id
        const {
            couponCode,
            discountValue,
            expiryDate,
            minPurchase,
            maxDiscount,
            isActive
        } = req.body

        if (couponId) {
            await Coupon.findByIdAndUpdate(couponId, {
                $set: {
                    couponCode,
                    discountValue,
                    expiryDate,
                    minPurchase,
                    maxDiscount,
                    isActive
                }
            })

            return res.status(200).json({ success: true, message: "Coupon updated" })
        }

        return res.status(400).json({ success: false, message: "Coupon is not found" })
    } catch (error) {
        next(new AppError(`Edit coupon failed : ${error}`, 500))
    }
}
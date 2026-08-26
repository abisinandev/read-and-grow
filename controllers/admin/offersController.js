import Category from "../../models/categorySchema.js"
import Offer from "../../models/offersSchema.js"
import Product from "../../models/productSchema.js"
import AppError from "../../utils/errorHandler.js"


export const renderOffersPage = async (req, res, next) => {
    try {
        let { page, limit } = req.query
        page = parseInt(page) || 1
        limit = parseInt(limit) || 5
        const skip = (page - 1) * limit
        const offers = await Offer.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('productId')
            .populate('categoryId')

        // console.log("offers :", offers)

        const products = await Product.find()
            .populate('offers')
        const categories = await Category.find()
            .populate('offers')

        let currentDate = new Date
        for (let offer of offers) {
            if (currentDate > offer.validTo) {
                await Offer.findByIdAndUpdate(offer._id, { $set: { status: false } })
            }
        }


        let bestOffer = 0;
        for (let product of products) {
            let productOffer = (product.offers.length > 0) ?
                product.offers.filter(o => o.status !== false)
                    .reduce((acc, curr) => curr.discountPercentage > acc.discountPercentage ? curr : acc, { discountPercentage: 0 }) : null
            console.log('productOffers', productOffer)

            let categoryOffer
            for (let category of categories) {
                if (category.categoryName === product.category) {
                    categoryOffer = (category?.offers.length > 0) ?
                        category.offers.filter(o => o.status !== false)
                            .reduce((acc, curr) => curr.discountPercentage > acc.discountPercentage ? curr : acc, { discountPercentage: 0 }) : null;
                }
            }
            console.log(categoryOffer, 'category offer')

            productOffer = productOffer && productOffer.discountPercentage > 0 ? productOffer : null;
            categoryOffer = categoryOffer && categoryOffer.discountPercentage > 0 ? categoryOffer : null;

            if (productOffer && categoryOffer) {
                bestOffer = (productOffer.discountPercentage > categoryOffer.discountPercentage) ? productOffer : categoryOffer;
            } else {
                bestOffer = productOffer || categoryOffer;
            }

            if (bestOffer) {
                await Product.findByIdAndUpdate(product._id, { $set: { bestOffer: bestOffer?.discountPercentage } })
            } else {
                await Product.findByIdAndUpdate(product._id, { $unset: { bestOffer: "" } })
            }
            console.log("product with Bestoffer:", bestOffer);


        }


        const totalOffers = await Offer.find().countDocuments()
        const totalPages = Math.ceil(totalOffers / limit)
        res.render("admin/offers", {
            totalOffers, totalPages, page, limit, offers
        })
    } catch (error) {
        next(new AppError(`Offer mangament Failed : ${error}`, 500))
    }
}


export const renderAddOffers = async (req, res, next) => {
    try {
        const product = await Product.find().sort({ createdAt: -1 })
        const category = await Category.find()
        res.render('admin/addOffers', { product, category })

    } catch (error) {
        next(new AppError(`Add offers page Failed :${error}`, 500))
    }
}

export const addOffers = async (req, res, next) => {
    try {
        console.log(req.body, "add offers")
        const {
            offerName,
            discountPercentage,
            validFrom,
            validTo,
            offerType,
            status,
            categoryId,
            productId } = req.body

        if (!offerName || !discountPercentage || !validFrom || !validTo || !offerType) {
            return res.status(400).json({ success: false, message: "Please add required field" })
        }

        const newOffer = new Offer({
            offerName,
            discountPercentage,
            offerType,
            productId: offerType === 'Product' ? productId : undefined,
            categoryId: offerType === 'Category' ? categoryId : undefined,
            validFrom,
            validTo,
            status,
        })

        const saveOffer = await newOffer.save()
        console.log(saveOffer, 'saved offer')

        if (!saveOffer) {
            return res.status(400).json({ success: false, message: "offer is can't saved" })
        }

        const offer = await Offer.findOne({ offerName: newOffer?.offerName }) || ''
        if (saveOffer.offerType === 'Category') {
            const category = await Category.findByIdAndUpdate(categoryId, {
                $push: { offers: offer?._id }
            })
        } else if (saveOffer.offerType === 'Product') {
            const product = await Product.findByIdAndUpdate(productId, {
                $push: { offers: offer?._id }
            })
            console.log(product)

        }

        return res.status(200).json({
            success: true, message: "offer is created"
        })
    } catch (error) {
        next(new AppError(`Add offers : ${error}`, 500))
    }
}

export const selectProduct = async (req, res, next) => {
    try {
        const product = await Product.find()
            .sort({ createdAt: -1 })

        return res.status(200).json({
            success: true, product
        })
    } catch (error) {
        next(new AppError(`Offer selection failed : ${error}`, 500))
    }
}

export const selectCategory = async (req, res, next) => {
    try {
        const categories = await Category.find({
            status: 'active'
        })
            .sort({ createdAt: -1 })

        if (categories.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No categories found'
            });
        }

        return res.status(200).json({
            success: true,
            categories,
            // total: categories.length
        });
    } catch (error) {
        console.error('Category selection error:', error);
        next(new AppError(`Category selection failed: ${error.message}`, 500));
    }
}


export const deleteOffer = async (req, res, next) => {
    try {
        const offerId = req.params.id

        const offer = await Offer.findById(offerId)
        if (offer.offerType === 'Category') {
            await Category.findByIdAndUpdate(offer.categoryId, {
                $pull: { offers: offer._id }
            })
        } else if (offer.offerType === 'Product') {
            await Product.findByIdAndUpdate(offer.productId, {
                $pull: { offers: offer._id }
            })
        }

        await Offer.findByIdAndDelete(offer._id)
        return res.status(200).json({
            success: false, message: 'Offer removed from the list'
        })
    } catch (error) {
        next(new AppError(`Delete offer faield : ${error}`, 500))
    }
}



export const renderEditOffers = async (req, res, next) => {
    try {
        const offer = await Offer.findById(req.params.id)
        if (!offer) {
            return next(new AppError('Offer not found', 404));
        }
        console.log(offer)
        return res.render('admin/editOffer', { offer })
    } catch (error) {
        next(new AppError(`Edit offers page : ${error}`, 500))
    }
}

export const editOffer = async (req, res, next) => {
    try {
        console.log(req.params)
        const offerId = req.params.id
        const {
            offerName,
            discountPercentage,
            validFrom,
            validTo,
            offerType,
            status,
            categoryId,
            productId } = req.body

        if (!offerName || !discountPercentage || !validFrom || !validTo || !offerType) {
            return res.status(400).json({ success: false, message: "Please add required field" })
        }

        const offer = await Offer.findById(offerId)
        if (!offer) {
            return next(new AppError('Offer not found', 404));
        }

        if (offer.offerType === 'Category') {
            await Offer.findByIdAndUpdate(offerId, {
                $set: {
                    offerName,
                    discountPercentage,
                    validFrom,
                    validTo,
                    offerType,
                    status,
                    categoryId,
                }
            })
        } else if (offer.offerType === 'Product') {
            await Offer.findByIdAndUpdate(offerId, {
                $set: {
                    offerName,
                    discountPercentage,
                    validFrom,
                    validTo,
                    offerType,
                    status,
                    productId
                }
            })
        }


        return res.status(200).json({ success: true, message: 'Offer updated' })

    } catch (error) {
        next(new AppError(`Offer editing failed : ${error}`, 500))
    }
}
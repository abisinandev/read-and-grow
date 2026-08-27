import Category from "../../models/categorySchema.js";
import Product from "../../models/productSchema.js";
import AppError from "../../utils/errorHandler.js";


const escapeRegExp = (string = '') => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CATEGORY_NAME_REGEX = /^[A-Za-z][A-Za-z0-9&',.\-\s]{1,49}$/;
const CATEGORY_DESCRIPTION_REGEX = /^[^<>]{1,500}$/;

const validateCategoryFields = ({ categoryName, categoryDescription }) => {
    if (!categoryName || !categoryName.trim()) return "Category name is required";
    if (!CATEGORY_NAME_REGEX.test(categoryName.trim())) {
        return "Category name must start with a letter and can only contain letters, numbers, spaces, and & ' , . -";
    }
    if (!categoryDescription || !categoryDescription.trim()) return "Description is required";
    if (!CATEGORY_DESCRIPTION_REGEX.test(categoryDescription.trim())) {
        return "Description must be under 500 characters and cannot contain < or >";
    }
    return null;
};

//CATEGORY
export const categoryManagment = async (req, res, next) => {
    let { page, limit } = req.query
    page = parseInt(page) || 1
    limit = parseInt(limit) || 5
    let skip = (page - 1) * limit
    try {
        const categories = await Category.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)

        const total = await Category.find().countDocuments()
        const totalPages = Math.ceil(total / limit)

        const products = await Product.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }])
        // console.log("category count :",products)
        return res.render('admin/category', {
            categories,
            limit,
            page,
            totalPages,
            // flag: true,
            products
        })
    } catch (error) {

        return next(new AppError(`Category get failed `, 500))
    }
}

//===================Add category====================
export const addCategoryGet = async (req, res, next) => {
    try {
        return res.render('admin/categoryAdd',)
    } catch (error) {
        console.log(`add category getting failed ${error.message}`)
        return next(new AppError(`admin category add ${req.method} method failed `, 500))
    }
}


export const addCategory = async (req, res, next) => {
    try {
        let { categoryName, categoryDescription, status } = req.body
        status = status || req.body.categoryStatus
        console.log("addCategroy", req.body)

        const validationError = validateCategoryFields({ categoryName, categoryDescription })
        if (validationError) {
            return res.status(400).json({ success: false, message: validationError })
        }

        categoryName = categoryName.trim()
        const existCategory = await Category.findOne({
            categoryName: { $regex: `^${escapeRegExp(categoryName)}$`, $options: "i" }
        })
        console.log("existCategory :", existCategory)
        if (existCategory) {
            return res.status(400).json({
                success: false,
                message: "category already exists"
            })
        }
        const newCatogory = new Category({
            categoryName: categoryName,
            description: categoryDescription.trim(),
            status: status
        })


        await newCatogory.save()

        return res.status(201).json({
            success: true,
            message: "Category created",
            redirect: "/admin/category"
        })
    } catch (error) {
        console.log("Category add failed : ", error.message)
        return next(new AppError(`admin addCategory ${req.method} method failed `, 500))
    }
}


export const deleteCategory = async (req, res, next) => {
    try {
        const categoryId = req.params.id
        // console.log(categoryId)
        const deleteCategory = await Category.findByIdAndDelete(categoryId)
        // console.log(deleteCategory)
        if (!deleteCategory) {
            return res.status(400).json({
                success: false,
                message: "Category deleting failed"
            })
        }
        return res.status(200).json({
            success: true,
            message: "Category deleted"
        })
    } catch (error) {
        console.log("Category delete failed", error.message)
        return next(new AppError(`Category delete failed  ${req.method} method failed `, 500))
    }
}

//==========================edit category=========================

export const editCategory = async (req, res, next) => {
    try {
        const id = req.params.id
        console.log("editCategory get :", id)

        const findCategory = await Category.findById(id)
        return res.render('admin/categoryEdit', {
            findCategory
        })

    } catch (error) {
        console.log(`Category edit failed : ${error.message}`)
    }
}

//Edit category patch method
export const editCategoryPatch = async (req, res, next) => {
    try {
        let { categoryName, categoryDescription, status } = req.body
        const id = req.params
        console.log("editCategory Patch :", req.body)

        const validationError = validateCategoryFields({ categoryName, categoryDescription })
        if (validationError) {
            return res.status(400).json({ success: false, message: validationError })
        }

        categoryName = categoryName.trim()
        const existCategory = await Category.findOne({
            _id: { $ne: id.id },
            categoryName: { $regex: `^${escapeRegExp(categoryName)}$`, $options: "i" }
        })
        if (existCategory) {
            return res.status(400).json({
                success: false,
                message: "category already exists"
            })
        }

        const updatedCategory = await Category.findByIdAndUpdate(
            id.id,
            {
                $set: {
                    categoryName,
                    description: categoryDescription.trim(),
                    status: status,
                },
            })

        console.log(updatedCategory)
        return res.status(200).json({
            success: true,
            message: "Category updated"
        })


    } catch (error) {
        console.log(`Category edit failed : ${error.message}`)
        return next(new AppError(`editCategory failed ${error}`, 500))
    }
}

//============search category=================
export const searchCategory = async (req, res, next) => {
    try {
        const { q } = req.query
        // console.log("category",q)

        if (q?.length === 0 || !q) {
            const category = await Category.find()
            if (!category) {
                return res.status(404).json({
                    success: false,
                    message: "Product is not found"
                })
            }
            return res.status(200).json({
                success: true,
                category
            })
        } else {

            const category = await Category.find({
                categoryName: { $regex: q, $options: "i" }
            })
            console.log(category)
            if (!category || category.length === 0) {
                console.log(1)
                return res.status(404).json({
                    success: false,
                    message: "Product is not found"
                })
            }
            return res.status(200).json({
                success: true,
                category
            })
        }


    } catch (error) {
        next(new AppError(`Category searching failed ${error}`, 500))
    }
}

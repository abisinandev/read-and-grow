import express from "express";
import User from "../../models/userSchema.js";
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken";
import { render } from "ejs";
import Category from "../../models/categorySchema.js";
import fs from "fs"
import { mkdir, unlink } from 'fs/promises';
import path from "path";
import sharp from 'sharp';
import AppError from "../../utils/errorHandler.js";
import Product from "../../models/productSchema.js";
import { promises } from 'fs';
import { setTimeout } from 'timers/promises';
import { content_v2_1 } from "googleapis";
import { redis } from "googleapis/build/src/apis/redis/index.js";
import { imageUploadToCloud } from "../../utils/cloudinary.js";
import Order from "../../models/orderSchema.js";


//=====================admin login get ==================
export const adminLoginGet = async (req, res) => {
    try {
        if (req.cookies.jwt) {
            const token = req.cookies.jwt
            const docodeToken = jwt.verify(token, process.env.JWT_SECRET)
            if (docodeToken.role == 'admin') {
                return res.redirect('/admin/dashboard')
            } else {
                return res.redirect("/")
            }
        }

        return res.render("admin/login")

    } catch (error) {
        console.error(`admin_login failed : ${error.message}`)
    }
}

//=======================login admin post
export const adminLoginPost = async (req, res, next) => {
    try {
        let { username, password } = req.body

        const admin = await User.findOne({ username })

        if (!admin) {
            return res.status(400).json({ success: false, message: "Please enter valid admin details" })
        }

        const comparePassword = await bcrypt.compare(password, admin.password)
        if (!comparePassword) {
            return res.status(400).json({ success: false, message: "Incorrect password" })
        }

        //CREATE JWT TOKEN
        const token = jwt.sign({ id: admin._id, name: admin.username, role: admin.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES })

        //STORE JWT TOKEN IN COOKIES
        res.cookie('jwt', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 })

        return res.status(200).json({ success: true, message: "Logged successfully", redirect: "/admin/dashboard" })


    } catch (error) {
        return next(new AppError(`admin Login ${req.method} method failed `, 500))
    }
}


//=================admin_users_get=========================
export const renderUserPanel = async (req, res, next) => {
    try {
        let { page = 1, limit = 5, query = '' } = req.query;
        page = parseInt(page);
        limit = parseInt(limit);
        const skip = (page - 1) * limit;

        const filter = query ? { username: { $regex: query, $options: 'i' } } : {};

        let users = await User.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        let allUsers = []
        for (let user of users) {
            let orderCount = 0
            const orders = await Order.find()
            for (let order of orders) {
                if (user._id.toString() === order.userId.toString()) {
                    orderCount += order.items.length
                }
            }
            allUsers.push({
                username: user.username,
                email: user.email,
                orderCount,
                status: user.isBlocked,
                role: user.role,
                _id:user._id
            })

        }


        if (!allUsers || allUsers.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No users found'
            });
        }

        const totalUsers = await User.countDocuments(filter);
        const totalPages = Math.ceil(totalUsers / limit);

        if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
            return res.status(200).json({
                success: true,
                allUsers,
                totalUsers,
                totalPages,
                limit,
                page
            });
        }
        return res.render('admin/users', {
            totalUsers,
            allUsers,
            totalPages,
            limit,
            page,
            query
        });

    } catch (error) {
        console.error('renderUserPanel error:', error.message);
        next(new AppError(`Fetching users failed: ${error.message}`, 500));
    }
};


//==============Block user========================================

export const blockUser = async (req, res, next) => {
    try {
        const id = req.params.id
        console.log(id)
        const user = await User.findById(id)

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "user blocking failed"
            })
        }

        const newStatus = !user.isBlocked//CHECK TRUE OR FALSE

        await User.updateOne({ _id: id }, { $set: { isBlocked: newStatus } })
        return res.status(200).redirect("/admin/users")

    } catch (error) {
        console.log('User blocking error : ', error.message)
        return next(new AppError(`admin block user failed `, 500))
    }
}

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
        let { categoryId, categoryName, categoryDescription, status } = req.body
        console.log("addCategroy", req.body)

        categoryName = categoryName.trim()
        const existCategory = await Category.findOne({ categoryName: { $regex: categoryName, $options: "i" } })
        console.log("existCategory :", existCategory)
        if (existCategory) {
            return res.status(400).json({
                success: false,
                message: "category already exists"
            })
        }
        const newCatogory = new Category({
            categoryId: categoryId,
            categoryName: categoryName,
            description: categoryDescription,
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

        categoryName = categoryName.trim()
        const existCategory = await Category.findOne({ categoryName: { $regex: categoryName, $options: "i" } })
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
                    description: categoryDescription,
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

//==========================Product Managment part=======================
export const renderProductPage = async (req, res, next) => {
    try {
        let { page, limit, query = '' } = req.query
        // console.log(req.query)
        page = parseInt(page) || 1
        limit = parseInt(limit) || 5
        let skip = (page - 1) * limit

        const filter = query ? { name: { $regex: query, $options: "i" } } : {};

        const allProducts = await Product.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)

        if (!allProducts || allProducts.length === 0) {
            console.error("Product not found ")
        }

        const totalProducts = await Product.countDocuments(filter)
        const totalPages = Math.ceil(totalProducts / limit)

        if (req.headers["x-requested-with"] === "XMLHttpRequest") {
            return res.json({
                success: true,
                allProducts,
                totalProducts,
                totalPages,
                limit,
                page
            })
        }

        return res.render("admin/product", {
            allProducts,
            totalProducts,
            totalPages,
            limit,
            page,
            query
        })


    } catch (error) {
        console.log(`Product management failed: ${error.message}`)
        next(new AppError(`Fetching products failed: ${error}`, 500))
    }

}

export const addProducts = async (req, res, next) => {
    try {
        const category = await Category.find()
        res.render("admin/addProducts", { category })
    } catch (error) {
        console.log("Product adding failed ", error.message)
    }
}

// Server-side validation mirroring (and backstopping) what the add/edit product forms already
// check client-side — the client checks are trivially bypassed (devtools, a direct API call,
// disabled JS), and until now nothing on the server rejected a negative price, non-integer
// stock, or a category that doesn't actually exist. That last one matters a lot here: product
// category is a free-text string, not a reference — an admin typo or stale category creates
// exactly the kind of silently-broken shop filtering this project already had to fix once.
const validateProductFields = ({ name, description, author, price, stock, category }, validCategoryNames) => {
    if (!name || !name.trim()) return "Product name is required";
    if (name.trim().length < 3) return "Product name must be at least 3 characters long";
    if (!description || !description.trim()) return "Description is required";
    if (!author || !author.trim()) return "Author is required";
    if (!category || !category.trim()) return "Category is required";
    if (!validCategoryNames.has(category.trim().toLowerCase())) return "Please select a valid category";

    const priceNum = Number(price);
    if (price === undefined || price === '' || isNaN(priceNum) || priceNum <= 0) return "Price must be a positive number";

    const stockNum = Number(stock);
    if (stock === undefined || stock === '' || isNaN(stockNum) || stockNum < 0 || !Number.isInteger(stockNum)) return "Stock must be a non-negative whole number";

    return null;
};

//=========product uploading================
export const addProductsPost = async (req, res, next) => {
    try {
        console.log("body", req.body)
        console.log("files", req.files)
        const {
            name,
            description,
            author,
            price,
            stock,
            category
        } = req.body

        const categories = await Category.find();
        const validationError = validateProductFields(
            { name, description, author, price, stock, category },
            new Set(categories.map(c => c.categoryName.trim().toLowerCase()))
        );
        if (validationError) {
            return res.status(400).json({ success: false, message: validationError });
        }

        const files = req.files//IMAGE FILES INCLUDES IN HERE
        let imagesPaths = []//STORING IMAGE PATHS

        if (files && files.length > 0) {
            imagesPaths = await Promise.all(
                files.map(async (file) => await imageUploadToCloud(file))//UPLOAD IMAGE TO CLOUD ONE BY ONE
            )
        } else {
            return res.status(400).json({ success: false, message: "At least one image is required." });
        }

        console.log("imagesPaths is: ", imagesPaths)

        let newProduct = new Product({
            name: name.trim(),
            description: description.trim(),
            authorName: author.trim(),
            price: parseFloat(price),
            stock: parseInt(stock),
            category: category.trim(),
            images: imagesPaths
        })
        // console.log(newProduct)
        await newProduct.save();
        return res.json({
            success: true,
            message: "Product added successfully",
            newProduct,
            redirect: "/admin/products"
        });

    } catch (error) {
        return next(new AppError(`Product adding failed ${error}`, 500));
    }
};

//===edit product
export const editProductsGet = async (req, res, next) => {
    try {
        const id = req.params.id
        console.log('edit product :', id)

        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).redirect('/admin/products')
        }
        const categories = await Category.find()
        return res.render('admin/editProduct', { product, categories })

    } catch (error) {
        return next(new AppError(`Product editing page loadng failed ${error}`, 500))
    }
}

export const editProduct = async (req, res, next) => {
    try {
        // console.log("body", req.body)
        // console.log("files",req.files)
        const id = req.params.id
        console.log('productId', id)

        const {
            name,
            description,
            author,
            price,
            stock,
            category,
            imagePlan
        } = req.body

        let existProduct = await Product.findById(id)
        if (!existProduct) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        const categories = await Category.find();
        const validationError = validateProductFields(
            { name, description, author, price, stock, category },
            new Set(categories.map(c => c.categoryName.trim().toLowerCase()))
        );
        if (validationError) {
            return res.status(400).json({ success: false, message: validationError });
        }

        const files = req.files || []//IMAGES FILE CAME FROM MULTER
        const uploadedUrls = files.length > 0
            ? await Promise.all(files.map(async (file) => await imageUploadToCloud(file)))//UPLOAD IMAGE TO CLOUD ONE BY ONE
            : [];

        // imagePlan is an ordered, per-slot list the form sends alongside the files — each
        // entry is either the literal string "new" (this slot got a freshly uploaded image,
        // consume the next uploaded URL) or the existing image's own URL (this slot was left
        // untouched). Without this, there was no way to tell the server "keep slots 1 and 3,
        // only slot 2 changed" — it only ever saw whatever files were attached to this specific
        // request, and blindly replaced the ENTIRE image array with just those, silently
        // deleting any image whose slot didn't have a new upload.
        let imagesPaths;
        let plan = [];
        try { plan = JSON.parse(imagePlan || '[]'); } catch (e) { plan = []; }

        if (Array.isArray(plan) && plan.length > 0) {
            let uploadIdx = 0;
            imagesPaths = plan.map(entry => entry === 'new' ? uploadedUrls[uploadIdx++] : entry).filter(Boolean);
        } else {
            // No plan sent (e.g. an older client) — fall back to the previous behavior.
            imagesPaths = uploadedUrls.length > 0 ? uploadedUrls : existProduct.images;
        }

        if (imagesPaths.length === 0) {
            return res.status(400).json({ success: false, message: "At least one image is required." });
        }

        await Product.findOneAndUpdate(
            { _id: id },
            {
                $set: {
                    name: name.trim(),
                    description: description.trim(),
                    authorName: author.trim(),
                    price: parseFloat(price),
                    stock: parseInt(stock),
                    category: category.trim(),
                    images: imagesPaths
                }
            }
        )
        return res.json({
            success: true,
            message: "Product updated successfully",
            redirect: "/admin/products"
        });

    } catch (error) {
        return next(new AppError(`Product editing failed ${error}`, 500))
    }
}

//==========delete Product========
export const deleteProduct = async (req, res, next) => {
    try {
        const productId = req.params.id
        console.log(productId)
        const deleteProduct = await Product.findByIdAndDelete(productId)
        if (!deleteProduct) {
            return res.json({
                success: false,
                message: "Product deleted failed"
            })
        }
        return res.json({
            success: true,
            message: "Product deleted"
        })

    } catch (error) {
        // AppError is an ES6 class — calling it without `new` throws
        // "Class constructor AppError cannot be invoked without 'new'" right here in the catch
        // block, which meant any real deletion failure crashed the request instead of returning
        // a clean error response.
        next(new AppError(`Product deleting failed ${error}`, 500))
    }
}

//======block procuct======================
export const blockProduct = async (req, res, next) => {
    try {
        const productId = req.params.id
        console.log(productId)

        const product = await Product.findById(productId)
        if (!product) {
            return res.status(400).json({
                success: false,
                message: "Block product failed"
            })
        }

        const newStatus = !product.isBlocked
        console.log(newStatus)
        await Product.updateOne({ _id: productId }, { $set: { isBlocked: newStatus } })

        return res.status(200).json({
            success: true,
            message: newStatus ? "Product blocked" : "Product unblocked",
            // The client toggles the eye/eye-slash icon based on this — without it, `isBlocked`
            // was always undefined client-side, so the icon update was effectively broken until
            // the page's subsequent reload happened to paint the correct state from the DB.
            isBlocked: newStatus
        })

    } catch (error) {
        next(new AppError(`Block product failed ${error}`, 500))
    }
}



//===================Logout button================================
export const adminLogout = async (req, res, next) => {
    try {
        res.clearCookie('jwt')
        res.json({ success: true, message: "Logged out successfully." })
    } catch (error) {
        console.log('admin Logout failed : ', error.message)
        res.status(500).json({ success: false, message: "something went wrong" })
    }

}



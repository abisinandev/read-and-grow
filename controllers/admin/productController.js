import Category from "../../models/categorySchema.js";
import Product from "../../models/productSchema.js";
import AppError from "../../utils/errorHandler.js";
import { imageUploadToCloud } from "../../utils/cloudinary.js";

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

        let imagesPaths;
        let plan = [];
        try { plan = JSON.parse(imagePlan || '[]'); } catch (e) { plan = []; }

        if (Array.isArray(plan) && plan.length > 0) {
            let uploadIdx = 0;
            imagesPaths = plan.map(entry => entry === 'new' ? uploadedUrls[uploadIdx++] : entry).filter(Boolean);
        } else {
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
            isBlocked: newStatus
        })

    } catch (error) {
        next(new AppError(`Block product failed ${error}`, 500))
    }
}

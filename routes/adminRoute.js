import express from 'express';
const router = express.Router()
import adminAuth from "../middlewares/adminAuth.js"
import {
    adminLoginGet,
    adminLoginPost,
    adminLogout,
} from "../controllers/admin/adminController.js"
import {
    blockUser,
    renderUserPanel,
} from "../controllers/admin/userController.js"
import {
    addCategory,
    addCategoryGet,
    categoryManagment,
    deleteCategory,
    editCategory,
    editCategoryPatch,
    searchCategory,
} from "../controllers/admin/categoryController.js"
import {
    addProducts,
    addProductsPost,
    blockProduct,
    deleteProduct,
    editProduct,
    editProductsGet,
    renderProductPage,
} from "../controllers/admin/productController.js"
import upload from '../utils/multer.js';
import { acceptReturn, getOrderPage, rejectReturn, updateStatus, viewOrder } from '../controllers/admin/orderController.js';
import { addOffers, deleteOffer, editOffer, renderAddOffers, renderEditOffers, renderOffersPage, selectCategory, selectProduct } from '../controllers/admin/offersController.js';
import { addCoupon, deleteCoupon, editCoupon, renderAddCoupon, renderCouponsPage, renderEditCoupon } from '../controllers/admin/couponController.js';
import {
    adminDashboardGet,
    updateDashboard
} from '../controllers/admin/dashboardController.js';
import { transactionManagment} from '../controllers/admin/transactionController.js';
import { downloadExcelReport, downloadPDFReport, salesReport } from '../controllers/admin/salesReportController.js';


//LOGIN
router.get('/login', adminLoginGet)
router.post('/login', adminLoginPost)

//DASHBOARD MANAGMENT
router.get('/dashboard', adminAuth, adminDashboardGet);
router.get('/update-dashboard', adminAuth, updateDashboard)
router.get('/download-pdf-report', adminAuth, downloadPDFReport);
router.get('/download-excel-report', adminAuth, downloadExcelReport);


//USERS MANAGMENT
router.get('/users', adminAuth, renderUserPanel)
router.put('/blockUser/:id', adminAuth, blockUser)

//CATEGORY MANAGMENT
router.get('/category', adminAuth, categoryManagment)
router.post('/category', adminAuth, categoryManagment)
router.get('/add-category', adminAuth, addCategoryGet)
router.post('/add-category', adminAuth, addCategory)
router.get('/edit-category/:id', adminAuth, editCategory)
router.patch('/category/:id', adminAuth, editCategoryPatch)
router.delete('/category/:id', adminAuth, deleteCategory)
router.get('/search-category', adminAuth, searchCategory)

//PRODUCT MANAGMENT
router.get("/products", adminAuth, renderProductPage)
router.get("/add-products", adminAuth, addProducts)
router.post("/add-products", adminAuth, upload.array('images', 3), addProductsPost)
router.get('/product/:id', adminAuth, editProductsGet)
router.patch("/product/:id", adminAuth, upload.array('images', 3), editProduct)
router.delete('/product/:id', adminAuth, deleteProduct)
router.put('/block-product/:id', adminAuth, blockProduct)

//ORDER MANAGMENT
router.get('/orders', adminAuth, getOrderPage)
router.get('/view-order/:orderId/:productId', adminAuth, viewOrder)
router.put('/update-orders/:orderId', adminAuth, updateStatus)

//OFFERS MANAGMENT
router.get('/offers', adminAuth, renderOffersPage)
router.get('/add-offers', adminAuth, renderAddOffers)
router.post('/add-offers', adminAuth, addOffers)
router.get('/select-product', adminAuth, selectProduct)
router.get('/select-category', adminAuth, selectCategory)
router.delete('/offer/:id', adminAuth, deleteOffer)
router.get('/edit-offer/:id', adminAuth, renderEditOffers)
router.patch('/edit-offer/:id', adminAuth, editOffer)

//COUPON MANAGMENT
router.get("/coupons", adminAuth, renderCouponsPage)
router.get('/add-coupons', adminAuth, renderAddCoupon)
router.post('/add-coupons', adminAuth, addCoupon)
router.delete('/coupons/:id', adminAuth, deleteCoupon)
router.get('/edit-coupon/:id', adminAuth, renderEditCoupon)
router.patch('/edit-coupon/:id', adminAuth, editCoupon)

//RETURN PRODUCT
router.put('/accept-return/:productId/:orderId', adminAuth, acceptReturn)
router.put('/reject-return/:productId/:orderId', adminAuth, rejectReturn)

//TRANSACTIONS
router.get('/transactions', adminAuth, transactionManagment)

//SALES REPORT
router.get('/sales-report',adminAuth,salesReport)

//LOGOUT
router.post("/logout", adminLogout)

//===EXPORT ROUTES====
export default router
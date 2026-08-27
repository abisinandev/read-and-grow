import jwt from "jsonwebtoken"

 const adminAuth =async (req,res,next)=>{
    try {
        const token = req.cookies.jwt // take data from login post

        if(!token){
            return res.status(400).redirect("/admin/login")
        }
        
        const decodeToken = jwt.verify(token,process.env.JWT_SECRET)

        if(!decodeToken){
            return res.status(403).json({success:false, message:"Access denied : Admin"})
        }

        // A valid token that isn't an admin's (e.g. a regular logged-in user) previously fell
        // through to next() anyway — req.admin was just left undefined, but nothing downstream
        // ever checked it, so every admin route (product/category/order/coupon management,
        // user blocking, sales reports, ...) was reachable by any authenticated user.
        if(decodeToken.role !== 'admin'){
            return res.status(403).json({success:false, message:"Access denied : Admin only"})
        }

        req.admin = decodeToken
        next()

    } catch (error) {

        console.error("admin auth failed",error.message)
        res.redirect("/admin/login")
    }
}  

export default adminAuth
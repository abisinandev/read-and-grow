import Order from "../../models/orderSchema.js"
import Wallet from "../../models/walletSchema.js"
import AppError from "../../utils/errorHandler.js"

const escapeRegExp = (string = '') => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const transactionManagment = async (req, res, next) => {
    try {
        let { page, limit, query } = req.query
        page = parseInt(page) || 1
        limit = parseInt(limit) || 10
        query = query || ''
        let skip = (page - 1) * limit

        const basePipeline = [
            { $unwind: "$transactions" },
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: 'user'
                }
            },
            { $unwind: "$user" },
        ]

        if (query) {
            basePipeline.push({
                $match: {
                    $or: [
                        { "transactions.transactionId": { $regex: escapeRegExp(query), $options: "i" } },
                        { "user.username": { $regex: escapeRegExp(query), $options: "i" } },
                        { "user.email": { $regex: escapeRegExp(query), $options: "i" } },
                    ]
                }
            })
        }

        const wallets = await Wallet.aggregate([
            ...basePipeline,
            { $sort: { "transactions.createdAt": -1 } },
            { $skip: skip },
            { $limit: limit },
        ]);

        const totalTransactionsResult = await Wallet.aggregate([
            ...basePipeline,
            { $count: "count" }
        ]);

        const count = totalTransactionsResult[0]?.count || 0;
        const totalPages = Math.ceil(count / limit);

        res.render("admin/transactions", {
            wallets,
            page,
            totalPages,
            limit,
            query,
        });

    } catch (error) {
        next(new AppError(`Transaction managment failed :${error}`, 500))
    }
}



// export const viewTransaction = async (req,res,next)=>{
//     try {
//         const id = req.params.id
//         const wallets = await Wallet.aggregate([
//             { $unwind: "$transactions" },
//             {
//                 $lookup: {
//                     from: "users",
//                     localField: "userId",
//                     foreignField: "_id",
//                     as: 'user'
//                 }
//             },
//             { $unwind: "$user"},
//         ]);

//         let transaction = []
//         for(let wallet of wallets){
//             if(wallet?.transactions?.transactionId === id){
//                 transaction.push(wallet)
//             }
//         }
 
//         const orderId = transaction[0].transactions?.orderId.toString();
//         const order = await Order.findOne({_id:transaction[0].transactions.orderId})

//         console.log(order)
        
//         return res.render('admin/transactionDetails',{transaction,order})  
//     } catch (error) {
//         console.log(error.message)
//         next(new AppError(error))
//     }
// }
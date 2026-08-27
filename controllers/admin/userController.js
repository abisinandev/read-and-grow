import User from "../../models/userSchema.js";
import Order from "../../models/orderSchema.js";
import AppError from "../../utils/errorHandler.js";

//=================admin_users_get=========================
export const renderUserPanel = async (req, res, next) => {
    try {
        let { page = 1, limit = 5, query = '' } = req.query;
        page = parseInt(page);
        limit = parseInt(limit);
        const skip = (page - 1) * limit;

        const filter = { role: 'user' };
        if (query) {
            filter.$or = [
                { username: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } }
            ];
        }

        const users = await User.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const userIds = users.map(u => u._id);
        const orderCounts = await Order.aggregate([
            { $match: { userId: { $in: userIds } } },
            { $group: { _id: "$userId", count: { $sum: 1 } } }
        ]);
        const orderCountMap = new Map(orderCounts.map(row => [row._id.toString(), row.count]));

        const allUsers = users.map(user => ({
            username: user.username,
            email: user.email,
            orderCount: orderCountMap.get(user._id.toString()) || 0,
            status: user.isBlocked,
            role: user.role,
            _id: user._id
        }));

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

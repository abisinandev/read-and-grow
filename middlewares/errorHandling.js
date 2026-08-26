export const errorHandling = async (err, req, resolve, next) => {
    try {
        const Error = new Error("Something went wrrong")
        return next(Error)
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: "something went wrong" })
    }
}
import sharp from "sharp";
import fs from "fs/promises";
import AppError from "./errorHandler.js";

const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

const cleanupFiles = async (files) => {
    await Promise.all(files.map((file) => fs.unlink(file.path).catch(() => {})));
};

const validateUploadedImages = async (req, res, next) => {
    const files = req.files || [];
    if (files.length === 0) return next();

    try {
        for (const file of files) {
            const metadata = await sharp(file.path).metadata().catch(() => null);

            if (!metadata || !ALLOWED_FORMATS.has(metadata.format)) {
                await cleanupFiles(files);
                return next(
                    new AppError(`"${file.originalname}" is not a valid image. Only JPG, PNG and WEBP files are allowed.`, 400)
                );
            }
        }
        return next();
    } catch (error) {
        await cleanupFiles(files);
        return next(new AppError(`Image validation failed: ${error.message}`, 400));
    }
};

export default validateUploadedImages;

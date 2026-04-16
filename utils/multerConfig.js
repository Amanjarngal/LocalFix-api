import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import * as dotenv from "dotenv";

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        // Define format based on mimetype to support pdfs
        let format = "png";
        let resource_type = "image";
        
        if (file.mimetype === "application/pdf") {
            format = "pdf";
            resource_type = "raw";
        } else if (file.mimetype === "image/jpeg") {
            format = "jpg";
        } else if (file.mimetype === "image/webp") {
            format = "webp";
        }

        return {
            folder: "localfix/documents",
            resource_type: resource_type,
            format: format,
            public_id: file.fieldname + "-" + Date.now(),
        };
    },
});

export const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
});

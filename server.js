import "dotenv/config";

import app from "./app.js";
import connectDb from "./db/dbConnection.js";
import { CONFIG } from "./utils/constants/envConfig.js";

const PORT = CONFIG.PORT;

const startServer = async () => {
    try {
        await connectDb();

        const server = app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });

        const shutdown = async (signal) => {
            console.log(`${signal} received. Shutting down...`);

            server.close(() => {
                console.log("HTTP server closed");
                process.exit(0);
            });
        };

        process.on("SIGINT", () => shutdown("SIGINT"));
        process.on("SIGTERM", () => shutdown("SIGTERM"));
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};

startServer();
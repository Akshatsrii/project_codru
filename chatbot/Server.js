import express from "express";
import { Server} from "socket.io";
import http from "http";
import { searchData , generateResponse} from "./client/searchData.js";
import { setupCronJobs } from "./services/cronSetup.js";
import startCrawler from "./services/crawler.js";
import ingest from "./embeddings/Ingest.js";
import {rateLimit} from "./middleware/ratelimiting.js";
import { config } from "dotenv";
config();
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL ,
        crossOrigin: true,
        credentials: true
    },
});

setupCronJobs();
app.use(rateLimit);
app.get("/health", (req, res) => {
    res.status(200).send("OK");
});
io.on("connection", (socket) => {
    console.log("Client connected");
    socket.on("userMessage", async (data) => {
        try {
            const result = await searchData(data.query);
            const docs = result.documents[0];
            // Convert array to text context
            const context = docs.join("\n\n");
            const response = await generateResponse(data.query, context);
            
            // Extract text content from response
            const responseText = response.parts[0].text || JSON.stringify(response);
            
            // Send response back to client
            socket.emit("botResponse", { response: responseText });
        } catch (error) {
            console.error("Error processing message:", error);
            socket.emit("error", error.message);
        }
    });
    socket.on("disconnect", () => {
        console.log("Client disconnected");
    });

});

server.listen(3000, () => {
    console.log("Server listening on port 3000");
});
import express from 'express';
import {Server} from 'socket.io';
import http from 'http';
import {generateResponse, searchData} from './client/searchData.js';
const app = express();
const port = 3000;
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        
    }
});

io.on('connection', async (socket) => {
    console.log('a user connected');
    socket.on('chat message', async (msg) => {
    const response = await searchData(msg);
    const docs = response.documents[0];// Convert array to text context
    const context = docs.join("\n\n");
    const answer = await generateResponse(msg, context);
    socket.emit('chat response', answer); 
    });
    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

server.listen(port, () => {
    console.log(`listening on:${port}`);
});
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('Novo usuário conectado:', socket.id);

  socket.on('join', (room) => {
    socket.join(room);
    socket.to(room).emit('user-joined', socket.id);
  });

  socket.on('offer', (data) => {
    socket.to(data.room).emit('offer', data);
  });

  socket.on('answer', (data) => {
    socket.to(data.room).emit('answer', data);
  });

  socket.on('ice-candidate', (data) => {
    socket.to(data.room).emit('ice-candidate', data);
  });

  socket.on('message', (data) => {
    socket.to(data.room).emit('message', data);
  });
});

server.listen(3001, () => console.log('Servidor rodando em http://localhost:3001'));
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

io.on('connection', (socket) => {

  socket.on('join', (room) => {
    const clientesNaSala = io.sockets.adapter.rooms.get(room);
    const quantos = clientesNaSala ? clientesNaSala.size : 0;

    socket.join(room);

    if (quantos === 0) {
      // É o primeiro — avisa ele para esperar
      socket.emit('primeiro-na-sala');
    } else {
      // É o segundo — avisa o primeiro que chegou alguém
      socket.to(room).emit('user-joined', socket.id);
    }
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
});

server.listen(3001, () => console.log('Servidor rodando em http://localhost:3001'));
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const path = require('path');
const http = require('http');            // ✅ Required to create server
const socketIo = require('socket.io');   // ✅ Import socket.io

const app = express();
const server = http.createServer(app);   // ✅ Create server from express app
const io = socketIo(server);             // ✅ Pass server to socket.io

const PORT = process.env.PORT || 3000;

// ===== MongoDB Connection =====
mongoose.connect('mongodb+srv://st386700:25Sept*2003@cluster0.qmv82oo.mongodb.net/mental_health_app', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// ===== Middleware Setup =====
app.use(session({
  secret: 'AgjhAw8bRBwgJRDKHuwF9nGO',
  resave: false,
  saveUninitialized: true
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ===== Routes =====
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const serviceRoutes = require('./routes/service');
const profRoutes = require('./routes/prof');
const adminRoutes = require('./routes/admin');
const chatRoutes = require('./routes/chat');

app.use('/', indexRoutes);
app.use('/', authRoutes);
app.use('/', userRoutes);
app.use('/', serviceRoutes);
app.use('/', profRoutes);
app.use('/', adminRoutes);
app.use('/', chatRoutes);

// ===== Socket.IO Events =====
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Receive message and broadcast to everyone
  socket.on('send_message', (data) => {
    io.emit('receive_message', data); // broadcast to all
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// ===== Start Server =====
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// ===== Export IO for other modules if needed =====
module.exports = { app, io };

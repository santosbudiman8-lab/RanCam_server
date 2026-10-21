const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

app.get('/', (req, res) => {
  // Ganti URL di bawah dengan link halaman itch.io RanCam Anda
  res.redirect('https://rancam.itch.io/randcam'); 
});

let onlineUsers = 0;
// Mengizinkan koneksi dari aplikasi Flutter
const io = new Server(server, {
  cors: { origin: "*" } 
});

// Variabel untuk menyimpan orang yang sedang menunggu pasangan
let waitingUser = null; 

io.on('connection', (socket) => {
  onlineUsers++;
  io.emit('online_count', onlineUsers);
  console.log('User terhubung dengan ID:', socket.id);

  socket.on('get_online_count', () => {
    socket.emit('online_count', onlineUsers);
  });
  // 1. Saat pengguna menekan "Start/Mulai" di aplikasi Flutter
  socket.on('find_partner', () => {
    
    if (waitingUser === null) {
      // Skenario A: Belum ada yang antre. Jadikan user ini penunggu.
      waitingUser = socket;
      console.log(`User ${socket.id} masuk antrean.`);
    } else {
      // Skenario B: Sudah ada yang antre. Pasangkan mereka!
      const partner = waitingUser;
      
      // Buat nama ruangan acak (contoh: room-12345)
      const roomName = 'room-' + socket.id;

      // Masukkan kedua user ke dalam ruangan tersebut
      socket.join(roomName);
      partner.join(roomName);

      // Beri tahu keduanya bahwa mereka sudah mendapat pasangan
      // HP yang antre duluan (partner) disuruh membuat "Penawaran WebRTC" (Offer)
      io.to(partner.id).emit('partner_found', { room: roomName, role: 'caller' });
      
      // HP yang baru masuk disuruh bersiap menerima (Answer)
      io.to(socket.id).emit('partner_found', { room: roomName, role: 'receiver' });

      console.log(`User ${socket.id} dan ${partner.id} dipasangkan di ${roomName}`);
      
      // Kosongkan antrean agar orang berikutnya tidak menabrak
      waitingUser = null; 
    }
  });

  // 2. Meneruskan pesan WebRTC (Offer, Answer, ICE Candidates)
  // Server tidak peduli apa isinya, ia hanya bertugas mengoper pesan ini ke pasangan di ruangan yang sama.
  socket.on('webrtc_signal', (data) => {
    socket.to(data.room).emit('webrtc_signal', data);
  });

  // --- TAMBAHKAN KODE INI UNTUK CHAT ---
  socket.on('chat_message', (data) => {
    // Teruskan pesan teks ke pasangan di room yang sama
    socket.to(data.room).emit('chat_message', {
      sender: 'partner',
      text: data.text
    });
  });

  // 3. Saat pengguna menekan tombol "Next" atau menutup aplikasi
  socket.on('disconnect', () => {
    onlineUsers--;
    io.emit('online_count', onlineUsers);
    console.log('User terputus:', socket.id);
    
    // Jika yang keluar adalah orang yang sedang antre, hapus dia dari antrean
    if (waitingUser && waitingUser.id === socket.id) {
      waitingUser = null;
    }

    // Beri tahu pasangannya bahwa koneksi terputus agar dia juga bisa mereset tampilan
    // (Jika Anda menyimpan data room dari user, Anda bisa broadcast ke room tersebut)
    // Untuk kesederhanaan, di aplikasi Anda tombol "Next" akan otomatis memanggil 'find_partner' lagi.
  });
});

// Jalankan server di port 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server signaling WebRTC berjalan di port ${PORT}`);
});
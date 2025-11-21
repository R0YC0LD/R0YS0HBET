const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// ---- Basit JSON DB ----
const dbPath = path.join(__dirname, "db.json");
let db = { messages: [] };

function loadDb() {
  try {
    if (fs.existsSync(dbPath)) {
      const raw = fs.readFileSync(dbPath, "utf-8");
      db = JSON.parse(raw);
      if (!db.messages) db.messages = [];
    } else {
      db = { messages: [] };
    }
  } catch (err) {
    console.error("DB okunamadı:", err);
    db = { messages: [] };
  }
}

function saveDb() {
  fs.writeFile(dbPath, JSON.stringify(db, null, 2), (err) => {
    if (err) console.error("DB yazma hatası:", err);
  });
}

loadDb();

// ---- Statik dosyalar ----
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => {
  res.send("OK");
});

// ---- Online kullanıcılar ----
const onlineUsers = new Map(); // socket.id -> username

function getUserList() {
  return Array.from(onlineUsers.values());
}

// ---- Socket.IO ----
io.on("connection", (socket) => {
  console.log("Yeni bağlantı:", socket.id);

  socket.on("login", (username) => {
    username = String(username || "").trim();

    if (!username) {
      socket.emit("loginError", "Kullanıcı adı boş olamaz.");
      return;
    }

    // Aynı username online ise engelle
    if (getUserList().includes(username)) {
      socket.emit("loginError", "Bu kullanıcı adı zaten kullanımda.");
      return;
    }

    socket.username = username;
    onlineUsers.set(socket.id, username);

    console.log(`Kullanıcı bağlandı: ${username}`);

    // Login olan kullanıcıya: mevcut mesaj geçmişini gönder
    socket.emit("loginSuccess", {
      username,
      messages: db.messages
    });

    // Herkese güncel kullanıcı listesi
    io.emit("userList", getUserList());
  });

  // Mesaj gönder
  socket.on("sendMessage", (text) => {
    if (!socket.username) return;
    text = String(text || "").trim();
    if (!text) return;

    const message = {
      id: Date.now().toString() + "-" + Math.random().toString(16).slice(2),
      from: socket.username,
      text,
      time: Date.now()
    };

    db.messages.push(message);
    saveDb();

    // Tüm kullanıcılara yeni mesaj
    io.emit("messageCreated", message);
  });

  // Mesaj sil
  socket.on("deleteMessage", (messageId) => {
    if (!socket.username) return;
    const idx = db.messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return;

    const msg = db.messages[idx];

    // Sadece kendi mesajını silebilir
    if (msg.from !== socket.username) {
      socket.emit("actionError", "Sadece kendi mesajını silebilirsin.");
      return;
    }

    db.messages.splice(idx, 1);
    saveDb();

    // Herkese silinen mesaj ID'sini gönder
    io.emit("messageDeleted", { id: messageId });
  });

  // Bağlantı kesildi
  socket.on("disconnect", () => {
    if (socket.username) {
      console.log(`Kullanıcı ayrıldı: ${socket.username}`);
    }
    onlineUsers.delete(socket.id);
    io.emit("userList", getUserList());
  });
});

// ---- Sunucu başlat ----
server.listen(PORT, () => {
  console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);
});

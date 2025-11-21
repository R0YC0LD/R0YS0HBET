const socket = io();

// DOM elemanları
const loginOverlay = document.getElementById("loginOverlay");
const loginButton = document.getElementById("loginButton");
const loginError = document.getElementById("loginError");
const usernameInput = document.getElementById("usernameInput");

const chatLayout = document.getElementById("chatLayout");
const currentUserLabel = document.getElementById("currentUserLabel");
const chatStatus = document.getElementById("chatStatus");
const userListEl = document.getElementById("userList");

const chatMessagesEl = document.getElementById("chatMessages");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");

let currentUser = null;

// ---- Login ----
function doLogin() {
  const username = usernameInput.value.trim();
  if (!username) {
    loginError.textContent = "Kullanıcı adı boş olamaz.";
    return;
  }
  socket.emit("login", username);
}

// Login butonu
loginButton.addEventListener("click", doLogin);

// Enter ile login
usernameInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    doLogin();
  }
});

// Sunucudan login hatası
socket.on("loginError", (msg) => {
  loginError.textContent = msg || "Giriş başarısız.";
});

// Login başarılı
socket.on("loginSuccess", ({ username, messages }) => {
  currentUser = username;
  currentUserLabel.textContent = `Sen: @${username}`;
  loginError.textContent = "";
  loginOverlay.style.display = "none";
  chatLayout.style.display = "flex";
  chatStatus.textContent = "Bağlı";

  chatMessagesEl.innerHTML = "";
  messages.forEach((m) => renderMessage(m));
  scrollToBottom();
});

// Online kullanıcı listesi
socket.on("userList", (users) => {
  userListEl.innerHTML = "";
  users.forEach((u) => {
    const div = document.createElement("div");
    div.className = "user-pill";
    div.innerHTML = `
      <div class="dot"></div>
      <span>${u === currentUser ? u + " (sen)" : u}</span>
    `;
    userListEl.appendChild(div);
  });
});

// Bağlantı durumu
socket.on("connect", () => {
  chatStatus.textContent = "Bağlı";
});

socket.on("disconnect", () => {
  chatStatus.textContent = "Bağlantı koptu";
});

// Yeni mesaj
socket.on("messageCreated", (message) => {
  renderMessage(message);
  scrollToBottom();
});

// Mesaj silindi
socket.on("messageDeleted", ({ id }) => {
  const el = document.getElementById("msg-" + id);
  if (el) {
    el.classList.add("fade-out");
    setTimeout(() => el.remove(), 150);
  }
});

// Herhangi bir aksiyon hatası
socket.on("actionError", (msg) => {
  alert(msg);
});

// ---- Mesaj gönderme ----
function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || !currentUser) return;

  socket.emit("sendMessage", text);
  messageInput.value = "";
}

sendButton.addEventListener("click", sendMessage);

messageInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendMessage();
  }
});

// ---- Mesaj render ----
function renderMessage(message) {
  const isSelf = message.from === currentUser;
  const row = document.createElement("div");
  row.className = "message-row" + (isSelf ? " self" : "");
  row.id = "msg-" + message.id;

  const timeStr = formatTime(message.time);

  let actionsHtml = "";
  if (isSelf) {
    actionsHtml = `
      <button class="message-delete" onclick="deleteMessage('${message.id}')">
        Sil
      </button>
    `;
  }

  row.innerHTML = `
    <div class="message-bubble">
      <div class="message-meta">
        <span class="message-sender">${isSelf ? "Sen" : message.from}</span>
        <div class="message-actions">
          <span class="message-time">${timeStr}</span>
          ${actionsHtml}
        </div>
      </div>
      <div class="message-text">${escapeHtml(message.text)}</div>
    </div>
  `;

  chatMessagesEl.appendChild(row);
}

function formatTime(timestamp) {
  const d = new Date(timestamp);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function scrollToBottom() {
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

// XSS koruması
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Globalde kullanılacak
window.deleteMessage = function (id) {
  socket.emit("deleteMessage", id);
};

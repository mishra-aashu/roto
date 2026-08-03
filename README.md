# Roto 📶💬
Roto is a high-performance, cross-platform **Offline Peer-to-Peer (P2P) Messenger and Audio/Video Calling Application** built using React Native (Expo) and WebRTC. Inspired by the clean aesthetic of WhatsApp, Roto allows users on the same local network (WiFi / Hotspot) to discover peers, create chat rooms, text, and initiate video calls—completely offline, secure, and without relying on active internet connections.

---

## 🚀 Key Features

* **Zero-Configuration WiFi Discovery**: Automatically detects the local IP address of the signaling server on the subnet (using Expo Constants), eliminating the need for manual IP configuration.
* **Smart Active WiFi Groups**: Users can create custom group rooms, and others on the same WiFi can join dynamically. Features a real-time header listing all active online group member names (e.g. `You, Raju, Amit`).
* **Direct P2P One-on-One Chat**: Automatically discover other online devices in the same network and instantly initiate personal, secure sessions.
* **Integrated Voice & Video Calls**: Peer-to-peer high-quality audio and video calls with a floating Picture-in-Picture (PiP) window for camera streams.
* **Offline Chat History Persistence**: Uses AsyncStorage to save local and room chats securely on the device, maintaining history across sessions.
* **100% Serverless Fallback (Manual Mode)**: An emergency manual offline mode that lets two peers establish a connection by copying and pasting a single JSON WebRTC SDP handshake key.
* **WhatsApp-Inspired Premium Dark UI**: Stunning layout with active status badges, floating call controls, modern typography, and Ionicons for visual excellence.

---

## 🛠️ Architecture & Tech Stack

1. **Frontend**: React Native, Expo (SDK 51+), Expo Router (File-based navigation).
2. **WebRTC Integration**: Cross-platform WebRTC shims (`react-native-webrtc` for native, native HTML5 APIs for web).
3. **Signaling Server**: Lightweight Node.js WebSocket (`ws`) server for dynamic IP and peer list broadcasting.
4. **Storage**: `@react-native-async-storage/async-storage` for local message persistence.

---

## 🏃 Getting Started

### 1. Run the Signaling Server
The signaling server tracks active users and group rooms on the local network. 

```bash
# Navigate to the server folder
cd server

# Install dependencies
npm install

# Start the server
node server.js
```
The server will run on port `5000` (e.g., `ws://<your-local-ip>:5000`).

### 2. Run the Roto Mobile/Web Application
Open a new terminal window in the root directory:

```bash
# Install dependencies
npm install

# Start Expo Developer Tools
npx expo start
```

Press:
- **`w`** to run in your web browser.
- **`a`** to open on an Android emulator or device.
- **`i`** to open on an iOS simulator or device.

*Tip: For native device testing, scan the QR code using the **Expo Go** app on your physical mobile device. Ensure your phone and the computer running the server are connected to the exact same WiFi network.*

---

## 🔒 Security & Privacy
* All text, video, and audio signals are established directly **Peer-to-Peer** using local WebRTC channels.
* Media streams never pass through any central server.
* Chat messages are stored entirely locally on your device's sandbox environment.

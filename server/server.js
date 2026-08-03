const WebSocket = require('ws');
const http = require('http');
const os = require('os');

const PORT = process.env.PORT || 5000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebRTC Signaling Server is running!\n');
});

const wss = new WebSocket.Server({ server });

// Room structure: roomId -> Map(peerId -> { ws, userName })
const rooms = new Map();

const broadcastRoomsList = () => {
  const roomsList = [];
  rooms.forEach((peersMap, rId) => {
    roomsList.push({
      id: rId,
      name: rId === 'lobby' ? 'Lobby' : rId,
      usersCount: peersMap.size
    });
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'rooms-list',
        rooms: roomsList
      }));
    }
  });
};

wss.on('connection', (ws) => {
  let currentRoom = null;
  let currentPeerId = null;

  console.log('New client connected');
  broadcastRoomsList();

  ws.on('message', (messageText) => {
    try {
      const data = JSON.parse(messageText);
      const { type, roomId, peerId, userName } = data;

      switch (type) {
        case 'join':
          currentRoom = roomId;
          currentPeerId = peerId;

          if (!rooms.has(roomId)) {
            rooms.set(roomId, new Map());
          }
          
          const roomPeers = rooms.get(roomId);
          roomPeers.set(peerId, { ws, userName: userName || `User_${peerId.substring(0, 4)}` });
          console.log(`Peer ${peerId} (${userName}) joined room ${roomId}. Total: ${roomPeers.size}`);

          // Broadcast updated user list and rooms list globally
          broadcastUserList();
          broadcastRoomsList();
          break;

        case 'signal':
          // Relay WebRTC signal (offer, answer, candidate) to target peer globally
          let targetPeerData = null;
          let senderPeerData = null;
          
          rooms.forEach((peersMap) => {
            if (peersMap.has(data.targetId)) {
              targetPeerData = peersMap.get(data.targetId);
            }
            if (peersMap.has(currentPeerId)) {
              senderPeerData = peersMap.get(currentPeerId);
            }
          });

          if (targetPeerData && targetPeerData.ws.readyState === WebSocket.OPEN) {
            targetPeerData.ws.send(JSON.stringify({
              type: 'signal',
              senderId: currentPeerId,
              senderName: senderPeerData?.userName || 'Peer',
              signal: data.signal
            }));
          }
          break;

        case 'chat-message':
          // Broadcast chat message to everyone in the room
          if (currentRoom && rooms.has(currentRoom)) {
            const roomPeers = rooms.get(currentRoom);
            roomPeers.forEach((peerData) => {
              if (peerData.ws.readyState === WebSocket.OPEN) {
                peerData.ws.send(JSON.stringify({
                  type: 'chat-message',
                  senderId: currentPeerId,
                  senderName: userName || 'Peer',
                  text: data.text,
                  timestamp: Date.now()
                }));
              }
            });
          }
          break;

        case 'leave':
          handleLeave();
          break;

        default:
          console.log('Unknown message type:', type);
      }
    } catch (err) {
      console.error('Error parsing socket message:', err);
    }
  });

  const broadcastUserList = () => {
    // Compile global user list across all active rooms
    const globalUserList = [];
    rooms.forEach((peersMap, roomId) => {
      peersMap.forEach((peerData, peerId) => {
        globalUserList.push({
          peerId: peerId,
          userName: peerData.userName,
          room: roomId
        });
      });
    });

    // Send the global list to all connected clients
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'users-list',
          users: globalUserList
        }));
      }
    });
  };

  const handleLeave = () => {
    if (currentRoom && rooms.has(currentRoom) && currentPeerId) {
      const roomPeers = rooms.get(currentRoom);
      roomPeers.delete(currentPeerId);
      console.log(`Peer ${currentPeerId} left room ${currentRoom}. Remaining: ${roomPeers.size}`);

      if (roomPeers.size === 0) {
        rooms.delete(currentRoom);
        console.log(`Room ${currentRoom} is empty and has been removed`);
      }
      
      broadcastUserList();
      broadcastRoomsList();
    }
    currentRoom = null;
    currentPeerId = null;
  };

  ws.on('close', () => {
    console.log('Client disconnected');
    handleLeave();
  });

  ws.on('error', (error) => {
    console.error(`Socket error for peer ${currentPeerId}:`, error);
    handleLeave();
  });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log('\n======================================================');
  console.log(`🚀 WebRTC Signaling Server running on port ${PORT}`);
  console.log('======================================================\n');
  
  // Print local IP addresses for WiFi offline setup
  console.log('📡 Local WiFi IP Addresses (Use these if offline on same WiFi):');
  const interfaces = os.networkInterfaces();
  let foundIP = false;
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`   👉  ws://${net.address}:${PORT}`);
        foundIP = true;
      }
    }
  }
  if (!foundIP) {
    console.log('   ⚠️  No active network interface found. Connect to a WiFi network.');
  }
  console.log('\n======================================================\n');
});

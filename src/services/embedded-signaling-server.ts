import { Platform } from 'react-native';
import { Buffer } from 'buffer';

// Helper for SHA-1 calculation needed for RFC 6455 WebSocket Handshake
function sha1(str: string): string {
  function rotateLeft(n: number, s: number) {
    return (n << s) | (n >>> (32 - s));
  }
  const utf8 = unescape(encodeURIComponent(str));
  const words: number[] = [];
  for (let i = 0; i < utf8.length; i++) {
    words[i >> 2] = (words[i >> 2] || 0) | (utf8.charCodeAt(i) << (24 - (i % 4) * 8));
  }
  const bits = utf8.length * 8;
  words[bits >> 5] = (words[bits >> 5] || 0) | (0x80 << (24 - (bits % 32)));
  words[(((bits + 64) >>> 9) << 4) + 15] = bits;

  const w = new Array(80);
  let h0 = 0x67452301,
    h1 = 0xefcdab89,
    h2 = 0x98badcfe,
    h3 = 0x10325476,
    h4 = 0xc3d2e1f0;

  for (let i = 0; i < words.length; i += 16) {
    for (let t = 0; t < 16; t++) w[t] = words[i + t] || 0;
    for (let t = 16; t < 80; t++) w[t] = rotateLeft(w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16], 1);
    let a = h0,
      b = h1,
      c = h2,
      d = h3,
      e = h4;
    for (let t = 0; t < 80; t++) {
      let f: number, k: number;
      if (t < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (t < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (t < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const temp = (rotateLeft(a, 5) + f + e + k + w[t]) & 0xffffffff;
      e = d;
      d = c;
      c = rotateLeft(b, 30);
      b = a;
      a = temp;
    }
    h0 = (h0 + a) & 0xffffffff;
    h1 = (h1 + b) & 0xffffffff;
    h2 = (h2 + c) & 0xffffffff;
    h3 = (h3 + d) & 0xffffffff;
    h4 = (h4 + e) & 0xffffffff;
  }

  const bytes: number[] = [];
  [h0, h1, h2, h3, h4].forEach((h) => {
    for (let i = 3; i >= 0; i--) bytes.push((h >>> (i * 8)) & 0xff);
  });

  return btoa(String.fromCharCode.apply(null, bytes));
}

// Encode WebSocket unmasked text frame from server to client (RFC 6455)
function encodeWebSocketTextFrame(text: string): Buffer {
  const payload = Buffer.from(text, 'utf8');
  let header: Buffer;
  if (payload.length <= 125) {
    header = Buffer.from([0x81, payload.length]);
  } else if (payload.length <= 65535) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    (header as any).writeUInt32BE(0, 2);
    (header as any).writeUInt32BE(payload.length, 6);
  }
  return Buffer.concat([header, payload]);
}

// Decode WebSocket masked text frame from client to server (RFC 6455)
function decodeWebSocketFrame(buffer: Buffer): { opcode: number; text?: string; complete: boolean } {
  if (buffer.length < 2) return { opcode: 0, complete: false };
  const firstByte = buffer[0];
  const secondByte = buffer[1];
  const opcode = firstByte & 0x0f;
  const isMasked = (secondByte & 0x80) !== 0;
  let payloadLength = secondByte & 0x7f;
  let offset = 2;

  if (payloadLength === 126) {
    if (buffer.length < 4) return { opcode, complete: false };
    payloadLength = buffer.readUInt16BE(2);
    offset = 4;
  } else if (payloadLength === 127) {
    if (buffer.length < 10) return { opcode, complete: false };
    payloadLength = (buffer as any).readUInt32BE(6);
    offset = 10;
  }

  if (isMasked) {
    if (buffer.length < offset + 4 + payloadLength) return { opcode, complete: false };
    const mask = buffer.slice(offset, offset + 4);
    offset += 4;
    const payload = buffer.slice(offset, offset + payloadLength);
    const unmasked = Buffer.alloc(payloadLength);
    for (let i = 0; i < payloadLength; i++) {
      unmasked[i] = payload[i] ^ mask[i % 4];
    }
    return { opcode, text: unmasked.toString('utf8'), complete: true };
  } else {
    if (buffer.length < offset + payloadLength) return { opcode, complete: false };
    const payload = buffer.slice(offset, offset + payloadLength);
    return { opcode, text: payload.toString('utf8'), complete: true };
  }
}

interface PeerInfo {
  socket: any;
  userName: string;
  isWebSocket: boolean;
}

class EmbeddedSignalingServer {
  private server: any = null;
  private isRunning: boolean = false;
  private rooms: Map<string, Map<string, PeerInfo>> = new Map();
  private allClients: Set<any> = new Set();
  private port: number = 5000;

  public isServerRunning(): boolean {
    return this.isRunning;
  }

  public getPort(): number {
    return this.port;
  }

  // Broadcast list of rooms to all connected clients
  private broadcastRoomsList() {
    const roomsList: Array<{ id: string; name: string; usersCount: number }> = [];
    this.rooms.forEach((peersMap, rId) => {
      roomsList.push({
        id: rId,
        name: rId === 'lobby' ? 'Lobby' : rId,
        usersCount: peersMap.size,
      });
    });

    const msg = JSON.stringify({
      type: 'rooms-list',
      rooms: roomsList,
    });

    this.broadcastRaw(msg);
  }

  // Broadcast user list to all connected clients
  private broadcastUserList() {
    const globalUserList: Array<{ peerId: string; userName: string; room: string }> = [];
    this.rooms.forEach((peersMap, roomId) => {
      peersMap.forEach((peerData, peerId) => {
        globalUserList.push({
          peerId: peerId,
          userName: peerData.userName,
          room: roomId,
        });
      });
    });

    const msg = JSON.stringify({
      type: 'users-list',
      users: globalUserList,
    });

    this.broadcastRaw(msg);
  }

  // Send encoded message to a client socket
  private sendToSocket(socket: any, text: string) {
    try {
      if (socket && !socket.destroyed) {
        const frame = encodeWebSocketTextFrame(text);
        socket.write(frame);
      }
    } catch (err) {
      console.error('[EmbeddedServer] Error writing to socket:', err);
    }
  }

  // Broadcast text message to all active clients
  private broadcastRaw(text: string) {
    const frame = encodeWebSocketTextFrame(text);
    this.allClients.forEach((socket) => {
      try {
        if (socket && !socket.destroyed) {
          socket.write(frame);
        }
      } catch (err) {
        console.error('[EmbeddedServer] Error broadcasting to client:', err);
      }
    });
  }

  // Clean up when a peer disconnects
  private handlePeerDisconnect(currentRoom: string | null, currentPeerId: string | null) {
    if (currentRoom && this.rooms.has(currentRoom) && currentPeerId) {
      const roomPeers = this.rooms.get(currentRoom);
      if (roomPeers) {
        roomPeers.delete(currentPeerId);
        console.log(`[EmbeddedServer] Peer ${currentPeerId} left ${currentRoom}. Remaining: ${roomPeers.size}`);
        if (roomPeers.size === 0) {
          this.rooms.delete(currentRoom);
        }
      }
      this.broadcastUserList();
      this.broadcastRoomsList();
    }
  }

  // Start the server
  public async start(port = 5000): Promise<{ success: boolean; port: number; message?: string }> {
    if (this.isRunning) {
      return { success: true, port: this.port, message: 'Server already running' };
    }

    this.port = port;

    if (Platform.OS === 'web') {
      console.log('[EmbeddedServer] Web platform detected; embedded native sockets run externally.');
      return { success: false, port, message: 'Embedded server is only supported natively on Android/iOS.' };
    }

    try {
      let TcpSockets: any;
      try {
        TcpSockets = require('react-native-tcp-socket').default || require('react-native-tcp-socket');
      } catch (e) {
        console.warn('[EmbeddedServer] react-native-tcp-socket module not found:', e);
        return { success: false, port, message: 'react-native-tcp-socket is not loaded in this environment.' };
      }

      this.server = TcpSockets.createServer((socket: any) => {
        let isHandshakeComplete = false;
        let currentRoom: string | null = null;
        let currentPeerId: string | null = null;
        let rawBuffer = Buffer.alloc(0);

        this.allClients.add(socket);
        console.log('[EmbeddedServer] New client connected to mobile host');

        socket.on('data', (data: Buffer | string) => {
          try {
            const chunk = typeof data === 'string' ? Buffer.from(data) : data;
            rawBuffer = Buffer.concat([rawBuffer, chunk]);

            // 1. Initial WebSocket Upgrade Handshake
            if (!isHandshakeComplete) {
              const requestStr = rawBuffer.toString('utf8');
              if (requestStr.includes('\r\n\r\n')) {
                const keyMatch = requestStr.match(/Sec-WebSocket-Key: (.+)\r\n/i);
                if (keyMatch) {
                  const clientKey = keyMatch[1].trim();
                  const acceptKey = sha1(clientKey + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11');

                  const response =
                    'HTTP/1.1 101 Switching Protocols\r\n' +
                    'Upgrade: websocket\r\n' +
                    'Connection: Upgrade\r\n' +
                    `Sec-WebSocket-Accept: ${acceptKey}\r\n\r\n`;

                  socket.write(response);
                  isHandshakeComplete = true;
                  rawBuffer = Buffer.alloc(0);
                  console.log('[EmbeddedServer] Handshake accepted for client');
                  this.broadcastRoomsList();
                  return;
                }
              }
              return;
            }

            // 2. Process incoming WebSocket frames
            while (rawBuffer.length > 0) {
              const decoded = decodeWebSocketFrame(rawBuffer);
              if (!decoded.complete) break;

              // Handle close frame (0x08)
              if (decoded.opcode === 0x08) {
                socket.destroy();
                return;
              }

              // Handle ping frame (0x09) -> pong (0x0A)
              if (decoded.opcode === 0x09) {
                const pong = Buffer.from([0x8a, 0x00]);
                socket.write(pong);
                rawBuffer = Buffer.alloc(0);
                return;
              }

              if (decoded.text) {
                try {
                  const dataObj = JSON.parse(decoded.text);
                  const { type, roomId, peerId, userName } = dataObj;

                  switch (type) {
                    case 'join':
                      currentRoom = roomId;
                      currentPeerId = peerId;
                      if (!this.rooms.has(roomId)) {
                        this.rooms.set(roomId, new Map());
                      }
                      const roomPeers = this.rooms.get(roomId)!;
                      roomPeers.set(peerId, {
                        socket,
                        userName: userName || `User_${peerId.substring(0, 4)}`,
                        isWebSocket: true,
                      });
                      console.log(`[EmbeddedServer] Peer ${peerId} (${userName}) joined ${roomId}`);
                      this.broadcastUserList();
                      this.broadcastRoomsList();
                      break;

                    case 'signal':
                      let targetPeerData: PeerInfo | null = null;
                      let senderPeerData: PeerInfo | null = null;
                      this.rooms.forEach((peersMap) => {
                        if (peersMap.has(dataObj.targetId)) {
                          targetPeerData = peersMap.get(dataObj.targetId)!;
                        }
                        if (peersMap.has(currentPeerId || '')) {
                          senderPeerData = peersMap.get(currentPeerId || '')!;
                        }
                      });

                      if (targetPeerData) {
                        this.sendToSocket(
                          (targetPeerData as PeerInfo).socket,
                          JSON.stringify({
                            type: 'signal',
                            senderId: currentPeerId,
                            senderName: (senderPeerData as any)?.userName || 'Peer',
                            signal: dataObj.signal,
                          })
                        );
                      }
                      break;

                    case 'chat-message':
                      if (currentRoom && this.rooms.has(currentRoom)) {
                        const peers = this.rooms.get(currentRoom)!;
                        const outMsg = JSON.stringify({
                          type: 'chat-message',
                          senderId: currentPeerId,
                          senderName: userName || 'Peer',
                          text: dataObj.text,
                          timestamp: Date.now(),
                        });
                        peers.forEach((peer) => {
                          this.sendToSocket(peer.socket, outMsg);
                        });
                      }
                      break;

                    case 'leave':
                      this.handlePeerDisconnect(currentRoom, currentPeerId);
                      currentRoom = null;
                      currentPeerId = null;
                      break;
                  }
                } catch (parseErr) {
                  console.error('[EmbeddedServer] Error parsing frame payload:', parseErr);
                }
              }

              // Advance raw buffer
              rawBuffer = Buffer.alloc(0);
            }
          } catch (err) {
            console.error('[EmbeddedServer] Socket data error:', err);
          }
        });

        socket.on('close', () => {
          this.allClients.delete(socket);
          this.handlePeerDisconnect(currentRoom, currentPeerId);
        });

        socket.on('error', (err: any) => {
          console.error('[EmbeddedServer] Client socket error:', err);
          this.allClients.delete(socket);
          this.handlePeerDisconnect(currentRoom, currentPeerId);
        });
      });

      return new Promise((resolve) => {
        this.server.listen({ port, host: '0.0.0.0' }, () => {
          this.isRunning = true;
          console.log(`[EmbeddedServer] 🚀 Android Host Server listening on 0.0.0.0:${port}`);
          resolve({ success: true, port });
        });

        this.server.on('error', (err: any) => {
          console.error('[EmbeddedServer] Server listener error:', err);
          this.isRunning = false;
          resolve({ success: false, port, message: err?.message || 'Server error' });
        });
      });
    } catch (err: any) {
      console.error('[EmbeddedServer] Failed to launch server:', err);
      this.isRunning = false;
      return { success: false, port, message: err?.message };
    }
  }

  // Stop the server and clean up all resources
  public stop() {
    if (!this.isRunning && !this.server) return;
    console.log('[EmbeddedServer] Stopping Android Host Server...');

    try {
      this.allClients.forEach((socket) => {
        try {
          socket.destroy();
        } catch (e) {}
      });
      this.allClients.clear();
      this.rooms.clear();

      if (this.server) {
        this.server.close();
        this.server = null;
      }
    } catch (err) {
      console.error('[EmbeddedServer] Error stopping server:', err);
    } finally {
      this.isRunning = false;
    }
  }
}

export const embeddedSignalingServer = new EmbeddedSignalingServer();

import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  isWebRTCSupported
} from '@/utils/webrtc-shims';

export interface ChatMessage {
  id: string;
  sender: 'me' | 'them';
  senderName: string;
  text: string;
  timestamp: number;
}

export interface IceServerConfig {
  urls: string;
  username?: string;
  credential?: string;
}

export function useWebRTCChat() {
  // Connection states
  const [peerId] = useState(() => Math.random().toString(36).substring(7));
  const [roomId, setRoomId] = useState('lobby');
  const roomIdRef = useRef(roomId);
  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'failed'>('disconnected');
  const [signalingStatus, setSignalingStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');

  // Username states
  const [userName, setUserNameState] = useState(() => 'User_' + Math.floor(100 + Math.random() * 900));
  const [remoteUserName, setRemoteUserName] = useState('Peer');
  const userNameRef = useRef(userName);
  const [discoveredUsers, setDiscoveredUsers] = useState<Array<{ peerId: string, userName: string, room?: string }>>([]);
  const [activeRooms, setActiveRooms] = useState<Array<{ id: string, name: string, usersCount: number }>>([]);

  const setUserName = (name: string) => {
    setUserNameState(name);
    userNameRef.current = name;
  };
  
  // Settings
  const [signalingUrl, setSignalingUrl] = useState('ws://192.168.1.100:5000'); // default placeholder
  const [stunServer, setStunServer] = useState('stun:stun.l.google.com:19302');
  const [turnServer, setTurnServer] = useState('');
  const [turnUsername, setTurnUsername] = useState('');
  const [turnPassword, setTurnPassword] = useState('');
  const [isManualMode, setIsManualMode] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Ref to track the current active key for which messages state is loaded/valid
  const currentChatKeyRef = useRef<string>('');

  // Load chat history from AsyncStorage on room or remoteUserName change
  useEffect(() => {
    let active = true;
    
    // Invalidate the current key immediately so we don't save old messages to new key
    currentChatKeyRef.current = '';
    setMessages([]);

    const loadStoredMessages = async () => {
      let key = '';
      if (!isManualMode && roomId !== 'lobby') {
        key = `@roto_group_${roomId}`;
      } else if ((isManualMode || roomId === 'lobby') && remoteUserName && remoteUserName !== 'Peer') {
        key = `@roto_p2p_${remoteUserName}`;
      }

      if (key) {
        try {
          const stored = await AsyncStorage.getItem(key);
          if (stored && active) {
            currentChatKeyRef.current = key;
            setMessages(JSON.parse(stored));
            return;
          }
        } catch (err) {
          console.error('Failed to load chat history:', err);
        }
      }
      if (active) {
        currentChatKeyRef.current = key;
        setMessages([]);
      }
    };

    loadStoredMessages();
    return () => {
      active = false;
    };
  }, [roomId, remoteUserName, isManualMode]);

  // Save chat history to AsyncStorage whenever messages change
  useEffect(() => {
    const saveMessages = async () => {
      let key = '';
      if (!isManualMode && roomId !== 'lobby') {
        key = `@roto_group_${roomId}`;
      } else if ((isManualMode || roomId === 'lobby') && remoteUserName && remoteUserName !== 'Peer') {
        key = `@roto_p2p_${remoteUserName}`;
      }

      // Only save if the computed key matches the currently active loaded chat key
      if (key && key === currentChatKeyRef.current && messages.length > 0) {
        try {
          await AsyncStorage.setItem(key, JSON.stringify(messages));
        } catch (err) {
          console.error('Failed to save chat history:', err);
        }
      }
    };

    saveMessages();
  }, [messages, roomId, remoteUserName, isManualMode]);
  
  // Media states
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);

  // Manual configuration inputs / outputs
  const [manualOfferInput, setManualOfferInput] = useState('');
  const [manualAnswerInput, setManualAnswerInput] = useState('');
  const [generatedOffer, setGeneratedOffer] = useState('');
  const [generatedAnswer, setGeneratedAnswer] = useState('');
  const [gatheringIce, setGatheringIce] = useState(false);

  // Refs
  const peerConnectionRef = useRef<any>(null);
  const dataChannelRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const targetPeerIdRef = useRef<string | null>(null);

  // Get ICE server config array
  const getIceServers = useCallback((): IceServerConfig[] => {
    const servers: IceServerConfig[] = [];
    if (stunServer) {
      servers.push({ urls: stunServer });
    }
    if (turnServer) {
      const config: IceServerConfig = { urls: turnServer };
      if (turnUsername) config.username = turnUsername;
      if (turnPassword) config.credential = turnPassword;
      servers.push(config);
    }
    return servers;
  }, [stunServer, turnServer, turnUsername, turnPassword]);

  // Clean up existing peer connection
  const cleanupPeerConnection = useCallback(() => {
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setRemoteStream(null);
    setConnectionStatus('disconnected');
    setIsCallActive(false);
    targetPeerIdRef.current = null;
  }, []);

  // Clean up all resources
  const resetAll = useCallback(() => {
    cleanupPeerConnection();
    if (wsRef.current) {
      // Nullify listeners to prevent asynchronous events from modifying state after close
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((track: any) => track.stop());
      setLocalStream(null);
    }
    setSignalingStatus('disconnected');
    setRemoteUserName('Peer');
    setMessages([]);
    setGeneratedOffer('');
    setGeneratedAnswer('');
    setManualOfferInput('');
    setManualAnswerInput('');
  }, [cleanupPeerConnection, localStream]);

  // Handle incoming data channel message
  const handleDataChannelMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'system-name') {
        setRemoteUserName(msg.name);
      } else if (msg.type === 'chat') {
        setMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substring(7),
            sender: 'them',
            senderName: msg.senderName || 'Peer',
            text: msg.text,
            timestamp: Date.now()
          }
        ]);
      }
    } catch (err) {
      console.error('Error handling data channel message:', err);
    }
  }, []);

  // Setup Data Channel event listeners
  const setupDataChannel = useCallback((channel: any) => {
    dataChannelRef.current = channel;

    channel.onopen = () => {
      console.log('Data channel opened');
      setConnectionStatus('connected');
      
      // Send our username to peer immediately
      try {
        channel.send(JSON.stringify({
          type: 'system-name',
          name: userNameRef.current
        }));
      } catch (err) {
        console.error('Failed to send username on channel open:', err);
      }
    };

    channel.onclose = () => {
      console.log('Data channel closed');
      setConnectionStatus('disconnected');
      setRemoteUserName('Peer');
    };

    channel.onerror = (error: any) => {
      console.error('Data channel error:', error);
      setConnectionStatus('failed');
    };

    channel.onmessage = handleDataChannelMessage;
  }, [handleDataChannelMessage]);

  // Setup Peer Connection
  const createPeerConnection = useCallback((targetId: string | null = null) => {
    if (!isWebRTCSupported) {
      console.error('WebRTC is not supported in this environment');
      return null;
    }

    cleanupPeerConnection();
    targetPeerIdRef.current = targetId;

    const configuration = {
      iceServers: getIceServers(),
    };

    console.log('Creating Peer Connection with config:', configuration);
    const pc = new RTCPeerConnection(configuration);
    peerConnectionRef.current = pc;

    // Track state change
    pc.onconnectionstatechange = () => {
      console.log('Connection state changed:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setConnectionStatus('connected');
      } else if (pc.connectionState === 'connecting') {
        setConnectionStatus('connecting');
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        setConnectionStatus('failed');
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state changed:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setConnectionStatus('connected');
      } else if (pc.iceConnectionState === 'disconnected') {
        setConnectionStatus('disconnected');
      } else if (pc.iceConnectionState === 'failed') {
        setConnectionStatus('failed');
      }
    };

    // Handle incoming media streams
    pc.ontrack = (event: any) => {
      console.log('Received remote track', event.streams);
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
        setIsCallActive(true);
      }
    };

    // Attach local stream tracks if video/audio is active
    if (localStream) {
      localStream.getTracks().forEach((track: any) => {
        pc.addTrack(track, localStream);
      });
    }

    // ICE Candidate gathering
    pc.onicecandidate = (event: any) => {
      if (event.candidate) {
        // Send ICE candidate to peer via signaling server if online
        if (!isManualMode && wsRef.current && wsRef.current.readyState === WebSocket.OPEN && targetPeerIdRef.current) {
          wsRef.current.send(
            JSON.stringify({
              type: 'signal',
              roomId,
              peerId,
              targetId: targetPeerIdRef.current,
              signal: { candidate: event.candidate }
            })
          );
        }
      } else {
        console.log('ICE Candidate gathering complete.');
        setGatheringIce(false);

        // For manual (offline) mode, update generated state when gathering finishes
        if (isManualMode) {
          const sdp = pc.localDescription;
          if (sdp) {
            if (sdp.type === 'offer') {
              setGeneratedOffer(JSON.stringify(sdp));
            } else if (sdp.type === 'answer') {
              setGeneratedAnswer(JSON.stringify(sdp));
            }
          }
        }
      }
    };

    return pc;
  }, [cleanupPeerConnection, getIceServers, localStream, isManualMode, roomId, peerId]);

  // Start Media Stream (Audio/Video Call)
  const startMedia = useCallback(async (video = true, audio = true) => {
    if (!mediaDevices) {
      alert('Media devices API not available on this platform/browser.');
      return;
    }

    try {
      if (localStream) {
        // Stop existing local stream
        localStream.getTracks().forEach((track: any) => track.stop());
      }

      // In react-native-webrtc, constraint syntax is mostly identical to Web
      const stream = await mediaDevices.getUserMedia({
        video: video ? { facingMode: 'user' } : false,
        audio: audio,
      });

      setLocalStream(stream);
      setIsAudioMuted(false);
      setIsVideoMuted(false);

      // Add tracks to existing peer connection if we are already connected
      if (peerConnectionRef.current) {
        stream.getTracks().forEach((track: any) => {
          peerConnectionRef.current.addTrack(track, stream);
        });
        
        // Re-negotiate connection
        if (!isManualMode) {
          renegotiateConnection();
        }
      }
      return stream;
    } catch (err) {
      console.error('Error accessing camera/microphone:', err);
      alert('Error accessing camera/microphone. Please check permissions.');
    }
  }, [localStream, isManualMode]);

  // Stop Media Stream (End Call)
  const stopMedia = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach((track: any) => track.stop());
      setLocalStream(null);
    }
    // Remove track configurations or recreate connection
    setIsCallActive(false);
    if (peerConnectionRef.current) {
      cleanupPeerConnection();
      // Recreate empty peer connection if we still want to keep chatting
      if (!isManualMode && targetPeerIdRef.current) {
        const pc = createPeerConnection(targetPeerIdRef.current);
        if (pc) {
          const dc = pc.createDataChannel('chat', { ordered: true });
          setupDataChannel(dc);
          sendOffer(pc, targetPeerIdRef.current);
        }
      }
    }
  }, [localStream, isManualMode, createPeerConnection, setupDataChannel, cleanupPeerConnection]);

  // Toggle audio track
  const toggleAudio = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track: any) => {
        track.enabled = !track.enabled;
      });
      setIsAudioMuted(!isAudioMuted);
    }
  }, [localStream, isAudioMuted]);

  // Toggle video track
  const toggleVideo = useCallback(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track: any) => {
        track.enabled = !track.enabled;
      });
      setIsVideoMuted(!isVideoMuted);
    }
  }, [localStream, isVideoMuted]);

  // Renegotiate connection (when stream is added later)
  const renegotiateConnection = async () => {
    const pc = peerConnectionRef.current;
    if (pc && targetPeerIdRef.current) {
      try {
        console.log('Renegotiating connection...');
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'signal',
              roomId,
              peerId,
              targetId: targetPeerIdRef.current,
              signal: offer
            })
          );
        }
      } catch (err) {
        console.error('Error renegotiating WebRTC:', err);
      }
    }
  };

  // Helper to send Offer via signaling
  const sendOffer = async (pc: any, targetId: string) => {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      console.log('Sending offer to', targetId);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'signal',
            roomId,
            peerId,
            targetId,
            signal: offer
          })
        );
      }
    } catch (err) {
      console.error('Failed to create offer:', err);
    }
  };

  // Connect to a discovered peer from the list
  const connectToPeer = useCallback(async (targetId: string, targetName: string) => {
    console.log('Connecting to target peer:', targetId, targetName);
    cleanupPeerConnection(); // Close any active peer connection, keep WebSocket alive
    setRemoteUserName(targetName);
    setConnectionStatus('connecting');

    const pc = createPeerConnection(targetId);
    if (pc) {
      const dc = pc.createDataChannel('chat', { ordered: true });
      setupDataChannel(dc);
      await sendOffer(pc, targetId);
    }
  }, [createPeerConnection, setupDataChannel, cleanupPeerConnection]);

  // Connect to Signaling Server (Online / Local WiFi mode)
  const connectSignaling = useCallback((url: string, targetRoom: string) => {
    resetAll();
    setRoomId(targetRoom);
    setSignalingUrl(url);
    setIsManualMode(false);
    setSignalingStatus('connecting');

    console.log(`Connecting to signaling server at: ${url}`);
    
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Signaling server connected');
        setSignalingStatus('connected');
        // Join room with username
        ws.send(
          JSON.stringify({
            type: 'join',
            roomId: targetRoom,
            peerId: peerId,
            userName: userNameRef.current
          })
        );
      };

      ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('Signaling received:', message.type);

          switch (message.type) {
            case 'users-list': {
              const onlineUsers = message.users.filter((u: any) => u.peerId !== peerId);
              console.log('[useWebRTCChat] Received users-list. Total:', message.users.length, 'Filtered:', onlineUsers.length, 'Users:', JSON.stringify(onlineUsers));
              setDiscoveredUsers(onlineUsers);
              break;
            }

            case 'rooms-list':
              setActiveRooms(message.rooms || []);
              break;

            case 'chat-message': {
              // Only process group chat messages if we are actually in that group room (not lobby)
              if (roomIdRef.current !== 'lobby') {
                const { senderId, senderName: msgSenderName, text: msgText, timestamp } = message;
                setMessages((prev) => [
                  ...prev,
                  {
                    id: Math.random().toString(36).substring(7),
                    sender: senderId === peerId ? 'me' : 'them',
                    senderName: msgSenderName,
                    text: msgText,
                    timestamp: timestamp || Date.now()
                  }
                ]);
              }
              break;
            }

            case 'signal': {
              // WebRTC signal payload (offer, answer, or candidate)
              const { senderId, senderName, signal } = message;
              let pc = peerConnectionRef.current;

              if (!pc) {
                // Set remote peer details before connecting
                setRemoteUserName(senderName || 'Peer');
                pc = createPeerConnection(senderId);
              }

              if (signal.type === 'offer') {
                console.log('Received WebRTC offer');
                await pc.setRemoteDescription(new RTCSessionDescription(signal));
                
                // Setup data channel listener (receiver side)
                pc.ondatachannel = (event: any) => {
                  setupDataChannel(event.channel);
                };

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                ws.send(
                  JSON.stringify({
                    type: 'signal',
                    roomId: targetRoom,
                    peerId,
                    targetId: senderId,
                    signal: answer
                  })
                );
              } else if (signal.type === 'answer') {
                console.log('Received WebRTC answer');
                await pc.setRemoteDescription(new RTCSessionDescription(signal));
              } else if (signal.candidate) {
                console.log('Received WebRTC ICE candidate');
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                } catch (candidateErr) {
                  console.warn('Error adding received ICE candidate', candidateErr);
                }
              }
              break;
            }
          }
        } catch (err) {
          console.error('Error parsing signaling payload:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('Signaling socket error:', err);
        setSignalingStatus('error');
      };

      ws.onclose = () => {
        console.log('Signaling socket closed');
        setSignalingStatus('disconnected');
        setDiscoveredUsers([]);
        setActiveRooms([]);
      };

    } catch (err) {
      console.error('Error starting WebSocket connection:', err);
      setSignalingStatus('error');
    }
  }, [peerId, createPeerConnection, setupDataChannel, cleanupPeerConnection, resetAll]);

  // MANUAL SIGNALING (Offline mode)
  // Step 1: Creator generates manual offer
  const createManualOffer = useCallback(async () => {
    resetAll();
    setIsManualMode(true);
    setConnectionStatus('connecting');
    setGatheringIce(true);
    setGeneratedOffer('');

    const pc = createPeerConnection();
    if (!pc) return;

    // Creator creates data channel
    const dc = pc.createDataChannel('chat', { ordered: true });
    setupDataChannel(dc);

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      // Wait for ice candidates. Once gathering stops, `onicecandidate` will set `generatedOffer` state
    } catch (err) {
      console.error('Failed to create manual offer:', err);
      setConnectionStatus('failed');
      setGatheringIce(false);
    }
  }, [createPeerConnection, setupDataChannel, resetAll]);

  // Step 2: Receiver accepts manual offer, generates answer
  const acceptManualOfferAndGenerateAnswer = useCallback(async (offerString: string) => {
    resetAll();
    setIsManualMode(true);
    setConnectionStatus('connecting');
    setGatheringIce(true);
    setGeneratedAnswer('');

    const pc = createPeerConnection();
    if (!pc) return;

    // Listen for data channel
    pc.ondatachannel = (event: any) => {
      setupDataChannel(event.channel);
    };

    try {
      const parsedOffer = JSON.parse(offerString);
      await pc.setRemoteDescription(new RTCSessionDescription(parsedOffer));
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      // Wait for ice candidates. Once gathering stops, `onicecandidate` will set `generatedAnswer` state
    } catch (err) {
      console.error('Failed to accept manual offer/generate answer:', err);
      alert('Invalid offer format. Please copy and paste the entire JSON string.');
      setConnectionStatus('failed');
      setGatheringIce(false);
    }
  }, [createPeerConnection, setupDataChannel, resetAll]);

  // Step 3: Creator accepts manual answer to establish connection
  const acceptManualAnswer = useCallback(async (answerString: string) => {
    const pc = peerConnectionRef.current;
    if (!pc) {
      alert('No active peer connection to apply the answer to. Please start by creating an offer.');
      return;
    }

    try {
      const parsedAnswer = JSON.parse(answerString);
      await pc.setRemoteDescription(new RTCSessionDescription(parsedAnswer));
      console.log('Manual answer applied successfully');
    } catch (err) {
      console.error('Failed to apply manual answer:', err);
      alert('Invalid answer format. Please copy and paste the entire JSON string.');
    }
  }, []);

  // Send message
  const sendMessage = useCallback((text: string) => {
    if (!text.trim()) return;
    
    // 1. If in a Group Chat (roomId is not 'lobby'), send via WebSocket server
    if (roomId !== 'lobby' && !isManualMode) {
      const ws = wsRef.current;
      if (ws && ws.readyState === 1) { // 1 is WebSocket.OPEN
        try {
          ws.send(JSON.stringify({
            type: 'chat-message',
            roomId,
            peerId,
            userName: userNameRef.current,
            text: text
          }));
          return;
        } catch (err) {
          console.error('Error sending message over WebSocket:', err);
        }
      } else {
        console.warn('WebSocket is not open.');
        alert('Cannot send message. You are disconnected from the server.');
        return;
      }
    }

    // 2. If in P2P Chat (roomId is 'lobby' or isManualMode is true), send via WebRTC Data Channel
    const dc = dataChannelRef.current;
    if (dc && dc.readyState === 'open') {
      const messageObj = {
        type: 'chat',
        text: text,
        senderName: userNameRef.current
      };
      
      try {
        dc.send(JSON.stringify(messageObj));
        setMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substring(7),
            sender: 'me',
            senderName: userNameRef.current,
            text: text,
            timestamp: Date.now()
          }
        ]);
      } catch (err) {
        console.error('Error sending message over data channel:', err);
        alert('Failed to send message. Connection might be unstable.');
      }
    } else {
      console.warn('Data channel is not open.');
      alert('Cannot send message. WebRTC P2P connection is not established.');
    }
  }, [isManualMode, roomId, peerId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // We don't call resetAll directly because we want to preserve states, but we clean up sockets
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, []);

  return {
    peerId,
    roomId,
    connectionStatus,
    signalingStatus,
    signalingUrl,
    setSignalingUrl,
    stunServer,
    setStunServer,
    turnServer,
    setTurnServer,
    turnUsername,
    setTurnUsername,
    turnPassword,
    setTurnPassword,
    isManualMode,
    setIsManualMode,
    userName,
    setUserName,
    remoteUserName,
    setRemoteUserName,
    discoveredUsers,
    activeRooms,
    connectToPeer,
    messages,
    sendMessage,
    localStream,
    remoteStream,
    isAudioMuted,
    isVideoMuted,
    isCallActive,
    startMedia,
    stopMedia,
    toggleAudio,
    toggleVideo,
    connectSignaling,
    cleanupPeerConnection,
    // manual mode functions
    createManualOffer,
    acceptManualOfferAndGenerateAnswer,
    acceptManualAnswer,
    manualOfferInput,
    setManualOfferInput,
    manualAnswerInput,
    setManualAnswerInput,
    generatedOffer,
    generatedAnswer,
    gatheringIce,
    resetAll
  };
}

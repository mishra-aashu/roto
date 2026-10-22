import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Clipboard,
  Switch,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWebRTCChat } from '@/hooks/use-webrtc-chat';
import { WebRTCVideo } from '@/components/webrtc-video';
import { RadarScanner } from '@/components/RadarScanner';
import { IncomingCallModal } from '@/components/IncomingCallModal';
import { OutgoingCallModal } from '@/components/OutgoingCallModal';
import Constants from 'expo-constants';
import * as Network from 'expo-network';
import { Ionicons } from '@expo/vector-icons';

const getAutoHostIp = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.hostname;
  }
  // Expo native app host IP resolution
  const hostUri = Constants.expoConfig?.hostUri || 
                  (Constants.manifest as any)?.debuggerHost || 
                  '';
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip) return ip;
  }
  return '192.168.1.9'; // Fallback
};

const DEFAULT_IP = getAutoHostIp();

const getWebSocketUrl = (serverIp: string) => {
  if (!serverIp) return '';
  const cleanInput = serverIp.trim();
  if (cleanInput.startsWith('ws://') || cleanInput.startsWith('wss://')) {
    return cleanInput;
  }
  const isLocalhost = cleanInput.startsWith('localhost') || cleanInput.startsWith('127.0.0.1');
  
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.protocol === 'https:' && !isLocalhost) {
    // Over HTTPS, default to secure WebSocket (wss://) unless it's localhost
    return `wss://${cleanInput}`;
  }
  
  // Default to insecure WebSocket (ws://) on port 5000
  return `ws://${cleanInput}:5000`;
};

export default function HomeScreen() {
  const {
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
    resetAll,
    isHostMode,
    startHostMode,
    stopHostMode,
    incomingCall,
    outgoingCall,
    initiateCall,
    acceptIncomingCall,
    rejectIncomingCall,
    cancelOutgoingCall,
  } = useWebRTCChat();

  const [appState, setAppState] = useState<'login' | 'home' | 'chat'>('login');
  const [activeHomeTab, setActiveHomeTab] = useState<'chats' | 'groups'>('chats');
  const [inputMessage, setInputMessage] = useState('');
  const [isCreateGroupModalVisible, setIsCreateGroupModalVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [targetRoom, setTargetRoom] = useState('lobby');
  const [deviceIp, setDeviceIp] = useState(DEFAULT_IP);
  const [serverIpInput, setServerIpInput] = useState(DEFAULT_IP);
  const [showSettings, setShowSettings] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Auto-resolve local IP on physical device or hotspot
  useEffect(() => {
    async function resolveNetworkIp() {
      try {
        if (Platform.OS !== 'web') {
          const ip = await Network.getIpAddressAsync();
          if (ip && ip !== '0.0.0.0') {
            setDeviceIp(ip);
            setServerIpInput(ip);
          }
        }
      } catch (e) {
        console.warn('Network IP lookup:', e);
      }
    }
    resolveNetworkIp();
  }, []);

  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Handle connection state screen transitions
  useEffect(() => {
    if (connectionStatus === 'connected') {
      setAppState('chat');
    } else if (connectionStatus === 'disconnected' && appState === 'chat') {
      // Only kick back to home if we are in a P2P session (meaning manual mode is active or remoteUserName is set to a real user name)
      if (isManualMode || (remoteUserName && remoteUserName !== 'Peer')) {
        setRemoteUserName('Peer');
        setAppState('home');
      }
    }
  }, [connectionStatus, appState, remoteUserName, isManualMode]);


  // Handle clipboard copy helper
  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    if (Platform.OS === 'web') {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
        setCopiedText(label);
        setTimeout(() => setCopiedText(null), 2000);
        return;
      }
    }
    try {
      Clipboard.setString(text);
      setCopiedText(label);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (err) {
      alert('Could not copy automatically. Please select text manually.');
    }
  };

  const [isConnecting, setIsConnecting] = useState(false);

  const probeServer = (url: string, timeout = 400): Promise<boolean> => {
    return new Promise((resolve) => {
      let resolved = false;
      let timer: any = null;
      let ws: WebSocket | null = null;

      const finish = (result: boolean) => {
        if (!resolved) {
          resolved = true;
          if (timer) clearTimeout(timer);
          if (ws) {
            ws.onopen = null;
            ws.onerror = null;
            ws.onclose = null;
            try { ws.close(); } catch (e) {}
            ws = null;
          }
          resolve(result);
        }
      };

      try {
        ws = new WebSocket(url);
        timer = setTimeout(() => finish(false), timeout);
        ws.onopen = () => finish(true);
        ws.onerror = () => finish(false);
      } catch (err) {
        finish(false);
      }
    });
  };

  const handleSmartConnect = async () => {
    if (!userName.trim()) {
      alert('Please enter a display name first.');
      return;
    }
    setIsConnecting(true);

    try {
      // Prioritize candidate server addresses:
      // 1. Explicit user input if customized
      // 2. Android Hotspot gateway default (192.168.43.1)
      // 3. Local machine loopback (127.0.0.1)
      // 4. Detected device subnet IP
      const targetsToTry = [
        getWebSocketUrl(serverIpInput),
        'ws://192.168.43.1:5000',
        'ws://127.0.0.1:5000',
        getWebSocketUrl(deviceIp || DEFAULT_IP),
      ];

      const uniqueTargets = Array.from(new Set(targetsToTry.filter(Boolean)));
      let connectedUrl: string | null = null;

      for (const targetUrl of uniqueTargets) {
        console.log('[SmartConnect] Probing:', targetUrl);
        const reachable = await probeServer(targetUrl, 350);
        if (reachable) {
          console.log('[SmartConnect] Found active host at:', targetUrl);
          connectedUrl = targetUrl;
          break;
        }
      }

      if (connectedUrl) {
        console.log('[SmartConnect] Joining existing network host:', connectedUrl);
        connectSignaling(connectedUrl, targetRoom);
      } else {
        console.log('[SmartConnect] No active host on network. Auto-starting Embedded Host Server...');
        await startHostMode(5000, targetRoom);
      }

      setAppState('home');
    } catch (err) {
      console.error('[SmartConnect] Error:', err);
      setAppState('home');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleJoinNetwork = handleSmartConnect;

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) {
      alert('Please enter a group name.');
      return;
    }
    const cleanGroupName = newGroupName.trim().replace(/\s+/g, '_');
    setTargetRoom(cleanGroupName);
    setIsCreateGroupModalVisible(false);
    
    // Connect to the room and directly enter Chat
    const url = getWebSocketUrl(serverIpInput);
    connectSignaling(url, cleanGroupName);
    setAppState('chat');
    setNewGroupName('');
  };

  const handleJoinRoom = (roomName: string) => {
    setTargetRoom(roomName);
    const url = getWebSocketUrl(serverIpInput);
    connectSignaling(url, roomName);
    setAppState('chat');
  };

  const handleSend = () => {
    if (!inputMessage.trim()) return;
    sendMessage(inputMessage);
    setInputMessage('');
  };

  const startVideoCall = () => {
    initiateCall('video');
  };

  const startAudioCall = () => {
    initiateCall('audio');
  };

  const handleAcceptCall = async () => {
    setAppState('chat');
    await acceptIncomingCall();
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return '#00E676';
      case 'connecting':
        return '#FFD600';
      case 'failed':
        return '#FF1744';
      default:
        return '#9E9E9E';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        {/* LOGIN SCREEN */}
        {appState === 'login' && (
          <View style={styles.loginContainer}>
            <View style={styles.loginCard}>
              <TouchableOpacity 
                style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}
                onPress={() => setShowSettings(!showSettings)}
                activeOpacity={0.7}
              >
                <Ionicons name={showSettings ? "close" : "settings-outline"} size={20} color="#8A8D93" />
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                <Text style={styles.loginTitle}>Roto</Text>
                <Ionicons name="wifi" size={26} color="#6C5CE7" />
              </View>
              <Text style={styles.loginSubtitle}>Realtime Offline P2P Messenger</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Enter Your Display Name</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Rahul, Amit..."
                  placeholderTextColor="#757575"
                  value={userName}
                  onChangeText={setUserName}
                  maxLength={20}
                  autoCorrect={false}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.button,
                  styles.connectButton,
                  isConnecting && { opacity: 0.8 },
                ]}
                onPress={handleSmartConnect}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.buttonText}>Connecting...</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <Ionicons name="enter-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.buttonText}>Enter Chat</Text>
                  </View>
                )}
              </TouchableOpacity>

              {showSettings && (
                <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#2A2A38', width: '100%' }}>
                  <Text style={{ color: '#8A8D93', fontSize: 11 }}>
                    Target Room: {targetRoom} | Peer ID: {peerId}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* HOME / DISCOVERY SCREEN (WHATSAPP STYLE) */}
        {appState === 'home' && (
          <View style={styles.whatsappHomeContainer}>
            {/* TOP HEADER */}
            <View style={styles.whatsappMainHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.whatsappMainTitle}>Roto</Text>
                  {isHostMode ? (
                    <View style={styles.hostBadgePill}>
                      <Text style={styles.hostBadgeText}>👑 HOST</Text>
                    </View>
                  ) : (
                    <View style={styles.meshBadgePill}>
                      <Text style={styles.meshBadgeText}>MESH</Text>
                    </View>
                  )}
                </View>
                <View style={styles.meshStatusRow}>
                  <View style={[styles.networkDot, { 
                    backgroundColor: signalingStatus === 'connected' ? '#00E676' : signalingStatus === 'connecting' ? '#FFD600' : '#FF5252' 
                  }]} />
                  <Text style={styles.networkSubtext}>
                    {signalingStatus === 'connected' 
                      ? (isHostMode ? 'Hosting WiFi Mesh (Port 5000)' : 'Connected to WiFi Mesh')
                      : signalingStatus === 'connecting'
                      ? 'Searching WiFi Mesh...'
                      : 'Mesh Offline'}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.userProfilePill}>
                  <View style={styles.userProfileAvatar}>
                    <Text style={styles.userProfileAvatarText}>
                      {userName ? userName.charAt(0).toUpperCase() : 'U'}
                    </Text>
                  </View>
                  <Text style={styles.userProfileName} numberOfLines={1}>{userName}</Text>
                </View>

                <TouchableOpacity 
                  style={styles.exitButton}
                  onPress={() => {
                    if (isHostMode) {
                      stopHostMode();
                    } else {
                      resetAll();
                    }
                    setAppState('login');
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="log-out-outline" size={18} color="#FF5252" />
                </TouchableOpacity>
              </View>
            </View>

            {!isManualMode ? (
              <>
                {/* WHATSAPP TABS: CHATS vs GROUPS */}
                <View style={styles.whatsappTabBar}>
                  <TouchableOpacity
                    style={[styles.whatsappTab, activeHomeTab === 'chats' && styles.whatsappTabActive]}
                    onPress={() => setActiveHomeTab('chats')}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons 
                        name="chatbubble-ellipses" 
                        size={17} 
                        color={activeHomeTab === 'chats' ? '#00A884' : '#8A8D93'} 
                      />
                      <Text style={[styles.whatsappTabText, activeHomeTab === 'chats' && styles.whatsappTabTextActive]}>
                        Direct Chats
                      </Text>
                      {discoveredUsers.length > 0 && (
                        <View style={styles.tabBadge}>
                          <Text style={styles.tabBadgeText}>{discoveredUsers.length}</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.whatsappTab, activeHomeTab === 'groups' && styles.whatsappTabActive]}
                    onPress={() => setActiveHomeTab('groups')}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons 
                        name="people" 
                        size={18} 
                        color={activeHomeTab === 'groups' ? '#00A884' : '#8A8D93'} 
                      />
                      <Text style={[styles.whatsappTabText, activeHomeTab === 'groups' && styles.whatsappTabTextActive]}>
                        Groups
                      </Text>
                      {activeRooms.filter(r => r.id !== 'lobby').length > 0 && (
                        <View style={styles.tabBadge}>
                          <Text style={styles.tabBadgeText}>
                            {activeRooms.filter(r => r.id !== 'lobby').length}
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>

                {/* CONNECTION WARNING IF DISCONNECTED */}
                {(signalingStatus === 'error' || signalingStatus === 'disconnected') && (
                  <View style={styles.warningBanner}>
                    <Ionicons name="warning" size={16} color="#FFD600" />
                    <Text style={styles.warningBannerText}>
                      Not connected to WiFi signaling host.
                    </Text>
                    <TouchableOpacity style={styles.retryPill} onPress={handleJoinNetwork}>
                      <Text style={styles.retryPillText}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* TAB CONTENT: CHATS */}
                {activeHomeTab === 'chats' && (
                  <ScrollView 
                    style={{ flex: 1 }} 
                    contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
                    keyboardShouldPersistTaps="handled"
                  >
                    {signalingStatus === 'connecting' ? (
                      <View style={styles.emptyHomeContainer}>
                        <ActivityIndicator size="large" color="#00A884" style={{ marginBottom: 16 }} />
                        <Text style={styles.emptyHomeTitle}>Searching WiFi Network...</Text>
                        <Text style={styles.emptyHomeSubtitle}>
                          Locating active peers and mesh hosts on your local network
                        </Text>
                      </View>
                    ) : discoveredUsers.length === 0 ? (
                      <RadarScanner
                        onScan={handleJoinNetwork}
                        isScanning={isConnecting}
                      />
                    ) : (
                      <View style={{ gap: 8 }}>
                        <Text style={styles.sectionHeaderLabel}>
                          NEARBY USERS ON WIFI ({discoveredUsers.length})
                        </Text>
                        {discoveredUsers.map((user) => (
                          <TouchableOpacity
                            key={user.peerId}
                            style={styles.whatsappContactRow}
                            onPress={() => connectToPeer(user.peerId, user.userName)}
                            activeOpacity={0.75}
                          >
                            <View style={styles.contactAvatarWrapper}>
                              <View style={styles.contactAvatar}>
                                <Text style={styles.contactInitial}>
                                  {user.userName ? user.userName.charAt(0).toUpperCase() : 'P'}
                                </Text>
                              </View>
                              <View style={styles.contactOnlineDot} />
                            </View>

                            <View style={styles.contactInfo}>
                              <Text style={styles.contactName}>{user.userName}</Text>
                              <Text style={styles.contactSubtitle}>
                                Tap to start direct P2P chat & call
                              </Text>
                            </View>

                            <View style={styles.chatActionBtn}>
                              <Ionicons name="chatbox" size={14} color="#FFFFFF" />
                              <Text style={styles.chatActionBtnText}>Chat</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </ScrollView>
                )}

                {/* TAB CONTENT: GROUPS */}
                {activeHomeTab === 'groups' && (
                  <ScrollView 
                    style={{ flex: 1 }} 
                    contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
                    keyboardShouldPersistTaps="handled"
                  >
                    {activeRooms.filter(room => room.id !== 'lobby').length === 0 ? (
                      <View style={styles.emptyHomeContainer}>
                        <View style={[styles.radarPulseCircle, { backgroundColor: '#1F2C34' }]}>
                          <Ionicons name="chatbubbles" size={38} color="#00A884" />
                        </View>
                        <Text style={styles.emptyHomeTitle}>No Active WiFi Groups</Text>
                        <Text style={styles.emptyHomeSubtitle}>
                          Create a group room to chat and collaborate with everyone connected to this WiFi network.
                        </Text>
                        <TouchableOpacity
                          style={styles.createGroupPrimaryBtn}
                          onPress={() => setIsCreateGroupModalVisible(true)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="add" size={18} color="#FFFFFF" />
                          <Text style={styles.createGroupPrimaryBtnText}>Create New Group</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={{ gap: 8 }}>
                        <Text style={styles.sectionHeaderLabel}>
                          ACTIVE WIFI GROUPS ({activeRooms.filter(room => room.id !== 'lobby').length})
                        </Text>
                        {activeRooms.filter(room => room.id !== 'lobby').map((room) => {
                          const isCurrentActive = targetRoom === room.id;
                          return (
                            <TouchableOpacity
                              key={room.id}
                              style={[styles.whatsappGroupRow, isCurrentActive && styles.whatsappGroupRowActive]}
                              onPress={() => {
                                if (isCurrentActive) {
                                  setAppState('chat');
                                } else {
                                  handleJoinRoom(room.id);
                                }
                              }}
                              activeOpacity={0.75}
                            >
                              <View style={styles.groupAvatar}>
                                <Ionicons name="people" size={20} color="#FFFFFF" />
                              </View>

                              <View style={styles.contactInfo}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Text style={styles.contactName}>{room.name.replace(/_/g, ' ')}</Text>
                                  {isCurrentActive && (
                                    <View style={styles.activeRoomBadge}>
                                      <Text style={styles.activeRoomBadgeText}>Joined</Text>
                                    </View>
                                  )}
                                </View>
                                <Text style={styles.contactSubtitle}>
                                  {room.usersCount} {room.usersCount === 1 ? 'member' : 'members'} online
                                </Text>
                              </View>

                              <Ionicons name="chevron-forward" size={18} color="#8A8D93" />
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </ScrollView>
                )}

                {/* WHATSAPP FLOATING ACTION BUTTON (FAB) */}
                <TouchableOpacity
                  style={styles.whatsappFab}
                  onPress={() => setIsCreateGroupModalVisible(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add" size={26} color="#FFFFFF" />
                </TouchableOpacity>
              </>
            ) : (
              <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <View style={styles.card}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Text style={[styles.cardTitle, { marginBottom: 0 }]}>100% Offline Manual Mode</Text>
                    <TouchableOpacity 
                      style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, backgroundColor: '#2A2A38' }} 
                      onPress={() => {
                        setIsManualMode(false);
                        resetAll();
                        setAppState('login');
                      }}
                    >
                      <Text style={{ color: '#00A884', fontSize: 12, fontWeight: '600' }}>WiFi Mode</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={{ color: '#8A8D93', fontSize: 13, marginBottom: 16, lineHeight: 18 }}>
                    Exchange WebRTC configuration keys manually with another peer to establish a secure connection without any server.
                  </Text>

                  <View style={[styles.sectionBorder, { marginBottom: 16, paddingBottom: 16 }]}>
                    <Text style={styles.sectionTitle}>Step A: Peer 1 (Create Offer)</Text>
                    <TouchableOpacity style={[styles.button, styles.actionButton, { marginTop: 8 }]} onPress={createManualOffer}>
                      <Text style={styles.buttonText}>1. Create Offer Code</Text>
                    </TouchableOpacity>

                    {gatheringIce && (
                      <View style={styles.gatheringContainer}>
                        <ActivityIndicator size="small" color="#00A884" />
                        <Text style={styles.gatheringText}>Gathering ICE Candidates...</Text>
                      </View>
                    )}

                    {generatedOffer !== '' && (
                      <View style={styles.outputContainer}>
                        <Text style={styles.outputLabel}>Copy & send this code to Peer 2:</Text>
                        <TextInput
                          style={styles.codeTextarea}
                          multiline
                          editable={false}
                          value={generatedOffer}
                        />
                        <TouchableOpacity
                          style={styles.copyButton}
                          onPress={() => handleCopy(generatedOffer, 'offer')}
                        >
                          <Text style={styles.copyButtonText}>
                            {copiedText === 'offer' ? 'Copied! ✓' : 'Copy Code'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  <View style={[styles.sectionBorder, { marginBottom: 16, paddingBottom: 16 }]}>
                    <Text style={styles.sectionTitle}>Step B: Peer 2 (Accept Offer & Answer)</Text>
                    <Text style={[styles.inputLabel, { marginTop: 8 }]}>Paste Peer 1's Offer Code:</Text>
                    <TextInput
                      style={styles.textareaInput}
                      multiline
                      placeholder="Paste JSON offer here..."
                      placeholderTextColor="#757575"
                      value={manualOfferInput}
                      onChangeText={setManualOfferInput}
                    />
                    <TouchableOpacity
                      style={[styles.button, styles.actionButton, { marginTop: 8 }]}
                      onPress={() => acceptManualOfferAndGenerateAnswer(manualOfferInput)}
                    >
                      <Text style={styles.buttonText}>2. Generate Answer Code</Text>
                    </TouchableOpacity>

                    {generatedAnswer !== '' && (
                      <View style={styles.outputContainer}>
                        <Text style={styles.outputLabel}>Copy & send this answer back to Peer 1:</Text>
                        <TextInput
                          style={styles.codeTextarea}
                          multiline
                          editable={false}
                          value={generatedAnswer}
                        />
                        <TouchableOpacity
                          style={styles.copyButton}
                          onPress={() => handleCopy(generatedAnswer, 'answer')}
                        >
                          <Text style={styles.copyButtonText}>
                            {copiedText === 'answer' ? 'Copied! ✓' : 'Copy Code'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  <View style={[styles.sectionBorder, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                    <Text style={styles.sectionTitle}>Step C: Peer 1 (Apply Answer)</Text>
                    <Text style={[styles.inputLabel, { marginTop: 8 }]}>Paste Peer 2's Answer Code:</Text>
                    <TextInput
                      style={styles.textareaInput}
                      multiline
                      placeholder="Paste JSON answer here..."
                      placeholderTextColor="#757575"
                      value={manualAnswerInput}
                      onChangeText={setManualAnswerInput}
                    />
                    <TouchableOpacity
                      style={[styles.button, styles.connectButton, { marginTop: 8 }]}
                      onPress={() => acceptManualAnswer(manualAnswerInput)}
                    >
                      <Text style={styles.buttonText}>3. Connect Peers</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        )}

        {/* CHAT / ROOM SCREEN */}
        {appState === 'chat' && (
          <View style={styles.whatsappChatContainer}>
            {/* WHATSAPP HEADER */}
            <View style={styles.whatsappHeader}>
              <View style={styles.whatsappHeaderLeft}>
                <TouchableOpacity
                  style={styles.whatsappBackBtn}
                  onPress={() => {
                    cleanupPeerConnection();
                    setRemoteUserName('Peer');
                    if (roomId !== 'lobby' && !isManualMode) {
                      const url = getWebSocketUrl(serverIpInput);
                      connectSignaling(url, 'lobby');
                      setTargetRoom('lobby');
                    }
                    setAppState('home');
                  }}
                >
                  <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={styles.whatsappAvatar}>
                  <Ionicons name={roomId === 'lobby' || isManualMode ? "person" : "people"} size={18} color="#FFFFFF" />
                </View>
                <View style={{ marginLeft: 8, flex: 1, marginRight: 8 }}>
                  <Text style={styles.whatsappHeaderName} numberOfLines={1} ellipsizeMode="tail">
                    {roomId === 'lobby' || isManualMode 
                      ? remoteUserName 
                      : roomId.replace(/_/g, ' ')
                    }
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {roomId === 'lobby' || isManualMode ? (
                      <>
                        <View style={[styles.statusDot, { width: 6, height: 6, backgroundColor: getStatusColor(connectionStatus) }]} />
                        <Text style={styles.whatsappHeaderStatus} numberOfLines={1} ellipsizeMode="tail">
                          {connectionStatus === 'connected' ? 'online' : connectionStatus}
                        </Text>
                      </>
                    ) : (
                      <>
                        <View style={[styles.statusDot, { width: 6, height: 6, backgroundColor: '#00E676' }]} />
                        <Text style={[styles.whatsappHeaderStatus, { flex: 1 }]} numberOfLines={1} ellipsizeMode="tail">
                          {(() => {
                            const groupMembers = discoveredUsers.filter(u => {
                              const match = u.room && roomId && u.room.trim().toLowerCase() === roomId.trim().toLowerCase();
                              console.log('[UI HEADER] Comparing user room:', u.userName, `(${u.room})`, 'with current roomId:', roomId, 'Match:', match);
                              return match;
                            });
                            return ['You', ...groupMembers.map(u => u.userName)].join(', ');
                          })()}
                        </Text>
                      </>
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.whatsappHeaderRight}>
                <TouchableOpacity 
                  style={styles.whatsappHeaderIconBtn} 
                  onPress={startAudioCall}
                  disabled={isCallActive}
                >
                  <Ionicons name="call" size={20} color={isCallActive ? '#555555' : '#00A884'} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.whatsappHeaderIconBtn} 
                  onPress={startVideoCall}
                  disabled={isCallActive}
                >
                  <Ionicons name="videocam" size={22} color={isCallActive ? '#555555' : '#00A884'} />
                </TouchableOpacity>
              </View> 
            </View>

            {/* CALL OVERLAY (Floating PiP Video or Voice Banner) */}
            {isCallActive && remoteStream ? (
              <View style={styles.floatingVideoContainer}>
                <WebRTCVideo
                  stream={remoteStream}
                  style={styles.floatingRemoteVideo}
                />
                {localStream && (
                  <View style={styles.floatingLocalVideoWrapper}>
                    <WebRTCVideo
                      stream={localStream}
                      style={styles.floatingLocalVideo}
                      isMuted={true}
                    />
                  </View>
                )}
                <View style={styles.floatingVideoControls}>
                  <TouchableOpacity style={styles.miniCallCtrlBtn} onPress={toggleAudio}>
                    <Ionicons name={isAudioMuted ? 'mic-off' : 'mic'} size={12} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.miniCallCtrlBtn} onPress={toggleVideo}>
                    <Ionicons name={isVideoMuted ? 'videocam-off' : 'videocam'} size={12} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.miniCallCtrlBtn, { backgroundColor: '#FF1744' }]} onPress={stopMedia}>
                    <Ionicons name="close" size={12} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              (isCallActive || localStream) && (
                <View style={styles.voiceCallBanner}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="call" size={16} color="#00A884" />
                    <Text style={styles.voiceCallText}>Voice call active...</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={styles.voiceCallBtn} onPress={toggleAudio}>
                      <Ionicons name={isAudioMuted ? 'mic-off' : 'mic'} size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.voiceCallBtn, { backgroundColor: '#FF1744' }]} onPress={stopMedia}>
                      <Ionicons name="close" size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              )
            )}

            {/* MESSAGES LIST */}
            <ScrollView
              ref={scrollViewRef}
              style={styles.whatsappChatBody}
              contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
            >
              {messages.length === 0 ? (
                <View style={styles.emptyChatContainer}>
                  <Text style={styles.emptyChatText}>
                    No messages yet. Send a chat message below!
                  </Text>
                </View>
              ) : (
                messages.map((msg) => (
                  <View
                    key={msg.id}
                    style={[
                      styles.messageBubble,
                      msg.sender === 'me' ? styles.myBubble : styles.theirBubble,
                    ]}
                  >
                    {msg.sender === 'them' && (
                      <Text style={[styles.senderNameLabel, styles.theirSenderName]}>
                        {msg.senderName}
                      </Text>
                    )}
                    <Text
                      style={[
                        styles.messageTextText,
                        msg.sender === 'me' ? styles.myMessageText : styles.theirMessageText,
                      ]}
                    >
                      {msg.text}
                    </Text>
                    <Text style={styles.messageTime}>
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>

            {/* TYPING INPUT BAR */}
            <View style={styles.whatsappInputRow}>
              <TextInput
                style={styles.whatsappChatInput}
                placeholder="Type a message..."
                placeholderTextColor="#8A8D93"
                value={inputMessage}
                onChangeText={setInputMessage}
                onSubmitEditing={handleSend}
              />
              <TouchableOpacity
                style={styles.whatsappSendButton}
                onPress={handleSend}
              >
                <Ionicons name="send" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}
        <Modal
          visible={isCreateGroupModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsCreateGroupModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Create WiFi Group</Text>
              <Text style={styles.modalDescription}>
                Enter a name for the new chat group. Anyone on the same WiFi can see and join it.
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Friends_Chat, Gaming..."
                placeholderTextColor="#8A8D93"
                value={newGroupName}
                onChangeText={setNewGroupName}
                autoFocus={true}
                maxLength={25}
                autoCorrect={false}
              />
              <View style={styles.modalButtonRow}>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: '#2A2A38' }]}
                  onPress={() => {
                    setIsCreateGroupModalVisible(false);
                    setNewGroupName('');
                  }}
                >
                  <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: '#6C5CE7' }]}
                  onPress={handleCreateGroup}
                >
                  <Text style={styles.buttonText}>Create Group</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* INCOMING CALL MODAL (ACCEPT / DECLINE) */}
        <IncomingCallModal
          visible={!!incomingCall}
          callData={incomingCall}
          onAccept={handleAcceptCall}
          onReject={rejectIncomingCall}
        />

        {/* OUTGOING CALL MODAL (RINGING / CANCEL) */}
        <OutgoingCallModal
          visible={!!outgoingCall}
          callData={outgoingCall}
          onCancel={cancelOutgoingCall}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F12',
  },
  smartBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#00E67615',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#00E67633',
    marginBottom: 16,
  },
  smartBadgeText: {
    color: '#00E676',
    fontSize: 12,
    fontWeight: '600',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A22',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F0F12',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#8A8D93',
    marginTop: 2,
  },
  myIdBadge: {
    backgroundColor: '#1E1E26',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2A38',
  },
  myIdLabel: {
    fontSize: 10,
    color: '#8A8D93',
  },
  myIdValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6C5CE7',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  statusContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  statusCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151518',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E1E26',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 9,
    color: '#8A8D93',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  statusValue: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginTop: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#151518',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#1E1E26',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTabButton: {
    backgroundColor: '#6C5CE7',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8A8D93',
  },
  activeTabButtonText: {
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: '#151518',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E1E26',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  cardInfo: {
    fontSize: 12,
    color: '#8A8D93',
    lineHeight: 18,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A8D93',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#0F0F12',
    borderWidth: 1,
    borderColor: '#2A2A38',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
  },
  textareaInput: {
    backgroundColor: '#0F0F12',
    borderWidth: 1,
    borderColor: '#2A2A38',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 12,
    height: 80,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  buttonRow: {
    marginTop: 6,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  connectButton: {
    backgroundColor: '#6C5CE7',
  },
  disconnectButton: {
    backgroundColor: '#FF1744',
  },
  actionButton: {
    backgroundColor: '#2A2A38',
    borderWidth: 1,
    borderColor: '#3E3E52',
    marginBottom: 10,
  },
  mediaButton: {
    backgroundColor: '#00E676',
    flex: 1,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  sectionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A38',
    paddingBottom: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6C5CE7',
    marginBottom: 10,
  },
  gatheringContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1E1E26',
    padding: 10,
    borderRadius: 8,
    marginVertical: 10,
  },
  gatheringText: {
    color: '#8A8D93',
    fontSize: 12,
  },
  outputContainer: {
    backgroundColor: '#0F0F12',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2A38',
  },
  outputLabel: {
    fontSize: 12,
    color: '#00E676',
    fontWeight: '600',
    marginBottom: 6,
  },
  codeTextarea: {
    color: '#8A8D93',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    height: 70,
    textAlignVertical: 'top',
  },
  copyButton: {
    backgroundColor: '#6C5CE7',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  copyButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  arrowIcon: {
    color: '#8A8D93',
    fontSize: 12,
  },
  settingsBody: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2A2A38',
    paddingTop: 12,
  },
  videoContainer: {
    flexDirection: 'row',
    height: 180,
    gap: 10,
    marginBottom: 14,
  },
  remoteVideoWrapper: {
    flex: 1,
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0F0F12',
  },
  noVideoFeed: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A38',
  },
  noVideoText: {
    color: '#757575',
    fontSize: 12,
  },
  localVideoWrapper: {
    width: 100,
    height: 140,
    position: 'absolute',
    bottom: 8,
    right: 8,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#6C5CE7',
    backgroundColor: '#0F0F12',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  remoteVideo: {
    width: '100%',
    height: '100%',
  },
  localVideo: {
    width: '100%',
    height: '100%',
  },
  videoLabel: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(15, 15, 18, 0.75)',
    color: '#FFFFFF',
    fontSize: 9,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    overflow: 'hidden',
  },
  callControlsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  controlActive: {
    backgroundColor: '#FF1744',
    flex: 1,
  },
  controlInactive: {
    backgroundColor: '#2A2A38',
    borderWidth: 1,
    borderColor: '#3E3E52',
    flex: 1,
  },
  chatCard: {
    flex: 1,
    minHeight: 350,
  },
  chatScroll: {
    flex: 1,
    backgroundColor: '#0F0F12',
    borderRadius: 12,
    marginVertical: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1A1A22',
  },
  chatContent: {
    flexGrow: 1,
    gap: 10,
    paddingBottom: 10,
  },
  emptyChatContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyChatText: {
    color: '#53565D',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  myBubble: {
    backgroundColor: '#005C4B',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 2,
    marginBottom: 8,
  },
  theirBubble: {
    backgroundColor: '#202C33',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 2,
    marginBottom: 8,
  },
  messageTextText: {
    fontSize: 14,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  theirMessageText: {
    color: '#E1E2E6',
  },
  messageTime: {
    fontSize: 8,
    color: 'rgba(255, 255, 255, 0.5)',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  chatInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#0F0F12',
    borderWidth: 1,
    borderColor: '#2A2A38',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: '#6C5CE7',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#1E1E26',
    borderWidth: 1,
    borderColor: '#2A2A38',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  senderNameLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  mySenderName: {
    color: 'rgba(255, 255, 255, 0.75)',
    textAlign: 'right',
  },
  theirSenderName: {
    color: '#00A884',
    textAlign: 'left',
  },
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#0F0F12',
  },
  loginCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#15151D',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2A2A38',
  },
  loginTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  loginSubtitle: {
    fontSize: 14,
    color: '#8A8D93',
    textAlign: 'center',
    marginBottom: 24,
  },
  advancedToggle: {
    marginTop: 16,
    alignItems: 'center',
  },
  advancedToggleText: {
    color: '#6C5CE7',
    fontSize: 13,
    fontWeight: '500',
  },
  manualModeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2A2A38',
  },
  manualModeLabel: {
    color: '#E1E2E6',
    fontSize: 13,
  },
  homeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A22',
  },
  homeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  homeSubtitle: {
    fontSize: 12,
    color: '#8A8D93',
  },
  myProfileBadge: {
    alignItems: 'flex-end',
    backgroundColor: '#1E1E26',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2A38',
  },
  profileLabel: {
    fontSize: 9,
    color: '#8A8D93',
  },
  profileName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  peersList: {
    gap: 12,
    marginTop: 8,
  },
  peerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#15151D',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A38',
  },
  peerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  peerAvatar: {
    fontSize: 20,
  },
  peerName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  peerIdText: {
    fontSize: 11,
    color: '#8A8D93',
  },
  peerConnectButton: {
    backgroundColor: '#6C5CE7',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  peerConnectButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  emptyPeersContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyPeersIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyPeersText: {
    fontSize: 14,
    color: '#E1E2E6',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 16,
  },
  inviteText: {
    fontSize: 12,
    color: '#8A8D93',
    textAlign: 'center',
    marginBottom: 4,
  },
  inviteUrl: {
    fontSize: 12,
    color: '#6C5CE7',
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: '#1E1E26',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2A2A38',
  },
  manualHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  backToNormalButton: {
    backgroundColor: '#2A2A38',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  backToNormalText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  whatsappChatContainer: {
    flex: 1,
    backgroundColor: '#0B141A',
  },
  whatsappHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#1F2C34',
    borderBottomWidth: 1,
    borderBottomColor: '#2F3B43',
  },
  whatsappHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  whatsappBackBtn: {
    padding: 4,
    marginRight: 4,
  },
  whatsappAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6C5CE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  whatsappHeaderName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  whatsappHeaderStatus: {
    fontSize: 11,
    color: '#8696A0',
  },
  whatsappHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  whatsappHeaderIconBtn: {
    padding: 8,
  },
  floatingVideoContainer: {
    position: 'absolute',
    top: 76,
    right: 16,
    width: 110,
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1F2C34',
    borderWidth: 1.5,
    borderColor: '#00A884',
    zIndex: 100,
    elevation: 5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  floatingRemoteVideo: {
    width: '100%',
    height: '100%',
  },
  floatingLocalVideoWrapper: {
    position: 'absolute',
    bottom: 32,
    right: 6,
    width: 36,
    height: 48,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  floatingLocalVideo: {
    width: '100%',
    height: '100%',
  },
  floatingVideoControls: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: 28,
    backgroundColor: 'rgba(15, 20, 25, 0.85)',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  miniCallCtrlBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#2A3942',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceCallBanner: {
    position: 'absolute',
    top: 76,
    left: 16,
    right: 16,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#1F2C34',
    borderWidth: 1,
    borderColor: '#2F3B43',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    zIndex: 100,
    elevation: 4,
  },
  voiceCallText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  voiceCallBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#2A3942',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsappChatBody: {
    flex: 1,
  },
  whatsappInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#1F2C34',
    borderTopWidth: 1,
    borderTopColor: '#2F3B43',
  },
  whatsappChatInput: {
    flex: 1,
    height: 38,
    backgroundColor: '#2A3942',
    borderRadius: 19,
    paddingHorizontal: 16,
    color: '#FFFFFF',
    fontSize: 14,
    marginRight: 8,
  },
  whatsappSendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#00A884',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    backgroundColor: 'rgba(255, 23, 68, 0.15)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF1744',
    marginBottom: 12,
  },
  errorBannerText: {
    color: '#FF1744',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#8A8D93',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#1E1E26',
    borderRadius: 14,
    padding: 20,
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: '#2A2A38',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 12,
    color: '#8A8D93',
    lineHeight: 16,
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#15151D',
    borderWidth: 1,
    borderColor: '#2A2A38',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 20,
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  whatsappHomeContainer: {
    flex: 1,
    backgroundColor: '#0B141A',
  },
  whatsappMainHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#1F2C34',
    borderBottomWidth: 1,
    borderBottomColor: '#2A3942',
  },
  whatsappMainTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#E9EDEF',
    letterSpacing: 0.5,
  },
  hostBadgePill: {
    backgroundColor: '#00A88422',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#00A88466',
  },
  hostBadgeText: {
    color: '#00E676',
    fontSize: 10,
    fontWeight: 'bold',
  },
  meshBadgePill: {
    backgroundColor: '#2A3942',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  meshBadgeText: {
    color: '#8696A0',
    fontSize: 10,
    fontWeight: '700',
  },
  meshStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  networkDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  networkSubtext: {
    color: '#8696A0',
    fontSize: 11,
  },
  userProfilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111B21',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A3942',
    gap: 8,
    maxWidth: 140,
  },
  userProfileAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#00A884',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userProfileAvatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  userProfileName: {
    color: '#E9EDEF',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  exitButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FF174418',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FF174433',
  },
  whatsappTabBar: {
    flexDirection: 'row',
    backgroundColor: '#1F2C34',
    borderBottomWidth: 1,
    borderBottomColor: '#2A3942',
  },
  whatsappTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  whatsappTabActive: {
    borderBottomColor: '#00A884',
  },
  whatsappTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8696A0',
  },
  whatsappTabTextActive: {
    color: '#00A884',
    fontWeight: 'bold',
  },
  tabBadge: {
    backgroundColor: '#00A884',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 18,
    alignItems: 'center',
  },
  tabBadgeText: {
    color: '#111B21',
    fontSize: 10,
    fontWeight: 'bold',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2000',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#FFD60033',
    gap: 8,
  },
  warningBannerText: {
    color: '#FFD600',
    fontSize: 12,
    flex: 1,
  },
  retryPill: {
    backgroundColor: '#FFD600',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  retryPillText: {
    color: '#111B21',
    fontSize: 11,
    fontWeight: 'bold',
  },
  emptyHomeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 30,
  },
  radarPulseCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#00A88415',
    borderWidth: 1.5,
    borderColor: '#00A88440',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyHomeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E9EDEF',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyHomeSubtitle: {
    fontSize: 13,
    color: '#8696A0',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
  },
  refreshNearbyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1F2C34',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00A88444',
  },
  refreshNearbyBtnText: {
    color: '#00A884',
    fontSize: 13,
    fontWeight: '600',
  },
  createGroupPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#00A884',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  createGroupPrimaryBtnText: {
    color: '#111B21',
    fontSize: 14,
    fontWeight: 'bold',
  },
  sectionHeaderLabel: {
    color: '#8696A0',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  whatsappContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111B21',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1F2C34',
    marginBottom: 4,
  },
  contactAvatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1F2C34',
    borderWidth: 1.5,
    borderColor: '#00A884',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInitial: {
    color: '#00A884',
    fontSize: 18,
    fontWeight: 'bold',
  },
  contactOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00E676',
    borderWidth: 2,
    borderColor: '#111B21',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#E9EDEF',
    marginBottom: 2,
  },
  contactSubtitle: {
    fontSize: 12,
    color: '#8696A0',
  },
  chatActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#00A884',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  chatActionBtnText: {
    color: '#111B21',
    fontSize: 12,
    fontWeight: 'bold',
  },
  whatsappGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111B21',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1F2C34',
    marginBottom: 4,
  },
  whatsappGroupRowActive: {
    borderColor: '#00A884',
    backgroundColor: '#0B201A',
  },
  groupAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#128C7E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activeRoomBadge: {
    backgroundColor: '#00A884',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeRoomBadgeText: {
    color: '#111B21',
    fontSize: 9,
    fontWeight: 'bold',
  },
  whatsappFab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#00A884',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
  },
});

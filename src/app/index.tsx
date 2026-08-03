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
import Constants from 'expo-constants';
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
  } = useWebRTCChat();

  const [appState, setAppState] = useState<'login' | 'home' | 'chat'>('login');
  const [inputMessage, setInputMessage] = useState('');
  const [isCreateGroupModalVisible, setIsCreateGroupModalVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [targetRoom, setTargetRoom] = useState('lobby');
  const [serverIpInput, setServerIpInput] = useState(DEFAULT_IP);
  const [showSettings, setShowSettings] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

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

  const handleJoinNetwork = () => {
    if (!userName.trim()) {
      alert('Please enter a display name first.');
      return;
    }
    const url = serverIpInput.startsWith('ws://') || serverIpInput.startsWith('wss://')
      ? serverIpInput
      : `ws://${serverIpInput}:5000`;
    connectSignaling(url, targetRoom);
    setAppState('home');
  };

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) {
      alert('Please enter a group name.');
      return;
    }
    const cleanGroupName = newGroupName.trim().replace(/\s+/g, '_');
    setTargetRoom(cleanGroupName);
    setIsCreateGroupModalVisible(false);
    
    // Connect to the room and directly enter Chat
    const url = serverIpInput.startsWith('ws://') || serverIpInput.startsWith('wss://')
      ? serverIpInput
      : `ws://${serverIpInput}:5000`;
    connectSignaling(url, cleanGroupName);
    setAppState('chat');
    setNewGroupName('');
  };

  const handleJoinRoom = (roomName: string) => {
    setTargetRoom(roomName);
    const url = serverIpInput.startsWith('ws://') || serverIpInput.startsWith('wss://')
      ? serverIpInput
      : `ws://${serverIpInput}:5000`;
    connectSignaling(url, roomName);
    setAppState('chat');
  };

  const handleSend = () => {
    if (!inputMessage.trim()) return;
    sendMessage(inputMessage);
    setInputMessage('');
  };

  const startVideoCall = () => {
    startMedia(true, true);
  };

  const startAudioCall = () => {
    startMedia(false, true);
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
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                <Text style={styles.loginTitle}>WifiR</Text>
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
                style={[styles.button, styles.connectButton]} 
                onPress={handleJoinNetwork}
              >
                <Text style={styles.buttonText}>Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* HOME / DISCOVERY SCREEN */}
        {appState === 'home' && (
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.homeHeader}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.homeTitle}>WifiR</Text>
                  <Ionicons name="wifi" size={22} color="#6C5CE7" />
                </View>
                <Text style={styles.homeSubtitle}>Local Network Discovery</Text>
              </View>
              <View style={styles.myProfileBadge}>
                <Text style={styles.profileLabel}>My Name:</Text>
                <Text style={styles.profileName}>{userName}</Text>
              </View>
            </View>

            <View style={styles.statusContainer}>
              <View style={styles.statusCard}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(connectionStatus) }]} />
                <View>
                  <Text style={styles.statusLabel}>P2P Connection</Text>
                  <Text style={styles.statusValue}>{connectionStatus.toUpperCase()}</Text>
                </View>
              </View>

              <View style={styles.statusCard}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(signalingStatus) }]} />
                <View>
                  <Text style={styles.statusLabel}>WiFi Discovery</Text>
                  <Text style={styles.statusValue}>{signalingStatus.toUpperCase()}</Text>
                </View>
              </View>
            </View>

            {!isManualMode ? (
              <View style={{ gap: 16 }}>
                {signalingStatus === 'connecting' && (
                  <View style={styles.card}>
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color="#6C5CE7" />
                      <Text style={styles.loadingText}>Searching WiFi network...</Text>
                    </View>
                  </View>
                )}

                {signalingStatus === 'error' && (
                  <View style={styles.card}>
                    <View style={styles.emptyPeersContainer}>
                      <Ionicons name="alert-circle-outline" size={48} color="#FF1744" style={{ marginBottom: 12 }} />
                      <Text style={[styles.emptyPeersText, { color: '#FF1744' }]}>
                        Connection Failed
                      </Text>
                      <Text style={[styles.inviteText, { marginBottom: 16 }]}>
                        Could not reach the local signaling server. Please verify you are on the same WiFi network.
                      </Text>
                      <TouchableOpacity
                        style={[styles.button, styles.connectButton, { marginBottom: 12 }]}
                        onPress={handleJoinNetwork}
                      >
                        <Text style={styles.buttonText}>Retry Connection</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.button, { backgroundColor: '#1E1E26', borderWidth: 1, borderColor: '#2A2A38', width: '100%' }]}
                        onPress={() => setIsManualMode(true)}
                      >
                        <Text style={[styles.buttonText, { color: '#6C5CE7' }]}>Use Manual Offline Mode</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {signalingStatus === 'connected' && (
                  <>
                    {/* ACTIVE WIFI GROUPS CARD */}
                    <View style={styles.card}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Ionicons name="chatbubbles" size={18} color="#6C5CE7" />
                          <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Active WiFi Groups</Text>
                        </View>
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#2A2A38', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 }}
                          onPress={() => setIsCreateGroupModalVisible(true)}
                        >
                          <Ionicons name="add" size={14} color="#FFFFFF" />
                          <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' }}>Create Group</Text>
                        </TouchableOpacity>
                      </View>

                      {activeRooms.filter(room => room.id !== 'lobby').length === 0 ? (
                        <Text style={{ color: '#8A8D93', fontSize: 12, textAlign: 'center', paddingVertical: 16 }}>
                          No active groups. Create a group to start!
                        </Text>
                      ) : (
                        <View style={{ gap: 4 }}>
                          {activeRooms.filter(room => room.id !== 'lobby').map((room) => (
                            <TouchableOpacity
                              key={room.id}
                              style={{ 
                                flexDirection: 'row', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                backgroundColor: targetRoom === room.id ? '#1A2A20' : '#15151D', 
                                paddingVertical: 12, 
                                paddingHorizontal: 16, 
                                borderRadius: 10, 
                                borderWidth: 1, 
                                borderColor: targetRoom === room.id ? '#00A884' : '#2A2A38',
                              }}
                              onPress={() => {
                                if (targetRoom === room.id) {
                                  setAppState('chat');
                                } else {
                                  handleJoinRoom(room.id);
                                }
                              }}
                            >
                              <View style={{ flex: 1, marginRight: 8 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' }}>
                                    {room.name.replace(/_/g, ' ')}
                                  </Text>
                                  {targetRoom === room.id && (
                                    <View style={{ backgroundColor: '#00A884', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                      <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: 'bold' }}>Active</Text>
                                    </View>
                                  )}
                                </View>
                                <Text style={{ color: '#8A8D93', fontSize: 11, marginTop: 4 }}>
                                  {room.usersCount} {room.usersCount === 1 ? 'member' : 'members'} online
                                </Text>
                              </View>
                              <Ionicons name="chevron-forward" size={16} color="#8A8D93" />
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>

                    {/* PEOPLE IN THIS ROOM CARD (Active People for P2P) */}
                    <View style={styles.card}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <Ionicons name="person-circle" size={20} color="#00A884" />
                        <Text style={[styles.cardTitle, { marginBottom: 0 }]}>
                          Active People (P2P Chat)
                        </Text>
                      </View>

                      {discoveredUsers.length === 0 ? (
                        <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                          <Ionicons name="people-outline" size={32} color="#3E3E52" style={{ marginBottom: 8 }} />
                          <Text style={{ color: '#8A8D93', fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
                            No other users online. Open the app on another device to start a P2P chat!
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.peersList}>
                          {discoveredUsers.map((user) => (
                            <View key={user.peerId} style={styles.peerItem}>
                              <View style={styles.peerInfo}>
                                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#1E1E26', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2A2A38' }}>
                                  <Ionicons name="person" size={18} color="#00A884" />
                                </View>
                                <View>
                                  <Text style={styles.peerName}>{user.userName}</Text>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#00E676' }} />
                                    <Text style={{ color: '#8A8D93', fontSize: 11 }}>Online</Text>
                                  </View>
                                </View>
                              </View>
                              <TouchableOpacity
                                style={[styles.peerConnectButton, { backgroundColor: '#00A884', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12 }]}
                                onPress={() => connectToPeer(user.peerId, user.userName)}
                              >
                                <Ionicons name="chatbox-ellipses" size={14} color="#FFFFFF" />
                                <Text style={styles.peerConnectButtonText}>Chat P2P</Text>
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  </>
                )}

                <TouchableOpacity 
                  style={[styles.button, styles.disconnectButton, { marginTop: 8 }]} 
                  onPress={() => {
                    resetAll();
                    setAppState('login');
                  }}
                >
                  <Text style={styles.buttonText}>Disconnect & Exit</Text>
                </TouchableOpacity>
              </View>
            ) : (
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
                    <Text style={{ color: '#6C5CE7', fontSize: 12, fontWeight: '600' }}>WiFi Mode</Text>
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
                      <ActivityIndicator size="small" color="#6C5CE7" />
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
            )}

          </ScrollView>
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
                      const url = serverIpInput.startsWith('ws://') || serverIpInput.startsWith('wss://')
                        ? serverIpInput
                        : `ws://${serverIpInput}:5000`;
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F12',
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
});

import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface IncomingCallData {
  callerId: string;
  callerName: string;
  callType: 'audio' | 'video';
}

interface IncomingCallModalProps {
  visible: boolean;
  callData: IncomingCallData | null;
  onAccept: () => void;
  onReject: () => void;
}

export function IncomingCallModal({
  visible,
  callData,
  onAccept,
  onReject,
}: IncomingCallModalProps) {
  // Animated pulse rings
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(1)).current;

  const useNative = Platform.OS !== 'web';

  useEffect(() => {
    if (!visible) return;

    // Loop pulsating radar waves around the caller avatar
    const createRingLoop = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: useNative,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: useNative,
          }),
        ])
      );
    };

    const loop1 = createRingLoop(ring1, 0);
    const loop2 = createRingLoop(ring2, 800);

    // Call accept button gentle pulse bounce
    const bounceLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: 1.1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: useNative,
        }),
        Animated.timing(bounceAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: useNative,
        }),
      ])
    );

    loop1.start();
    loop2.start();
    bounceLoop.start();

    return () => {
      loop1.stop();
      loop2.stop();
      bounceLoop.stop();
    };
  }, [visible]);

  if (!visible || !callData) return null;

  const isVideo = callData.callType === 'video';
  const initial = callData.callerName
    ? callData.callerName.charAt(0).toUpperCase()
    : 'P';

  const getRingStyle = (anim: Animated.Value) => ({
    transform: [
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.9, 2.2],
        }),
      },
    ],
    opacity: anim.interpolate({
      inputRange: [0, 0.2, 0.8, 1],
      outputRange: [0.8, 0.5, 0.15, 0],
    }),
  });

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onReject}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.callCard}>
          {/* TOP TAG */}
          <View style={styles.callTypeBadge}>
            <Ionicons
              name={isVideo ? 'videocam' : 'call'}
              size={16}
              color="#00E676"
            />
            <Text style={styles.callTypeBadgeText}>
              Incoming {isVideo ? 'Video' : 'Voice'} Call
            </Text>
          </View>

          {/* PULSING AVATAR */}
          <View style={styles.avatarStage}>
            <Animated.View style={[styles.pulseRing, getRingStyle(ring1)]} />
            <Animated.View style={[styles.pulseRing, getRingStyle(ring2)]} />
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
          </View>

          {/* CALLER DETAILS */}
          <Text style={styles.callerName} numberOfLines={1}>
            {callData.callerName}
          </Text>
          <Text style={styles.ringingText}>Ringing on local WiFi...</Text>

          {/* ACTION BUTTONS: REJECT & ACCEPT */}
          <View style={styles.actionsRow}>
            {/* REJECT BUTTON */}
            <TouchableOpacity
              style={styles.actionBtnWrapper}
              onPress={onReject}
              activeOpacity={0.8}
            >
              <View style={[styles.actionCircle, styles.rejectCircle]}>
                <Ionicons name="close" size={30} color="#FFFFFF" />
              </View>
              <Text style={styles.actionLabel}>Decline</Text>
            </TouchableOpacity>

            {/* ACCEPT BUTTON */}
            <TouchableOpacity
              style={styles.actionBtnWrapper}
              onPress={onAccept}
              activeOpacity={0.8}
            >
              <Animated.View
                style={[
                  styles.actionCircle,
                  styles.acceptCircle,
                  { transform: [{ scale: bounceAnim }] },
                ]}
              >
                <Ionicons
                  name={isVideo ? 'videocam' : 'call'}
                  size={28}
                  color="#FFFFFF"
                />
              </Animated.View>
              <Text style={[styles.actionLabel, { color: '#00E676' }]}>
                Answer
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 14, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  callCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#1F2C34',
    borderRadius: 28,
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A3942',
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  callTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#00A88422',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00A88455',
    marginBottom: 28,
  },
  callTypeBadgeText: {
    color: '#00E676',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  avatarStage: {
    width: 130,
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 20,
  },
  pulseRing: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(0, 230, 118, 0.25)',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 230, 118, 0.6)',
  },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#111B21',
    borderWidth: 3,
    borderColor: '#00A884',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#00A884',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    zIndex: 10,
  },
  avatarInitial: {
    fontSize: 38,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  callerName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#E9EDEF',
    textAlign: 'center',
    marginBottom: 6,
  },
  ringingText: {
    fontSize: 13,
    color: '#8696A0',
    textAlign: 'center',
    marginBottom: 36,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 20,
  },
  actionBtnWrapper: {
    alignItems: 'center',
    gap: 10,
  },
  actionCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  rejectCircle: {
    backgroundColor: '#FF1744',
  },
  acceptCircle: {
    backgroundColor: '#00A884',
  },
  actionLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

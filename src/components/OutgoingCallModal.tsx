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

export interface OutgoingCallData {
  targetId: string;
  targetName: string;
  callType: 'audio' | 'video';
}

interface OutgoingCallModalProps {
  visible: boolean;
  callData: OutgoingCallData | null;
  onCancel: () => void;
}

export function OutgoingCallModal({
  visible,
  callData,
  onCancel,
}: OutgoingCallModalProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const useNative = Platform.OS !== 'web';

  useEffect(() => {
    if (!visible) return;

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: useNative,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: useNative,
        }),
      ])
    );

    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [visible]);

  if (!visible || !callData) return null;

  const isVideo = callData.callType === 'video';
  const initial = callData.targetName
    ? callData.targetName.charAt(0).toUpperCase()
    : 'P';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.callCard}>
          {/* TOP TAG */}
          <View style={styles.callTypeBadge}>
            <Ionicons
              name={isVideo ? 'videocam' : 'call'}
              size={16}
              color="#00A884"
            />
            <Text style={styles.callTypeBadgeText}>
              Calling ({isVideo ? 'Video' : 'Voice'})...
            </Text>
          </View>

          {/* AVATAR */}
          <Animated.View
            style={[
              styles.avatarCircle,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            <Text style={styles.avatarInitial}>{initial}</Text>
          </Animated.View>

          {/* TARGET DETAILS */}
          <Text style={styles.callerName} numberOfLines={1}>
            {callData.targetName}
          </Text>
          <Text style={styles.ringingText}>Ringing on local network...</Text>

          {/* CANCEL BUTTON */}
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onCancel}
            activeOpacity={0.8}
          >
            <View style={styles.cancelCircle}>
              <Ionicons name="call" size={26} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
            </View>
            <Text style={styles.cancelLabel}>End Call</Text>
          </TouchableOpacity>
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
    color: '#00A884',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
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
    marginBottom: 20,
    elevation: 8,
    shadowColor: '#00A884',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
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
  cancelBtn: {
    alignItems: 'center',
    gap: 8,
  },
  cancelCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#FF1744',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  cancelLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});

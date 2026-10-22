import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface RadarScannerProps {
  onScan: () => void | Promise<void>;
  title?: string;
  subtitle?: string;
  isScanning?: boolean;
}

export function RadarScanner({
  onScan,
  title = 'Looking for Nearby Peers',
  subtitle = 'Open Roto on another phone connected to the same WiFi or Hotspot. They will appear here instantly!',
  isScanning: externalIsScanning,
}: RadarScannerProps) {
  const [internalScanning, setInternalScanning] = useState(false);
  const isScanning = externalIsScanning ?? internalScanning;

  // Concentric Radar Rings Animation Values
  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;
  const pulse3 = useRef(new Animated.Value(0)).current;

  // Center orb breathing pulse
  const centerScale = useRef(new Animated.Value(1)).current;

  // Radar beam rotation
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Scan button spin icon
  const spinBtnAnim = useRef(new Animated.Value(0)).current;

  const useNative = Platform.OS !== 'web';

  // Continuous Radar Waves
  useEffect(() => {
    const createPulseAnim = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2400,
            easing: Easing.out(Easing.cubic),
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

    const loop1 = createPulseAnim(pulse1, 0);
    const loop2 = createPulseAnim(pulse2, 800);
    const loop3 = createPulseAnim(pulse3, 1600);

    loop1.start();
    loop2.start();
    loop3.start();

    // Center icon subtle breathing
    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(centerScale, {
          toValue: 1.08,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: useNative,
        }),
        Animated.timing(centerScale, {
          toValue: 1.0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: useNative,
        }),
      ])
    );
    breathLoop.start();

    // 360-degree radar beam sweep
    const radarSweep = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3500,
        easing: Easing.linear,
        useNativeDriver: useNative,
      })
    );
    radarSweep.start();

    return () => {
      loop1.stop();
      loop2.stop();
      loop3.stop();
      breathLoop.stop();
      radarSweep.stop();
    };
  }, []);

  // Button Spin animation when scan triggered
  const handlePressScan = async () => {
    if (isScanning) return;
    setInternalScanning(true);

    // Spin button icon
    spinBtnAnim.setValue(0);
    Animated.timing(spinBtnAnim, {
      toValue: 1,
      duration: 1200,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: useNative,
    }).start();

    try {
      await onScan();
    } finally {
      setTimeout(() => {
        setInternalScanning(false);
      }, 1200);
    }
  };

  const getRingStyle = (anim: Animated.Value) => {
    return {
      transform: [
        {
          scale: anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.6, 2.3],
          }),
        },
      ],
      opacity: anim.interpolate({
        inputRange: [0, 0.2, 0.8, 1],
        outputRange: [0.7, 0.5, 0.15, 0],
      }),
    };
  };

  const spinInterpolation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const btnSpinInterpolation = spinBtnAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '720deg'],
  });

  return (
    <View style={styles.container}>
      {/* RADAR ANIMATION STAGE */}
      <View style={styles.radarWrapper}>
        {/* Pulsing Concentric Ripple Rings */}
        <Animated.View style={[styles.pulseRing, getRingStyle(pulse1)]} />
        <Animated.View style={[styles.pulseRing, getRingStyle(pulse2)]} />
        <Animated.View style={[styles.pulseRing, getRingStyle(pulse3)]} />

        {/* Ambient Ring Border Guidelines */}
        <View style={styles.guidelineRingOuter} />
        <View style={styles.guidelineRingInner} />

        {/* Sweeping Radar Beam */}
        <Animated.View
          style={[
            styles.radarBeamWrapper,
            { transform: [{ rotate: spinInterpolation }] },
          ]}
        >
          <View style={styles.radarBeam} />
        </Animated.View>

        {/* Center Glowing Hub */}
        <Animated.View
          style={[
            styles.centerHub,
            { transform: [{ scale: centerScale }] },
            isScanning && styles.centerHubScanning,
          ]}
        >
          <Ionicons
            name="wifi"
            size={34}
            color={isScanning ? '#00E676' : '#00A884'}
          />
        </Animated.View>
      </View>

      {/* TEXT HEADINGS */}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>
        {isScanning
          ? 'Scanning local WiFi subnet & active mesh hosts...'
          : subtitle}
      </Text>

      {/* INTERACTIVE SCAN AGAIN BUTTON */}
      <TouchableOpacity
        style={[styles.scanButton, isScanning && styles.scanButtonActive]}
        onPress={handlePressScan}
        activeOpacity={0.8}
        disabled={isScanning}
      >
        <Animated.View
          style={{
            transform: [{ rotate: isScanning ? btnSpinInterpolation : '0deg' }],
          }}
        >
          <Ionicons
            name="refresh"
            size={18}
            color={isScanning ? '#00E676' : '#00A884'}
          />
        </Animated.View>
        <Text style={[styles.scanButtonText, isScanning && styles.scanButtonTextActive]}>
          {isScanning ? 'Scanning WiFi...' : 'Scan Again'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  radarWrapper: {
    width: 170,
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    position: 'relative',
  },
  pulseRing: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(0, 168, 132, 0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 168, 132, 0.45)',
  },
  guidelineRingOuter: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    borderColor: 'rgba(42, 57, 66, 0.45)',
    borderStyle: 'dashed',
  },
  guidelineRingInner: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1,
    borderColor: 'rgba(42, 57, 66, 0.35)',
  },
  radarBeamWrapper: {
    position: 'absolute',
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarBeam: {
    position: 'absolute',
    top: 10,
    width: 2,
    height: 60,
    backgroundColor: '#00A884',
    opacity: 0.85,
    shadowColor: '#00A884',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  centerHub: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#1F2C34',
    borderWidth: 2,
    borderColor: '#00A884',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#00A884',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    zIndex: 10,
  },
  centerHubScanning: {
    borderColor: '#00E676',
    backgroundColor: '#162822',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E9EDEF',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 13,
    color: '#8696A0',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    maxWidth: 300,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1F2C34',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 168, 132, 0.5)',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  scanButtonActive: {
    borderColor: '#00E676',
    backgroundColor: '#162822',
  },
  scanButtonText: {
    color: '#00A884',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.2,
  },
  scanButtonTextActive: {
    color: '#00E676',
  },
});

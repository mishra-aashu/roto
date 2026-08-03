import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Platform, Text } from 'react-native';

interface WebRTCVideoProps {
  stream: any;
  style?: any;
  objectFit?: 'cover' | 'contain';
  isMuted?: boolean;
}

export function WebRTCVideo({ stream, style, objectFit = 'cover', isMuted = false }: WebRTCVideoProps) {
  const videoRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS === 'web' && videoRef.current && stream) {
      try {
        videoRef.current.srcObject = stream;
      } catch (err) {
        console.error('Error binding media stream to video element:', err);
      }
    }
  }, [stream]);

  if (!stream) {
    return (
      <View style={[styles.fallback, style]}>
        <Text style={styles.fallbackText}>No Stream Available</Text>
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMuted}
        style={{
          width: '100%',
          height: '100%',
          objectFit: objectFit,
          backgroundColor: '#151518',
          borderRadius: 12,
          ...style,
        }}
      />
    );
  }

  try {
    const { RTCView } = require('react-native-webrtc');
    // On React Native, we can retrieve streamURL from stream
    const streamURL = typeof stream.toURL === 'function' ? stream.toURL() : '';
    return (
      <RTCView
        streamURL={streamURL}
        style={[styles.rtcView, style]}
        objectFit={objectFit}
        zOrder={1}
      />
    );
  } catch (err) {
    console.error('Failed to load or render RTCView on Native:', err);
    return (
      <View style={[styles.fallback, style]}>
        <Text style={styles.fallbackText}>Native Video Error</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: '#1E1F22',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  fallbackText: {
    color: '#8A8D93',
    fontSize: 12,
  },
  rtcView: {
    width: '100%',
    height: '100%',
    backgroundColor: '#151518',
    borderRadius: 12,
  },
});

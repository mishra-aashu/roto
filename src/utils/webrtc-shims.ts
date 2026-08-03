import { Platform } from 'react-native';

let RTCPeerConnectionShim: any = null;
let RTCSessionDescriptionShim: any = null;
let RTCIceCandidateShim: any = null;
let mediaDevicesShim: any = null;

if (Platform.OS === 'web') {
  if (typeof window !== 'undefined') {
    RTCPeerConnectionShim = window.RTCPeerConnection;
    RTCSessionDescriptionShim = window.RTCSessionDescription;
    RTCIceCandidateShim = window.RTCIceCandidate;
  }
  if (typeof navigator !== 'undefined') {
    mediaDevicesShim = navigator.mediaDevices;
  }
} else {
  try {
    const WebRTC = require('react-native-webrtc');
    RTCPeerConnectionShim = WebRTC.RTCPeerConnection;
    RTCSessionDescriptionShim = WebRTC.RTCSessionDescription;
    RTCIceCandidateShim = WebRTC.RTCIceCandidate;
    mediaDevicesShim = WebRTC.mediaDevices;
  } catch (e) {
    console.warn('react-native-webrtc library could not be loaded dynamically:', e);
  }
}

export {
  RTCPeerConnectionShim as RTCPeerConnection,
  RTCSessionDescriptionShim as RTCSessionDescription,
  RTCIceCandidateShim as RTCIceCandidate,
  mediaDevicesShim as mediaDevices,
};
export const isWebRTCSupported = RTCPeerConnectionShim !== null;

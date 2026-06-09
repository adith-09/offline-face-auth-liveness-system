import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ActivityIndicator, TextInput } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { enroll } from 'rn-offline-face-auth';

export default function EnrollmentScreen() {
  const [userId, setUserId] = useState('EMP_8842');
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [status, setStatus] = useState('Position face inside frame');
  const cameraRef = useRef<Camera>(null);

  const triggerEnrollment = async () => {
    if (!cameraRef.current) return;
    
    try {
      setIsEnrolling(true);
      setStatus('Capturing biometric anchor...');
      
      // 1. Take reference photograph
      const photo = await cameraRef.current.takePhoto({ qualityPrioritization: 'quality' });
      
      setStatus('Generating facial embedding vector...');
      // 2. Run extraction and local database insertion
      const result = await enroll(userId, photo.path);
      
      if (result.success) {
        setStatus('Enrollment completed!');
        Alert.alert(
          'Success', 
          'Face biometric enrolled and encrypted locally!'
        );
      } else {
        setStatus('Enrollment failed.');
        Alert.alert('Error', result.error || 'Failed to extract valid facial keypoints.');
      }
    } catch (err: any) {
      setStatus('Error during enrollment.');
      Alert.alert('System Error', err.message || 'Camera or processing failure.');
    } finally {
      setIsEnrolling(false);
    }
  };

  const device = useCameraDevice('front');

  if (!device) {
    return (
      <View style={styles.fallback}>
        <ActivityIndicator size="large" color="#00f2fe" />
        <Text style={styles.fallbackText}>Loading camera systems...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        photo={true}
      />
      <View style={styles.overlay}>
        <View style={styles.viewfinderContainer}>
          <View style={styles.viewfinder}>
            {/* Sci-Fi HUD Viewfinder Corners */}
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <Text style={styles.hudText}>BIOMETRIC ANCHOR ENGINE</Text>
          <Text style={styles.userIdSubText}>TARGET ID: {userId}</Text>
        </View>

        <View style={styles.controlPanel}>
          <TextInput
            style={styles.userIdInput}
            value={userId}
            onChangeText={setUserId}
            placeholder="Enter Employee ID"
            placeholderTextColor="#4a5568"
          />
          <Text style={styles.statusText}>{status.toUpperCase()}</Text>
          <TouchableOpacity 
            style={[styles.enrollBtn, isEnrolling && styles.disabledBtn]} 
            onPress={triggerEnrollment}
            disabled={isEnrolling}
          >
            {isEnrolling ? (
              <ActivityIndicator color="#070913" />
            ) : (
              <Text style={styles.btnText}>Enroll Biometric Profile</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#070913' },
  fallback: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#070913' },
  fallbackText: { color: '#00f2fe', marginTop: 20, fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  overlay: { flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingVertical: 50 },
  viewfinderContainer: { alignItems: 'center', marginTop: 50 },
  viewfinder: {
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 242, 254, 0.25)',
    borderStyle: 'dashed',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00f2fe',
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
    backgroundColor: 'rgba(0, 242, 254, 0.02)'
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#00f2fe',
  },
  topLeft: {
    top: -6,
    left: -6,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 10
  },
  topRight: {
    top: -6,
    right: -6,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 10
  },
  bottomLeft: {
    bottom: -6,
    left: -6,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 10
  },
  bottomRight: {
    bottom: -6,
    right: -6,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 10
  },
  hudText: { color: '#00f2fe', fontSize: 12, fontWeight: '800', marginTop: 24, letterSpacing: 2, textShadowColor: 'rgba(0, 242, 254, 0.4)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 0 } },
  userIdSubText: { color: '#a0aec0', fontSize: 13, fontWeight: '600', marginTop: 4, letterSpacing: 0.5 },
  controlPanel: { 
    width: '90%', 
    alignItems: 'center', 
    backgroundColor: 'rgba(19, 23, 44, 0.85)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
    marginBottom: 10
  },
  userIdInput: {
    width: '100%',
    backgroundColor: 'rgba(7, 9, 19, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    color: '#fff',
    fontSize: 15,
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 0.5
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 20,
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    borderColor: 'rgba(0, 242, 254, 0.3)',
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    textAlign: 'center',
    overflow: 'hidden'
  },
  enrollBtn: {
    backgroundColor: '#00f2fe',
    paddingVertical: 16,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#00f2fe',
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 6
  },
  disabledBtn: { backgroundColor: '#4a5568' },
  btnText: { color: '#070913', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 }
});

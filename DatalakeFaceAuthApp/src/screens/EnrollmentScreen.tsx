import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ActivityIndicator, TextInput } from 'react-native';
import { Camera, useCameraDevices } from 'react-native-vision-camera';
import { enroll } from 'rn-offline-face-auth';

interface EnrollmentScreenProps {
  navigation: any;
}

export default function EnrollmentScreen({ navigation }: EnrollmentScreenProps) {
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
      // 2. Run TFLite MobileFaceNet extraction and local database insertion
      const result = await enroll(userId, photo.path);
      
      if (result.success) {
        setStatus('Enrollment completed!');
        Alert.alert(
          'Success', 
          'Face biometric enrolled and encrypted locally!', 
          [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
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

  const devices = useCameraDevices();
  const device = devices.front;

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
          <View style={styles.viewfinder} />
          <Text style={styles.hudText}>USER ID: {userId}</Text>
        </View>

        <View style={styles.controlPanel}>
          <TextInput
            style={styles.userIdInput}
            value={userId}
            onChangeText={setUserId}
            placeholder="Enter Employee ID"
            placeholderTextColor="#718096"
          />
          <Text style={styles.statusText}>{status}</Text>
          <TouchableOpacity 
            style={[styles.enrollBtn, isEnrolling && styles.disabledBtn]} 
            onPress={triggerEnrollment}
            disabled={isEnrolling}
          >
            {isEnrolling ? (
              <ActivityIndicator color="#0b0d19" />
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
  container: { flex: 1, backgroundColor: '#0b0d19' },
  fallback: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0b0d19' },
  fallbackText: { color: '#00f2fe', marginTop: 20, fontSize: 16 },
  overlay: { flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingVertical: 40 },
  viewfinderContainer: { alignItems: 'center', marginTop: 60 },
  viewfinder: {
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 3,
    borderColor: '#00f2fe',
    borderStyle: 'dashed'
  },
  hudText: { color: '#00f2fe', fontSize: 14, fontWeight: 'bold', marginTop: 15, letterSpacing: 1 },
  controlPanel: { width: '100%', alignItems: 'center', paddingHorizontal: 30 },
  userIdInput: {
    width: '80%',
    backgroundColor: 'rgba(11, 13, 25, 0.8)',
    borderWidth: 1,
    borderColor: '#2d3748',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    color: '#fff',
    fontSize: 14,
    marginBottom: 15,
    textAlign: 'center'
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: 'rgba(11, 13, 25, 0.8)',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    textAlign: 'center'
  },
  enrollBtn: {
    backgroundColor: '#00f2fe',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 30,
    width: '80%',
    alignItems: 'center',
    shadowColor: '#00f2fe',
    shadowOpacity: 0.5,
    shadowRadius: 15
  },
  disabledBtn: { backgroundColor: '#4a5568' },
  btnText: { color: '#0b0d19', fontSize: 16, fontWeight: 'bold' }
});

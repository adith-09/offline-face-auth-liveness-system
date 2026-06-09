# React Native Integration Guide

This guide details the steps required to integrate the `rn-offline-face-auth` native module into the Datalake 3.0 React Native package (compatible with React Native version 0.71+).

---

## 1. Installation

Install the package via your package manager:

```bash
npm install rn-offline-face-auth
# or
yarn add rn-offline-face-auth
```

### iOS Setup
Install native pod dependencies:

```bash
cd ios
pod install
cd ..
```

Ensure the following properties are added to your `Info.plist` to grant camera and location permissions with standard runtime justification prompts:

```xml
<key>NSCameraUsageDescription</key>
<string>Datalake 3.0 requires camera access to perform offline facial recognition and active liveness verification.</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>Datalake 3.0 uses your location to tag offline authentication attendance records with GPS coordinates.</string>
```

### Android Setup
Add the following permissions to your `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

Ensure SQLite and SQLCipher dependencies are configured correctly inside your project-level `android/build.gradle`.

---

## 2. Model Asset Bundling

To run the deep learning models on-device, you must bundle the quantized `.tflite` (Android) and Core ML `.mlmodel` (iOS) models directly into the binary packages.

| Model File | Platform | Output Size | Target Native Assets Directory |
| :--- | :--- | :--- | :--- |
| `face_recognition.tflite` | Android | 2.1 MB | `android/app/src/main/assets/` |
| `liveness_passive.tflite` | Android | 1.1 MB | `android/app/src/main/assets/` |
| `face_detection.tflite` | Android | 0.8 MB | `android/app/src/main/assets/` |
| `face_recognition.mlmodel` | iOS | 2.1 MB | `/YourApp/` resources bundle |
| `liveness_passive.mlmodel` | iOS | 1.1 MB | `/YourApp/` resources bundle |
| `face_detection.mlmodel` | iOS | 0.8 MB | `/YourApp/` resources bundle |

---

## 3. JavaScript/TypeScript API

The module exposes a clean, strongly typed asynchronous JS API through the `rn-offline-face-auth` package.

### TypeScript Definition (`index.d.ts`)

```typescript
export interface EnrollmentResult {
  success: boolean;
  embedding: number[];
  error?: string;
}

export interface VerificationResult {
  authenticated: boolean;
  confidence: number;
  latencyMs: number;
  error?: string;
}

export interface LivenessResult {
  isLive: boolean;
  confidence: number;
  error?: string;
}

export interface SyncResult {
  synced: number;
  failed: number;
}

export declare function enroll(userId: string, imagePath: string): Promise<EnrollmentResult>;
export declare function verify(userId: string, imagePath: string): Promise<VerificationResult>;
export declare function livenessCheck(frameBuffer: string[], gestureType: 'blink' | 'smile' | 'turn'): Promise<LivenessResult>;
export declare function syncPendingLogs(endpoint: string, authToken: string): Promise<SyncResult>;
export declare function deleteEnrollment(userId: string): Promise<{ success: boolean }>;
```

---

## 4. Usage Example

Here is a complete integration script showing how the verification screen interacts with the native module to handle the offline biometric auth lifecycle:

```typescript
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Alert, TouchableOpacity } from 'react-native';
import { Camera, useCameraDevices } from 'react-native-vision-camera';
import { verify, livenessCheck } from 'rn-offline-face-auth';

export default function VerificationScreen({ route, navigation }) {
  const { userId } = route.params;
  const [hasPermission, setHasPermission] = useState(false);
  const [livenessStage, setLivenessStage] = useState<'passive' | 'blink' | 'passed' | 'failed'>('passive');
  const [statusText, setStatusText] = useState('Initializing verification...');
  const cameraRef = React.useRef<Camera>(null);

  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'authorized');
    })();
  }, []);

  const handleCapture = async () => {
    if (!cameraRef.current) return;

    try {
      setStatusText('Analyzing liveness...');
      // 1. Capture snapshot image
      const photo = await cameraRef.current.takePhoto({ qualityPrioritized: true });

      // 2. Perform Liveness Gating (Active blink challenge)
      setStatusText('Please blink your eyes...');
      setLivenessStage('blink');
      
      // Accumulate camera frame buffer in a real scenario
      const frameBuffer: string[] = [photo.path]; 
      const liveness = await livenessCheck(frameBuffer, 'blink');

      if (!liveness.isLive) {
        setLivenessStage('failed');
        setStatusText('Liveness verification failed. Spoof detected!');
        Alert.alert('Authentication Denied', 'Passive or Active anti-spoof check failed.');
        return;
      }

      setLivenessStage('passed');
      setStatusText('Liveness verified. Verifying identity...');

      // 3. Perform offline face similarity comparison
      const result = await verify(userId, photo.path);

      if (result.authenticated) {
        setStatusText(`Authenticated successfully! (Similarity: ${(result.confidence * 100).toFixed(1)}%)`);
        Alert.alert('Access Granted', `Identity matched in ${result.latencyMs}ms!`, [
          { text: 'OK', onPress: () => navigation.navigate('Home') }
        ]);
      } else {
        setStatusText('Authentication failed. Face mismatch.');
        Alert.alert('Access Denied', 'Face does not match enrolled profile.');
      }
    } catch (err: any) {
      setStatusText('An error occurred during verification.');
      Alert.alert('Verification Error', err.message);
    }
  };

  const devices = useCameraDevices();
  const device = devices.front;

  if (!hasPermission) return <Text style={styles.infoText}>No Camera Permission</Text>;
  if (!device) return <Text style={styles.infoText}>Loading Front Camera...</Text>;

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
        <View style={[styles.gazeCircle, livenessStage === 'passed' ? styles.greenBorder : styles.cyanBorder]} />
        <Text style={styles.instructions}>{statusText}</Text>
        <TouchableOpacity style={styles.captureBtn} onPress={handleCapture}>
          <Text style={styles.btnText}>Verify Identity</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  infoText: { color: '#fff', fontSize: 16, textAlign: 'center', marginTop: 100 },
  overlay: { flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingVertical: 50 },
  gazeCircle: {
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 3,
    borderStyle: 'dashed',
    marginTop: 100
  },
  cyanBorder: { borderColor: '#00f2fe' },
  greenBorder: { borderColor: '#4cd964' },
  instructions: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 10,
    borderRadius: 8,
    textAlign: 'center',
    marginHorizontal: 20
  },
  captureBtn: {
    backgroundColor: '#00f2fe',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
    shadowColor: '#00f2fe',
    shadowOpacity: 0.4,
    shadowRadius: 10
  },
  btnText: { color: '#0b0d19', fontSize: 16, fontWeight: 'bold' }
});
```

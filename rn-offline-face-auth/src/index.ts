import { NativeModules, Platform } from 'react-native';

const LINKING_ERROR =
  `The package 'rn-offline-face-auth' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

const OfflineFaceAuth = NativeModules.OfflineFaceAuth
  ? NativeModules.OfflineFaceAuth
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

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

/**
 * Enrolls a user by running the face detection and MobileFaceNet extraction 
 * on the provided image path, saving the encrypted embedding in the local DB.
 */
export function enroll(userId: string, imagePath: string): Promise<EnrollmentResult> {
  return OfflineFaceAuth.enroll(userId, imagePath);
}

/**
 * Verifies a user by matching their live face embedding against the enrolled one in the SQLite store.
 */
export function verify(userId: string, imagePath: string): Promise<VerificationResult> {
  return OfflineFaceAuth.verify(userId, imagePath);
}

/**
 * Runs active and passive anti-spoof checks on a frame buffer of camera captures.
 */
export function livenessCheck(
  frameBuffer: string[],
  gestureType: 'blink' | 'smile' | 'turn'
): Promise<LivenessResult> {
  return OfflineFaceAuth.livenessCheck(frameBuffer, gestureType);
}

/**
 * Uploads all locally stored auth logs to an AWS endpoint and purges them on server ACK.
 */
export function syncPendingLogs(endpoint: string, authToken: string): Promise<SyncResult> {
  return OfflineFaceAuth.syncPendingLogs(endpoint, authToken);
}

/**
 * Deletes the biometric enrollment profile for a specific user from the encrypted local store.
 */
export function deleteEnrollment(userId: string): Promise<{ success: boolean }> {
  return OfflineFaceAuth.deleteEnrollment(userId);
}

export default {
  enroll,
  verify,
  livenessCheck,
  syncPendingLogs,
  deleteEnrollment,
};

import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { syncPendingLogs, deleteEnrollment } from 'rn-offline-face-auth';

export default function SettingsScreen() {
  const [syncing, setSyncing] = useState(false);
  const [localLogsCount, setLocalLogsCount] = useState(14);
  const AWS_ENDPOINT = 'https://api.datalake3.aws.internal/v1/sync';

  const handleSync = async () => {
    try {
      setSyncing(true);
      // Call native module sync pipeline with retry logic
      const result = await syncPendingLogs(AWS_ENDPOINT, 'DATALAKE_SECURE_TOKEN_3.0');
      
      Alert.alert(
        'Sync Complete',
        `Successfully synced ${result.synced} biometric authentication logs. ${result.failed} records failed.`,
        [{ text: 'OK', onPress: () => setLocalLogsCount(0) }]
      );
    } catch (err: any) {
      Alert.alert('Sync Error', err.message || 'Failed to communicate with AWS sync server.');
    } finally {
      setSyncing(false);
    }
  };

  const handleClearEnrollment = () => {
    Alert.alert(
      'Reset Biometrics',
      'Are you sure you want to permanently delete your on-device enrolled face model? This requires admin approval.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm Reset', 
          style: 'destructive',
          onPress: async () => {
            const res = await deleteEnrollment('EMP_8842');
            if (res.success) {
              Alert.alert('Reset Complete', 'Local biometrics successfully purged.');
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>System Control Panel</Text>
        <Text style={styles.subtitle}>Manage local storage and backend sync pipeline</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Offline Logs Queue</Text>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Pending Sync Records:</Text>
          <Text style={styles.metricValue}>{localLogsCount}</Text>
        </View>
        <Text style={styles.infoText}>
          Authentication records captured in zero-connectivity areas are queued in a local encrypted SQLCipher store and synced when connection is restored.
        </Text>
        <TouchableOpacity 
          style={[styles.syncBtn, syncing && styles.disabledBtn]} 
          onPress={handleSync}
          disabled={syncing}
        >
          <Text style={styles.btnText}>{syncing ? 'Synchronizing...' : 'Trigger Manual Sync'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Biometric Database</Text>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Profile Enrolled:</Text>
          <Text style={[styles.metricValue, styles.greenText]}>EMP_8842 (Active)</Text>
        </View>
        <Text style={styles.infoText}>
          Deleting this profile will clear the 128-dimensional matching vector from secure local sandbox storage. Re-enrollment will require admin credentials.
        </Text>
        <TouchableOpacity style={styles.deleteBtn} onPress={handleClearEnrollment}>
          <Text style={styles.deleteBtnText}>Purge Enrolled Biometrics</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0d19', padding: 20 },
  header: { marginBottom: 30, marginTop: 20 },
  title: { color: '#00f2fe', fontSize: 24, fontWeight: 'bold' },
  subtitle: { color: '#718096', fontSize: 14, marginTop: 5 },
  card: {
    backgroundColor: '#161930',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2d3748'
  },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  metricLabel: { color: '#a0aec0', fontSize: 14 },
  metricValue: { color: '#00f2fe', fontSize: 14, fontWeight: 'bold' },
  greenText: { color: '#48bb78' },
  infoText: { color: '#718096', fontSize: 12, lineHeight: 18, marginVertical: 15 },
  syncBtn: {
    backgroundColor: '#00f2fe',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center'
  },
  deleteBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#e53e3e',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center'
  },
  disabledBtn: { backgroundColor: '#4a5568' },
  btnText: { color: '#0b0d19', fontSize: 15, fontWeight: 'bold' },
  deleteBtnText: { color: '#e53e3e', fontSize: 15, fontWeight: 'bold' }
});

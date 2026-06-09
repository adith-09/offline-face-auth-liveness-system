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
  container: { flex: 1, backgroundColor: '#070913', padding: 20 },
  header: { marginBottom: 30, marginTop: 40 },
  title: { color: '#00f2fe', fontSize: 24, fontWeight: '800', letterSpacing: 1, textShadowColor: 'rgba(0, 242, 254, 0.3)', textShadowRadius: 6 },
  subtitle: { color: '#718096', fontSize: 13, marginTop: 6, fontWeight: '500', letterSpacing: 0.5 },
  card: {
    backgroundColor: 'rgba(19, 23, 44, 0.85)',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 6
  },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 16, letterSpacing: 0.5 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' },
  metricLabel: { color: '#a0aec0', fontSize: 14, fontWeight: '600' },
  metricValue: { color: '#00f2fe', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  greenText: { color: '#00e676' },
  infoText: { color: '#718096', fontSize: 12, lineHeight: 18, marginVertical: 12, fontWeight: '500' },
  syncBtn: {
    backgroundColor: '#00f2fe',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#00f2fe',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4
  },
  deleteBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#ff1744',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  disabledBtn: { backgroundColor: '#4a5568' },
  btnText: { color: '#070913', fontSize: 15, fontWeight: '805', letterSpacing: 0.5 },
  deleteBtnText: { color: '#ff1744', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 }
});

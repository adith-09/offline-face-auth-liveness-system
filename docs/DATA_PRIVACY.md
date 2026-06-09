# Biometric Data Privacy & Legal Compliance

This document outlines the strict architectural safeguards, encryption protocols, and legal alignments built into the **Offline Facial Recognition & Liveness Detection** system to guarantee total security and absolute compliance with national and international regulatory standards.

---

## 1. Zero-Trust Privacy Architecture

The module utilizes a **Zero-Trust Biometric Model**, structured on the principle that biometric data must remain strictly isolated within the sandbox boundaries of the target device.

```text
       DATA ISOLATION PIPELINE:
       
       [ Camera Frame ] ---> [ MediaPipe Landmark Processing ]
                                     |
                                     | (Volatile RAM only)
                                     v
       [ JPEG/PNG Deleted ]  <--- [ MobileFaceNet Feature Extraction ]
                                     |
                                     v
       [ Encrypted Store ]  <===  [ L2-Normalized 128-d Vector (AES-256) ]
```

### 1.1 Non-Retention of Raw Images
The system does not capture, store, or serialize raw visual media (JPEG, PNG, or raw byte arrays) onto local storage during either enrollment or verification.
- **In-Memory Gating**: Incoming video streams are buffered directly inside volatile system RAM.
- **Instant Evastion**: The camera buffer is fully flushed immediately after the facial embedding is generated or when the liveness detection engine throws a rejection signal.

### 1.2 Non-Reversibility of Biometric Templates
The outputs of the facial recognition engine are 128-dimensional L2-normalized floating-point vectors ($128 \times 32$-bits).
- These vectors represent high-level geometric coordinates inside an abstract space.
- Biometric vectors are **mathematically non-reversible**: it is impossible to reconstruct the human face or synthesize a recognizable portrait using a 128-dimensional embedding array, ensuring full protection even in the event of local database compromises.

---

## 2. Cryptographic Security Standards

### 2.1 Encryption-at-Rest (SQLCipher)
All data, including enrolled user mappings and pending attendance logs, are stored in a dedicated SQLCipher database file inside the sandboxed application directory.
- **Algorithm**: AES-256-CBC (Advanced Encryption Standard with a 256-bit key length).
- **Key Derivation**: Key material is derived using PBKDF2 (Password-Based Key Derivation Function 2) running 64,000 hash iterations.
- **Access Gating**: The decryption key is generated dynamically from a secure local hardware keystore (Android Keystore System / iOS Keychain Services) and is never persisted in plaintext inside app resources.

### 2.2 Encryption-in-Transit (AWS Sync Pipeline)
When network connectivity is detected and logs are prepared for synchronization:
- **Transport Security**: Logs are uploaded using HTTP over TLS 1.3 (Transport Layer Security), which enforces Perfect Forward Secrecy.
- **Payload Sanitization**: Transmitted payloads contain only the transaction metadata (e.g., user identifier, timestamps, geolocation coordinate, and verification flags). **Biometric embeddings are never transmitted to the cloud.**
- **Automatic Purging**: Local database entries are explicitly overwritten and wiped using physical block sanitization immediately upon verification of the server-signed ACK token.

---

## 3. Regulatory & Legal Alignments

The architecture aligns fully with the following national and international privacy legal frameworks:

### 3.1 India's Information Technology (IT) Act, 2000
- Under Section 43A of the IT Act 2000, biometric data is classified as **Sensitive Personal Data or Information (SPDI)**.
- **Consent Gating**: The host application implements explicit user consent screens before biometric enrollment or camera utilization.
- **Reasonable Security Practices**: The implementation of on-device inference, SQLCipher AES-256 local database encryption, hardware key isolation, and immediate visual buffer purging satisfies all "reasonable security practices and procedures" mandates under the Act.

### 3.2 Digital Personal Data Protection (DPDP) Act, 2023 (India)
- **Data Minimisation**: The system processes only the minimum amount of biometric data required to perform verification (feature vectors) and purges raw visual frames instantly.
- **Purpose Limitation**: Biometric data is used solely for on-device operational authentication and is never repurposed, shared, or leaked to third-party services.
- **Storage Limitation**: All offline operational logs are deleted immediately after the AWS synchronization server acknowledges the sync event.

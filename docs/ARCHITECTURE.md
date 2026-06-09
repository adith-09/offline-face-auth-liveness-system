# Technical Architecture: Offline Facial Recognition & Liveness Detection

This document provides a deep dive into the architecture, mathematical formulations, and component design of the **Offline Facial Recognition & Liveness Detection** system integrated into the **Datalake 3.0** platform.

---

## 1. System Topology

The system operates strictly on-device, running deep learning models for face detection, active/passive liveness detection, and facial embedding generation without any external network dependency.

```text
+---------------------------------------------------------------------------------------+
|                                    REACT NATIVE UI                                    |
|   +-------------------------------------------------------------------------------+   |
|   |                       Camera Feed Component (Vision Camera)                   |   |
|   |                       Active Gesture Prompts (Blink / Smile)                  |   |
|   +-------------------------------------------------------------------------------+   |
+------------------------------------------^--------------------------------------------+
                                           | (Bridge Calls)
                                           v
+---------------------------------------------------------------------------------------+
|                                  NATIVE MODULE BRIDGE                                 |
|                       Exposes enroll(), verify(), livenessCheck()                     |
+------------------------------------------^--------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                                  NATIVE INFERENCE ENGINE                              |
|   +--------------------------+  +--------------------------+  +-------------------+   |
|   |   MediaPipe Face Mesh    |  |    Passive Anti-Spoof    |  |  MobileFaceNet    |   |
|   |     (468 Landmarks)      |  |      (Binary CNN)        |  |  (128-d Vector)   |   |
|   +------------+-------------+  +------------+-------------+  +---------+---------+   |
|                |                             |                          |             |
|                +--------------------+--------+                          |             |
|                                     | (Gated validation)                |             |
|                                     v                                   v             |
|                         +-----------------------+           +-----------+-----------+ |
|                         |  Liveness Gating Pass | --------> |  Embedding Similarity | |
|                         +-----------------------+           +-----------+-----------+ |
+-------------------------------------------------------------------------|-------------+
                                                                          v
+---------------------------------------------------------------------------------------+
|                                  ENCRYPTED STORAGE                                    |
|   +-------------------------------------------------------------------------------+   |
|   |                   SQLCipher Encrypted SQLite DB (AES-256)                     |   |
|   |   - Enrolled Biometrics: { userId, 128_d_vector, enrolled_at }                 |   |
|   |   - Session Queue Logs:  { logId, userId, timestamp, gps, sync_status }        |   |
|   +-------------------------------------------------------------------------------+   |
+------------------------------------------|--------------------------------------------+
                                           | (On network reconnect)
                                           v
+---------------------------------------------------------------------------------------+
|                                   AWS SYNC SERVICE                                    |
|            Uploads session logs using exponential back-off & purges local DB          |
+---------------------------------------------------------------------------------------+
```

---

## 2. Core Engine Components

### 2.1 Face Detection & Alignment (MediaPipe Face Mesh)
- **Model**: MediaPipe Face Mesh (quantized to INT8, footprint < 1.0 MB).
- **Function**: Detects the region of interest (ROI) and tracks 468 facial landmarks.
- **Alignment Method**: 2D Affine Transformation is performed on the facial region using 5 key coordinates (pupils, nose tip, mouth corners) to normalize rotation, tilt, and scale, producing a standardized $112 \times 112$ pixels cropped face image.

### 2.2 Feature Extraction (MobileFaceNet)
- **Architecture**: A lightweight deep convolutional neural network utilizing depth-wise separable convolutions and linear bottleneck layers.
- **Input**: Normalised $112 \times 112 \times 3$ RGB image.
- **Output**: 128-dimensional floating-point vector representing the biometric embedding.
- **Mathematical Form**:
  The feature representation is L2-normalized:
  $$\vec{x} = \frac{f(I)}{\|f(I)\|_2}$$
  Ensuring that $\|\vec{x}\|_2 = 1.0$.

### 2.3 Verification & Similarity Scoring
- **Comparison Function**: Cosine similarity is computed between the target probe embedding $\vec{x}_p$ and the enrolled template embedding $\vec{x}_t$.
- **Formula**:
  $$\text{Similarity}(\vec{x}_p, \vec{x}_t) = \cos(\theta) = \frac{\vec{x}_p \cdot \vec{x}_t}{\|\vec{x}_p\|_2 \|\vec{x}_t\|_2} = \vec{x}_p \cdot \vec{x}_t$$ (since both are L2-normalised)
- **Threshold Gating**:
  $$\text{Result} = \begin{cases} 
  \text{Authenticated} & \text{if } \cos(\theta) \ge 0.75 \\
  \text{Rejected} & \text{if } \cos(\theta) < 0.75 
  \end{cases}$$

---

## 3. Liveness Detection Engine (Anti-Spoofing)

To defend against presentation attacks (printed papers, high-resolution screens), the module implements a hybrid (active + passive) liveness validation.

### 3.1 Passive Liveness (Texture & Depth Analysis)
- **Model**: 3-layer Convolutional Neural Network (CNN) with Global Average Pooling, quantized to INT8 (< 1.5 MB).
- **Input**: Single cropped $64 \times 64$ px face bounding box.
- **Operation**: Analyzes high-frequency reflections and structural patterns unique to flat materials (paper, digital screens) versus human skin.
- **Output**: A probability score in the range $[0, 1]$.
  - Score $\ge 0.85$ indicates a live subject.
  - Score $< 0.85$ indicates a spoof attack.

### 3.2 Active Liveness (Gesture Verification)
Active liveness tracks key facial landmark deltas over a 30-frame temporal window to detect specific biological movements.

#### Blink Detection
- **Metric**: Eye Aspect Ratio (EAR) computed via 6 landmarks per eye.
  $$EAR = \frac{\|p_2 - p_6\| + \|p_3 - p_5\|}{2\|p_1 - p_4\|}$$
- **Algorithm**: A blink is registered when EAR drops below $0.20$ and recovers to $>0.28$ within 8 frames, representing a normal human blink velocity.

#### Smile Detection
- **Metric**: Mouth Aspect Ratio (MAR) and mouth-to-face ratio deltas.
  $$MAR = \frac{\|p_{corner\_left} - p_{corner\_right}\|}{W_{face}}$$
- **Algorithm**: Registers active cooperation when the width-to-height ratio of the lip boundaries increases by $\ge 15\%$ from baseline.

#### Head Turn Detection
- **Metric**: Ratio of distance between nasal tip landmark and outer eye boundaries.
- **Algorithm**: Verifies 3D rotation when the yaw angle changes by $\ge 10^\circ$ relative to the central anchor coordinates.

---

## 4. Encryption & Local Database Schema

To strictly comply with data privacy standards (IT Act 2000), biometric templates are encrypted at rest using SQLCipher (AES-256 in CBC mode with PBKDF2 key derivation).

### 4.1 SQLCipher Database Schema

```sql
-- Table: enrollments
-- Stores 128-dimensional L2-normalized face embeddings
CREATE TABLE enrollments (
    user_id TEXT PRIMARY KEY,
    embedding BLOB NOT NULL,              -- 128 * 4 bytes floating-point array
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: auth_logs
-- Stores offline authentication sessions pending upload
CREATE TABLE auth_logs (
    log_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,            -- Unix timestamp
    latitude REAL,                         -- GPS data
    longitude REAL,                        -- GPS data
    liveness_status TEXT NOT NULL,         -- 'PASS', 'FAIL_SPOOF', 'FAIL_GESTURE'
    verification_status TEXT NOT NULL,     -- 'SUCCESS', 'FAILED_MISMATCH'
    sync_status INTEGER DEFAULT 0          -- 0 = pending, 1 = in_flight
);
```

### 4.2 Security Gating & Purging
1. **No Image Preservation**: Crop matrices are purged from system memory immediately following inference. No raw JPEG/PNG images are stored on-device.
2. **Write-Ahead Logging**: Offline transactions are recorded in the encrypted `auth_logs` table.
3. **Synchronisation Gating**: Logs remain in the database until an explicit cryptographic acknowledgment (with valid signed token matching outstanding IDs) is returned from the cloud backend.
4. **Instant Purge**: Upon confirmation, records are physically deleted (`DELETE FROM auth_logs WHERE log_id = ?`) and SQLCipher `VACUUM` is triggered to clear allocated storage blocks, eliminating residual forensic data.

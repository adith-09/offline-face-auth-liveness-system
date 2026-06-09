# Offline Face Authentication & Liveness Detection System

## Overview

A mobile-based offline facial recognition and liveness detection solution designed for secure authentication in remote and low-connectivity environments.

The system performs on-device face recognition and liveness verification without requiring an active internet connection, ensuring reliable operation in field conditions.

---

## Features

* Offline facial recognition
* Real-time liveness detection
* Anti-spoofing protection
* Cross-platform mobile support
* Local data storage
* Offline-to-online synchronization workflow
* Lightweight AI models optimized for edge devices

---

## Technology Stack

### Mobile

* React Native
* TypeScript

### Backend

* Node.js
* Express.js

### Database

* SQLite

### AI Components

* Face Detection
* Face Recognition
* Liveness Detection
* Model Quantization

---

## Project Structure

```text
backend/
mobile-app/
docs/
interactive-showcase/
model-quantization/
presentation/
rn-offline-face-auth/
DatalakeFaceAuthApp/
```

## System Workflow

1. Capture facial image
2. Perform liveness verification
3. Generate face embeddings
4. Compare against enrolled profiles
5. Authenticate user
6. Store logs locally
7. Synchronize records when connectivity is available

---

## Key Objectives

* Secure offline authentication
* Fast inference on mobile devices
* Reduced model footprint
* Reliable operation in varying lighting conditions
* Scalable synchronization architecture

---

## Installation

### Backend

```bash
cd backend
npm install
npm start
```

### Mobile Application

```bash
cd mobile-app
npm install
npx expo start
```

---

## Documentation

Additional documentation is available in:

* Architecture Guide
* Benchmark Reports
* Data Privacy Documentation
* Integration Documentation
* Presentation Materials

---

## Future Enhancements

* Advanced anti-spoofing techniques
* Enhanced model compression
* Multi-user enrollment management
* Improved synchronization mechanisms
* Edge AI performance optimizations

---

## License

This project is intended for educational, research, and demonstration purposes.

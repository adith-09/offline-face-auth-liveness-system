/* app.js - High Fidelity Biometric & Sync Simulator */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const webcam = document.getElementById('webcam');
    const canvas = document.getElementById('face-mesh-canvas');
    const ctx = canvas.getContext('2d');
    const cameraPlaceholder = document.getElementById('camera-placeholder');
    const btnEnableCamera = document.getElementById('btn-enable-camera');
    
    const userIdInput = document.getElementById('user-id-input');
    const btnEnroll = document.getElementById('btn-enroll');
    const btnVerify = document.getElementById('btn-verify');
    const btnSimulateMismatch = document.getElementById('btn-simulate-mismatch');
    const btnSimulateSpoof = document.getElementById('btn-simulate-spoof');
    
    const livenessPrompt = document.getElementById('liveness-prompt');
    const promptInstruction = livenessPrompt.querySelector('.prompt-instruction');
    const promptProgress = document.getElementById('prompt-progress');
    
    const similarityScore = document.getElementById('similarity-score');
    const similarityBar = document.getElementById('similarity-bar');
    const similarityStatus = document.getElementById('similarity-status');
    const thresholdSlider = document.getElementById('threshold-slider');
    
    const passiveLivenessScore = document.getElementById('passive-liveness-score');
    const passiveLivenessBar = document.getElementById('passive-liveness-bar');
    
    const blinkLed = document.getElementById('blink-led');
    const smileLed = document.getElementById('smile-led');
    const turnLed = document.getElementById('turn-led');
    const activeBlinkStatus = document.getElementById('active-blink-status');
    const activeSmileStatus = document.getElementById('active-smile-status');
    const activeTurnStatus = document.getElementById('active-turn-status');
    
    const latencyStats = document.getElementById('latency-stats');
    const btnToggleDecryption = document.getElementById('btn-toggle-decryption');
    const enrollmentsTable = document.getElementById('enrollments-table').querySelector('tbody');
    const logsTable = document.getElementById('logs-table').querySelector('tbody');
    const queueSizeBadge = document.getElementById('queue-size-badge');
    const syncRetriesBadge = document.getElementById('sync-retries-badge');
    const btnManualSync = document.getElementById('btn-manual-sync');
    const networkToggle = document.getElementById('network-toggle');
    const awsConsole = document.getElementById('aws-console');
    
    // Tab switching
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // System State Variables
    let useRealWebcam = false;
    let stream = null;
    let isDbDecrypted = false;
    let enrolledUsers = {}; // stores: userId -> { embedding, enrolledAt }
    let offlineLogsQueue = []; // stores pending sync logs
    let syncRetries = 0;
    let animationFrameId = null;

    // Face Detection Engine (MediaPipe Real-Time)
    let faceMesh = null;
    let mediapipeCamera = null;
    let activeLandmarks = null;
    let livenessState = { active: false, stage: 0, userId: null, mode: null };
    
    // Simulated face mesh animation properties (fallback)
    let meshParticles = [];
    const numParticles = 48;
    
    // Initial Configuration
    initMeshParticles();
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Live threshold slider display update
    thresholdSlider.addEventListener('input', () => {
        const display = thresholdSlider.closest('.metric-tile').querySelector('.tile-val');
        if (display) display.textContent = parseFloat(thresholdSlider.value).toFixed(2);
    });
    
    // Tab Switcher Logic
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });

    // 1. Face Mesh Animation Setup
    function resizeCanvas() {
        // Use camera-wrapper parent instead of placeholder (placeholder gets display:none)
        const wrapper = document.querySelector('.camera-wrapper');
        if (wrapper) {
            const rect = wrapper.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
        }
    }

    function initMeshParticles() {
        meshParticles = [];
        for (let i = 0; i < numParticles; i++) {
            // Anchor coordinates simulating a face bounding coordinate structure
            meshParticles.push({
                x: 0,
                y: 0,
                targetX: 0,
                targetY: 0,
                speed: 0.05 + Math.random() * 0.08,
                radius: 1.5 + Math.random() * 2
            });
        }
    }

    function animateMesh() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        // Define base oval facial outline coordinates dynamically
        const faceWidth = 100;
        const faceHeight = 130;
        
        // Render simple connections between nodes
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.06)';
        ctx.lineWidth = 0.8;
        
        // Update nodes around a simulated 3D oval structure
        meshParticles.forEach((p, idx) => {
            const angle = (idx / numParticles) * Math.PI * 2;
            const noise = Math.sin(Date.now() * 0.002 + idx) * 3;
            
            // Outer facial structure coordinates
            if (idx < 20) {
                p.targetX = centerX + Math.cos(angle) * (faceWidth + noise);
                p.targetY = centerY + Math.sin(angle) * (faceHeight + noise);
            } 
            // Eyes
            else if (idx >= 20 && idx < 28) {
                const eyeOffset = idx < 24 ? -35 : 35;
                const eyeAngle = (idx % 4) * (Math.PI / 2);
                p.targetX = centerX + eyeOffset + Math.cos(eyeAngle) * (12 + noise * 0.2);
                p.targetY = centerY - 25 + Math.sin(eyeAngle) * (6 + noise * 0.2);
            }
            // Nose bridge & base
            else if (idx >= 28 && idx < 36) {
                p.targetX = centerX + (Math.sin(idx) * 4);
                p.targetY = centerY - 10 + ((idx - 28) * 6) + noise * 0.5;
            }
            // Lips
            else {
                const lipAngle = ((idx - 36) / 12) * Math.PI * 2;
                p.targetX = centerX + Math.cos(lipAngle) * (30 + noise * 0.5);
                p.targetY = centerY + 35 + Math.sin(lipAngle) * (12 + noise * 0.3);
            }
            
            // Linear interpolation for smooth tracking transitions
            p.x += (p.targetX - p.x) * p.speed;
            p.y += (p.targetY - p.y) * p.speed;
            
            // Draw node point
            ctx.fillStyle = 'rgba(0, 242, 254, 0.3)';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
        });
        
        // Draw mesh grid overlays (connect local clusters)
        ctx.beginPath();
        for (let i = 0; i < numParticles; i++) {
            for (let j = i + 1; j < numParticles; j++) {
                const dist = Math.hypot(meshParticles[i].x - meshParticles[j].x, meshParticles[i].y - meshParticles[j].y);
                // Connect if nearby to form dense mesh look
                if (dist < 35) {
                    ctx.moveTo(meshParticles[i].x, meshParticles[i].y);
                    ctx.lineTo(meshParticles[j].x, meshParticles[j].y);
                }
            }
        }
        ctx.stroke();
        
        animationFrameId = requestAnimationFrame(animateMesh);
    }

    // 2. Camera Integration (MediaPipe Real-Time)
    btnEnableCamera.addEventListener('click', async () => {
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: 640, height: 480 }
            });
            webcam.srcObject = stream;
            webcam.play();
            
            cameraPlaceholder.style.opacity = 0;
            setTimeout(() => {
                cameraPlaceholder.style.display = 'none';
                resizeCanvas();
            }, 500);
            useRealWebcam = true;
            logTerminal('[SYS] Web-camera session successfully established.', 'green');
            
            // Initialize MediaPipe Face Mesh
            faceMesh = new FaceMesh({locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            }});
            faceMesh.setOptions({
                maxNumFaces: 1,
                refineLandmarks: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });
            faceMesh.onResults(onFaceMeshResults);
            
            mediapipeCamera = new Camera(webcam, {
                onFrame: async () => {
                    await faceMesh.send({image: webcam});
                },
                width: 640,
                height: 480
            });
            mediapipeCamera.start();
            logTerminal('[SYS] MediaPipe Face Mesh Engine started.', 'green');
            
        } catch (err) {
            logTerminal('[ERR] Failed to mount camera: ' + err.message, 'red');
            cameraPlaceholder.style.opacity = 0;
            setTimeout(() => cameraPlaceholder.style.display = 'none', 500);
        }
    });

    function onFaceMeshResults(results) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            activeLandmarks = results.multiFaceLandmarks[0];
            
            // Draw real-time wireframe
            ctx.strokeStyle = 'rgba(0, 242, 254, 0.4)';
            ctx.lineWidth = 1;
            activeLandmarks.forEach(point => {
                ctx.beginPath();
                ctx.arc(point.x * canvas.width, point.y * canvas.height, 1, 0, 2 * Math.PI);
                ctx.fillStyle = 'rgba(0, 242, 254, 0.8)';
                ctx.fill();
            });

            if (livenessState.active) {
                processRealTimeLiveness(activeLandmarks);
            }
        } else {
            activeLandmarks = null;
        }
    }
    
    // ==========================================
    // GEOMETRY MATH FOR REAL-TIME ACTIVE LIVENESS
    // ==========================================
    
    /**
     * Calculates the Eye Aspect Ratio (EAR) to detect blinking.
     * Uses the 6 facial landmarks surrounding the left eye.
     * Formula: (Distance between vertical eye points) / (2 * Distance between horizontal eye points)
     * @param {Array} landmarks - 468 MediaPipe FaceMesh landmarks
     * @returns {number} EAR value. A value drops below ~0.22 when the eye closes.
     */
    function computeEAR(landmarks) {
        // Vertical eye distances
        const v1 = Math.hypot(landmarks[160].x - landmarks[144].x, landmarks[160].y - landmarks[144].y);
        const v2 = Math.hypot(landmarks[158].x - landmarks[153].x, landmarks[158].y - landmarks[153].y);
        // Horizontal eye distance
        const h = Math.hypot(landmarks[33].x - landmarks[133].x, landmarks[33].y - landmarks[133].y);
        return (v1 + v2) / (2.0 * h);
    }

    /**
     * Calculates a horizontal smile stretch ratio.
     * Compares the distance between the corners of the mouth to the distance between the outer eyes.
     * This normalization ensures the metric works regardless of how close the user is to the camera.
     * @param {Array} landmarks - 468 MediaPipe FaceMesh landmarks
     * @returns {number} Smile ratio. Resting is typically 0.40 - 0.45. A true smile pushes it > 0.48.
     */
    function computeSmile(landmarks) {
        // Distance between left (308) and right (78) mouth corners
        const mouthWidth = Math.hypot(landmarks[78].x - landmarks[308].x, landmarks[78].y - landmarks[308].y);
        // Distance between left outer eye (263) and right outer eye (33)
        const eyeDist = Math.hypot(landmarks[33].x - landmarks[263].x, landmarks[33].y - landmarks[263].y);
        return mouthWidth / eyeDist;
    }

    /**
     * Detects 3D head yaw (turning left or right).
     * Calculates the ratio of the distance from the nose tip to the left cheek vs the right cheek.
     * @param {Array} landmarks - 468 MediaPipe FaceMesh landmarks
     * @returns {number} Turn ratio. Looking straight is ~1.0. Turning head pushes it <0.7 or >1.3.
     */
    function computeTurn(landmarks) {
        // Distance from nose tip (1) to left cheek border (234)
        const dLeft = Math.hypot(landmarks[1].x - landmarks[234].x, landmarks[1].y - landmarks[234].y);
        // Distance from nose tip (1) to right cheek border (454)
        const dRight = Math.hypot(landmarks[1].x - landmarks[454].x, landmarks[1].y - landmarks[454].y);
        // Adding 0.0001 prevents division by zero
        return dLeft / (dRight + 0.0001);
    }

    // Real Face Detection from Camera Frame
    async function detectFaceInCamera() {
        if (!useRealWebcam || !webcam.srcObject) {
            logTerminal('[DETECT] Camera inactive — bypassing face gate.', 'yellow');
            return true;
        }
        if (activeLandmarks) {
            logTerminal('[DETECT] MediaPipe Face Mesh detected a real face. Proceeding.', 'green');
            return true;
        } else {
            logTerminal('[DETECT] No face detected by MediaPipe. Ensure face is visible.', 'red');
            return false;
        }
    }

    function showNoFaceError() {
        promptInstruction.textContent = "NO FACE DETECTED";
        promptProgress.style.width = '100%';
        similarityScore.textContent = "0.000";
        similarityBar.style.width = "0%";
        similarityStatus.textContent = "REJECTED — NO FACE IN FRAME";
        similarityStatus.className = "similarity-indicator fail";
        logTerminal('[ENGINE] Verification blocked: No human face detected in camera viewport. Ensure face is centered and well-lit.', 'red');
        setTimeout(() => {
            promptInstruction.textContent = "ALIGN FACE IN CENTER";
            promptProgress.style.width = '0%';
        }, 3000);
    }

    // 3. Biometric Logic Simulations
    function generate128Embedding() {
        const arr = [];
        for (let i = 0; i < 128; i++) {
            // Generate normal floating point biometrics
            arr.push(parseFloat((Math.random() * 2 - 1).toFixed(4)));
        }
        // L2 Normalize
        const sumSq = arr.reduce((sum, val) => sum + (val * val), 0);
        const normFactor = Math.sqrt(sumSq);
        return arr.map(val => parseFloat((val / normFactor).toFixed(4)));
    }

    function calculateCosineSimilarity(vecA, vecB) {
        let dotProduct = 0;
        for (let i = 0; i < 128; i++) {
            dotProduct += vecA[i] * vecB[i];
        }
        return Math.min(1.0, Math.max(0.0, dotProduct));
    }

    // Enrollment Event (gated behind face detection)
    btnEnroll.addEventListener('click', async () => {
        const userId = userIdInput.value.trim();
        if (!userId) {
            alert('Please input a valid Employee ID');
            return;
        }

        btnEnroll.disabled = true;
        promptInstruction.textContent = "SCANNING FOR FACE...";
        promptProgress.style.width = '20%';

        // Gate: detect real face before enrolling
        const faceFound = await detectFaceInCamera();
        if (!faceFound) {
            showNoFaceError();
            btnEnroll.disabled = false;
            return;
        }

        promptInstruction.textContent = "CAPTURING FACIAL KEYPOINTS...";
        promptProgress.style.width = '40%';
        
        setTimeout(() => {
            promptInstruction.textContent = "GENERATING EMBEDDING...";
            promptProgress.style.width = '80%';
            
            setTimeout(() => {
                const embedding = generate128Embedding();
                enrolledUsers[userId] = {
                    embedding: embedding,
                    enrolledAt: new Date().toISOString()
                };
                
                // Flush to UI
                updateEnrollmentsTable();
                
                promptInstruction.textContent = "ENROLLMENT COMPLETED SUCCESSFULLY";
                promptProgress.style.width = '100%';
                btnEnroll.disabled = false;
                
                logTerminal(`[DB] Successfully enrolled biometric profile for: ${userId}. Saved to secure SQLCipher store.`, 'green');
                
                setTimeout(() => {
                    promptInstruction.textContent = "ALIGN FACE IN CENTER";
                    promptProgress.style.width = '0%';
                }, 2000);
            }, 1000);
        }, 800);
    });

    // Verification Flow (gated behind face detection)
    btnVerify.addEventListener('click', async () => {
        const userId = userIdInput.value.trim();
        if (!userId) {
            alert('Please input your enrolled employee ID for verification.');
            return;
        }

        if (!enrolledUsers[userId]) {
            logTerminal(`[ENGINE] Rejection: Identity ${userId} not enrolled in localized device database.`, 'red');
            similarityStatus.textContent = "USER NOT ENROLLED";
            similarityStatus.className = "similarity-indicator fail";
            return;
        }

        // Gate: detect real face before verification
        promptInstruction.textContent = "SCANNING FOR FACE...";
        promptProgress.style.width = '10%';
        const faceFound = await detectFaceInCamera();
        if (!faceFound) {
            showNoFaceError();
            return;
        }

        runCompleteVerificationPipeline(userId, 'genuine');
    });

    // Simulate Impostor Mismatch
    btnSimulateMismatch.addEventListener('click', () => {
        const userId = userIdInput.value.trim();
        if (!userId) {
            alert('Please input your enrolled employee ID for verification.');
            return;
        }

        if (!enrolledUsers[userId]) {
            logTerminal(`[ENGINE] Rejection: Identity ${userId} not enrolled in localized device database.`, 'red');
            similarityStatus.textContent = "USER NOT ENROLLED";
            similarityStatus.className = "similarity-indicator fail";
            return;
        }

        runCompleteVerificationPipeline(userId, 'impostor');
    });

    // Simulate Spoof Attack
    btnSimulateSpoof.addEventListener('click', () => {
        const userId = userIdInput.value.trim();
        if (!userId) {
            alert('Please input a target employee ID to simulate spoofing.');
            return;
        }
        runCompleteVerificationPipeline(userId, 'spoof');
    });

    function runCompleteVerificationPipeline(userId, mode) {
        btnVerify.disabled = true;
        btnSimulateMismatch.disabled = true;
        btnSimulateSpoof.disabled = true;
        
        // Reset Indicators
        blinkLed.className = "blink-led";
        smileLed.className = "blink-led";
        turnLed.className = "blink-led";
        activeBlinkStatus.textContent = "WAITING";
        activeSmileStatus.textContent = "WAITING";
        activeTurnStatus.textContent = "WAITING";
        
        // Setup state for real-time tracking
        livenessState = {
            active: true,
            stage: 1, // 1: blink, 2: smile, 3: turn
            userId: userId,
            mode: mode,
            timeout: setTimeout(() => handleLivenessTimeout(), 10000) // 10s to complete all
        };
        
        // Step 1: Passive Liveness CNN (RGB Frame texture analysis)
        promptInstruction.textContent = "ANALYZING FACE TEXTURE...";
        promptProgress.style.width = '20%';
        
        setTimeout(() => {
            if (!livenessState.active) return;
            
            const passiveScore = (mode === 'spoof') 
                ? parseFloat((Math.random() * 2 + 0.5).toFixed(2)) // Very low score for spoof
                : parseFloat((Math.random() * 8 + 92.2).toFixed(2)); // High score for genuine
            
            passiveLivenessScore.textContent = `${passiveScore}% Live`;
            passiveLivenessBar.style.width = `${passiveScore}%`;
            
            if (mode === 'spoof' && passiveScore < 85) {
                clearTimeout(livenessState.timeout);
                livenessState.active = false;
                
                // Set indicators to failed for spoof simulation
                blinkLed.className = "blink-led failed";
                smileLed.className = "blink-led failed";
                turnLed.className = "blink-led failed";
                activeBlinkStatus.textContent = "FAIL";
                activeSmileStatus.textContent = "FAIL";
                activeTurnStatus.textContent = "FAIL";
                
                failVerification(userId, 'Passive texture scan failed. High probability printed spoof.');
                return;
            }
            
            promptInstruction.textContent = "LIVENESS PROMPT: PLEASE BLINK";
            promptProgress.style.width = '40%';
            
            // If camera is inactive, simulate the active liveness checks step-by-step
            if (!useRealWebcam) {
                simulateActiveLivenessSteps(userId, mode);
            }
        }, 800);
    }

    function simulateActiveLivenessSteps(userId, mode) {
        if (mode === 'spoof') return;
        
        // Step 1: Simulate Blink
        setTimeout(() => {
            if (!livenessState.active) return;
            blinkLed.className = "blink-led passed";
            activeBlinkStatus.textContent = "PASS";
            livenessState.stage = 2;
            promptInstruction.textContent = "LIVENESS PROMPT: PLEASE SMILE";
            promptProgress.style.width = '60%';
            
            // Step 2: Simulate Smile
            setTimeout(() => {
                if (!livenessState.active) return;
                smileLed.className = "blink-led passed";
                activeSmileStatus.textContent = "PASS";
                livenessState.stage = 3;
                promptInstruction.textContent = "LIVENESS PROMPT: TURN HEAD SLIGHTLY";
                promptProgress.style.width = '80%';
                
                // Step 3: Simulate Head Turn
                setTimeout(() => {
                    if (!livenessState.active) return;
                    turnLed.className = "blink-led passed";
                    activeTurnStatus.textContent = "PASS";
                    livenessState.stage = 4;
                    clearTimeout(livenessState.timeout);
                    finalizeVerificationMatch();
                }, 800);
            }, 800);
        }, 800);
    }
    
    /**
     * Real-Time Active Liveness State Machine.
     * This function is triggered 30-60 times a second by the MediaPipe onResults callback.
     * It actively monitors the user's facial geometry and advances the pipeline state
     * ONLY when the required physical action (Blink -> Smile -> Turn) crosses the mathematical threshold.
     * 
     * @param {Array} landmarks - Real-time 3D coordinate array from MediaPipe
     */
    function processRealTimeLiveness(landmarks) {
        const mode = livenessState.mode;
        
        // Anti-Spoofing: If simulating a static spoof, it is mathematically impossible to pass active tracking.
        // We simulate a failure by ignoring any geometry changes and letting the 10s timer expire.
        if (mode === 'spoof') return; 

        if (livenessState.stage === 1) {
            // Check Blink
            const ear = computeEAR(landmarks);
            if (ear < 0.22) { // Blink detected
                blinkLed.className = "blink-led passed";
                activeBlinkStatus.textContent = "PASS";
                livenessState.stage = 2;
                promptInstruction.textContent = "LIVENESS PROMPT: PLEASE SMILE";
                promptProgress.style.width = '60%';
            }
        } 
        else if (livenessState.stage === 2) {
            // Check Smile
            const smileRatio = computeSmile(landmarks);
            // Typically resting ratio is ~0.40 - 0.45. A smile stretches it above 0.48.
            if (smileRatio > 0.48) { 
                smileLed.className = "blink-led passed";
                activeSmileStatus.textContent = "PASS";
                livenessState.stage = 3;
                promptInstruction.textContent = "LIVENESS PROMPT: TURN HEAD SLIGHTLY";
                promptProgress.style.width = '80%';
            }
        }
        else if (livenessState.stage === 3) {
            // Check Head Turn
            const turnRatio = computeTurn(landmarks);
            if (turnRatio > 1.3 || turnRatio < 0.7) { // Turned
                turnLed.className = "blink-led passed";
                activeTurnStatus.textContent = "PASS";
                livenessState.stage = 4;
                clearTimeout(livenessState.timeout);
                finalizeVerificationMatch();
            }
        }
    }
    
    function handleLivenessTimeout() {
        if (!livenessState.active) return;
        livenessState.active = false;
        failVerification(livenessState.userId, 'Active liveness challenge timed out. Spoof detected.');
    }
    
    function finalizeVerificationMatch() {
        livenessState.active = false;
        promptInstruction.textContent = "COMPUTING BIOMETRIC SIMILARITY...";
        promptProgress.style.width = '90%';
        
        setTimeout(() => {
            const userId = livenessState.userId;
            const template = enrolledUsers[userId].embedding;
            
            // Generate probe
            let probe;
            if (livenessState.mode === 'impostor' || livenessState.mode === 'spoof') {
                probe = generate128Embedding(); // completely different vector
            } else {
                probe = template.map(v => parseFloat((v + (Math.random() * 0.08 - 0.04)).toFixed(4)));
                const sumSq = probe.reduce((sum, val) => sum + (val * val), 0);
                const normFactor = Math.sqrt(sumSq);
                probe = probe.map(val => parseFloat((val / normFactor).toFixed(4)));
            }
            
            const similarity = calculateCosineSimilarity(template, probe);
            const threshold = parseFloat(thresholdSlider.value);
            
            similarityScore.textContent = similarity.toFixed(3);
            similarityBar.style.width = `${similarity * 100}%`;
            
            const timingDetect = Math.floor(Math.random() * 15 + 50);
            const timingLiveness = Math.floor(Math.random() * 10 + 30);
            const timingNet = Math.floor(Math.random() * 20 + 75);
            const timingTotal = timingDetect + timingLiveness + timingNet;
            
            latencyStats.innerHTML = `
                <div>Face Detection:  ${timingDetect} ms</div>
                <div>Liveness Check:   ${timingLiveness} ms</div>
                <div>MobileFaceNet:    ${timingNet} ms</div>
                <div class="total-latency">Total E2E Delay:  ${timingTotal} ms</div>
            `;
            
            if (similarity >= threshold) {
                similarityStatus.textContent = "AUTHENTICATION SUCCESS";
                similarityStatus.className = "similarity-indicator pass";
                promptInstruction.textContent = "IDENTITY CONFIRMED";
                promptProgress.style.width = '100%';
                
                logTerminal(`[ENGINE] Face Auth successful: ${userId} (Similarity: ${similarity.toFixed(3)} >= ${threshold})`, 'green');
                queueOfflineAttendance(userId, 'PASS', 'SUCCESS');
            } else {
                similarityStatus.textContent = "FACE MISMATCH / IMPOSTOR";
                similarityStatus.className = "similarity-indicator fail";
                promptInstruction.textContent = "ACCESS DENIED";
                promptProgress.style.width = '100%';
                
                logTerminal(`[ENGINE] Match Rejected: Similarity ${similarity.toFixed(3)} below threshold ${threshold}`, 'red');
                queueOfflineAttendance(userId, 'PASS', 'FAILED_MISMATCH');
            }
            
            resetButtons();
        }, 500);
    }

    function failVerification(userId, reason) {
        similarityScore.textContent = "0.000";
        similarityBar.style.width = "0%";
        similarityStatus.textContent = "LIVENESS FAILED";
        similarityStatus.className = "similarity-indicator fail";
        promptInstruction.textContent = "SPOOF DETECTED";
        promptProgress.style.width = '100%';
        
        logTerminal(`[ENGINE] Verification Blocked: ${reason}`, 'red');
        queueOfflineAttendance(userId, 'FAIL_SPOOF', 'DENIED_LIVENESS');
        resetButtons();
    }

    function resetButtons() {
        btnVerify.disabled = false;
        btnSimulateMismatch.disabled = false;
        btnSimulateSpoof.disabled = false;
        setTimeout(() => {
            promptInstruction.textContent = "ALIGN FACE IN CENTER";
            promptProgress.style.width = '0%';
        }, 3000);
    }

    // 4. Offline Log Queue Management
    function queueOfflineAttendance(userId, liveness, verifyResult) {
        const logId = 'LOG_' + Math.floor(Math.random() * 90000 + 10000);
        const gps = (Math.random() * 0.1 + 13.5).toFixed(4) + '° N, ' + (Math.random() * 0.1 + 79.9).toFixed(4) + '° E';
        
        const logEntry = {
            logId: logId,
            userId: userId,
            timestamp: Date.now(),
            liveness: liveness,
            verifyResult: verifyResult,
            gps: gps
        };
        
        offlineLogsQueue.push(logEntry);
        updateLogsTable();
        
        logTerminal(`[DB] Logged offline attendance record ${logId} in encrypted local SQLite database.`, 'cyan');
        
        // Auto-sync trigger if internet is toggled online
        if (networkToggle.checked) {
            triggerAwsSyncPipeline();
        }
    }

    function updateLogsTable() {
        queueSizeBadge.textContent = offlineLogsQueue.length;
        
        if (offlineLogsQueue.length === 0) {
            logsTable.innerHTML = `
                <tr class="placeholder-row">
                    <td colspan="5">No offline session logs pending sync.</td>
                </tr>
            `;
            return;
        }

        logsTable.innerHTML = '';
        offlineLogsQueue.forEach(log => {
            const row = document.createElement('tr');
            row.id = `row-${log.logId}`;
            row.innerHTML = `
                <td>${log.logId}</td>
                <td>${log.userId}</td>
                <td><span class="badge" style="color: ${log.liveness === 'PASS' ? 'var(--success)' : 'var(--error)'}">${log.liveness}</span></td>
                <td><span class="badge" style="color: ${log.verifyResult === 'SUCCESS' ? 'var(--success)' : 'var(--error)'}">${log.verifyResult}</span></td>
                <td class="font-mono">${log.gps}</td>
            `;
            logsTable.appendChild(row);
        });
    }

    // 5. Encrypted Database Decryption Visualization
    btnToggleDecryption.addEventListener('click', () => {
        isDbDecrypted = !isDbDecrypted;
        btnToggleDecryption.textContent = isDbDecrypted ? "🔒 ENCRYPT VIEW" : "🔓 DECRYPT VIEW";
        btnToggleDecryption.classList.toggle('btn-accent', isDbDecrypted);
        
        updateEnrollmentsTable();
        updateLogsTable();
        
        logTerminal(`[SYS] SQLCipher database view set to: ${isDbDecrypted ? 'DECRYPTED' : 'AES-256 ENCRYPTED'}`, 'cyan');
    });

    function updateEnrollmentsTable() {
        const userIds = Object.keys(enrolledUsers);
        
        if (userIds.length === 0) {
            enrollmentsTable.innerHTML = `
                <tr class="placeholder-row">
                    <td colspan="3">Secure database active. No biometrics enrolled yet.</td>
                </tr>
            `;
            return;
        }

        enrollmentsTable.innerHTML = '';
        userIds.forEach(uid => {
            const u = enrolledUsers[uid];
            const row = document.createElement('tr');
            
            // Generate visual hex blocks for encrypted vectors
            let vectorDisplay = '';
            if (isDbDecrypted) {
                const shortVec = u.embedding.slice(0, 4).join(', ') + '... (128-d)';
                vectorDisplay = `<span class="decrypted-anim font-mono">[${shortVec}]</span>`;
            } else {
                vectorDisplay = `<span class="encrypted-block">AES_256_HEX[${uid.substring(0,4)}...${Math.random().toString(16).substring(2,10).toUpperCase()}]</span>`;
            }
            
            row.innerHTML = `
                <td><strong>${uid}</strong></td>
                <td>${vectorDisplay}</td>
                <td class="font-mono">${new Date(u.enrolledAt).toLocaleTimeString()}</td>
            `;
            enrollmentsTable.appendChild(row);
        });
    }

    // 6. AWS Sync Pipeline (Exponential Back-Off Retry Logic)
    networkToggle.addEventListener('change', () => {
        const isOnline = networkToggle.checked;
        const offlineText = document.querySelector('.switch-text.offline');
        const onlineText = document.querySelector('.switch-text.online');
        
        offlineText.classList.toggle('active', !isOnline);
        onlineText.classList.toggle('active', isOnline);
        
        logTerminal(`[SYS] Network connectivity status updated to: ${isOnline ? 'CONNECTED' : 'DISCONNECTED'}`, isOnline ? 'green' : 'red');
        
        if (isOnline && offlineLogsQueue.length > 0) {
            triggerAwsSyncPipeline();
        }
    });

    btnManualSync.addEventListener('click', () => {
        triggerAwsSyncPipeline();
    });

    async function triggerAwsSyncPipeline() {
        if (offlineLogsQueue.length === 0) {
            alert('No pending sync logs inside SQLite store.');
            return;
        }

        if (!networkToggle.checked) {
            logTerminal('[ERR] Sync failed. Device operating in zero-connectivity environment.', 'red');
            simulateRetryBackoff();
            return;
        }

        logTerminal(`[SYNC] Restored channel. Initiating upload of ${offlineLogsQueue.length} records to local AWS API Gateway Mock...`, 'cyan');
        btnManualSync.disabled = true;
        
        try {
            const payload = offlineLogsQueue.map(log => ({
                id: log.logId,
                userId: log.userId,
                timestamp: log.timestamp,
                status: log.verifyResult,
                livenessResult: log.liveness,
                location: log.gps
            }));

            const response = await fetch('http://localhost:3000/v1/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ logs: payload })
            });

            if (response.ok) {
                const data = await response.json();
                logTerminal('[API-GATEWAY] POST http://localhost:3000/v1/sync - HTTP 202 ACCEPTED', 'green');
                logTerminal(`[SYNC] Server ACK received. ${data.synced_ids.length} records successfully written to DB.`, 'cyan');
                
                // Pure database records with clean fade transition
                offlineLogsQueue.forEach(log => {
                    const row = document.getElementById(`row-${log.logId}`);
                    if (row) {
                        row.style.transition = 'all 0.5s ease';
                        row.style.transform = 'translateX(50px)';
                        row.style.opacity = '0';
                    }
                });

                setTimeout(() => {
                    logTerminal(`[DB] SQLCipher VACUUM triggered. Local memory blocks completely purged.`, 'cyan');
                    offlineLogsQueue = [];
                    syncRetries = 0;
                    syncRetriesBadge.textContent = '0';
                    updateLogsTable();
                    btnManualSync.disabled = false;
                }, 600);
            } else {
                throw new Error('Server returned ' + response.status);
            }
        } catch (error) {
            logTerminal(`[API-GATEWAY] Sync failed: ${error.message}. Network unreachable or server error.`, 'red');
            simulateRetryBackoff();
            btnManualSync.disabled = false;
        }
    }

    function simulateRetryBackoff() {
        syncRetries++;
        syncRetriesBadge.textContent = syncRetries;
        
        const delay = Math.pow(2, syncRetries);
        logTerminal(`[SYNC-RETRY] Gated back-off activated. Schedule next retry trigger in ${delay}s...`, 'yellow');
        
        // Simulate waiting console logging
        setTimeout(() => {
            if (!networkToggle.checked) {
                logTerminal(`[SYNC-RETRY] Retrying connection block... (Retry #${syncRetries} failed)`, 'yellow');
                if (syncRetries < 5) {
                    simulateRetryBackoff();
                } else {
                    logTerminal(`[SYNC-MAX] Peak back-off retries reached. Sync pipeline suspended until network state toggled.`, 'red');
                    btnManualSync.disabled = false;
                }
            } else {
                triggerAwsSyncPipeline();
            }
        }, delay * 1000);
    }

    // Helper Console Logging
    function logTerminal(text, color = 'muted') {
        const timeStr = new Date().toLocaleTimeString();
        let colorStyle = '#8892b0';
        if (color === 'green') colorStyle = 'var(--success)';
        if (color === 'red') colorStyle = 'var(--error)';
        if (color === 'cyan') colorStyle = 'var(--primary-cyan)';
        if (color === 'yellow') colorStyle = 'var(--warning)';
        
        awsConsole.innerHTML += `<div style="color: ${colorStyle}">[${timeStr}] ${text}</div>`;
        awsConsole.scrollTop = awsConsole.scrollHeight;
    }

    // Load static mock dataset to begin
    enrolledUsers['EMP_8842'] = {
        embedding: generate128Embedding(),
        enrolledAt: new Date(Date.now() - 3600000 * 24).toISOString()
    };
    enrolledUsers['EMP_7419'] = {
        embedding: generate128Embedding(),
        enrolledAt: new Date(Date.now() - 3600000 * 48).toISOString()
    };
    updateEnrollmentsTable();
});

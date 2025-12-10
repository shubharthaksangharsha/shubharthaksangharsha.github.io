/**
 * Apsara Widget - Compact Voice Assistant
 * Reuses the core functionality from app.js but with widget UI
 */

// Configuration - automatically switch between local and production
const BACKEND_WS_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'wss://apsara-devshubh.devshubh.me'  // Use Oracle backend even for local testing
    : 'wss://apsara-devshubh.devshubh.me';

// State
let ws = null;
let audioContext = null;
let microphone = null;
let processor = null;
let isConnected = false;
let isListening = false;
let audioQueue = [];
let isPlaying = false;

// Audio visualization
let visualizerContext = null;
let analyser = null;
let dataArray = null;
let bufferLength = null;

// Widget state
let isExpanded = false;

// Mobile-optimized audio playback
let playbackContext = null;
let nextPlayTime = 0;
let scheduledSources = [];

// Detect mobile device
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// DOM Elements
const widgetPanel = document.getElementById('widgetPanel');
const widgetText = document.getElementById('widgetText');
const muteButton = document.getElementById('muteButton');
const endButton = document.getElementById('endButton');
const miniOrb = document.getElementById('miniOrb');
const miniVisualizer = document.getElementById('miniVisualizer');

// Mute state
let isMicMuted = false;

// Initialize
function init() {
    setupVisualizerCanvas();
    setupEventListeners();
}

function setupVisualizerCanvas() {
    miniVisualizer.width = 45;
    miniVisualizer.height = 45;
    visualizerContext = miniVisualizer.getContext('2d');
}

function setupEventListeners() {
    widgetPanel.addEventListener('click', handleWidgetClick);
    muteButton.addEventListener('click', handleMuteToggle);
    endButton.addEventListener('click', handleEndClick);
}

// Widget Controls
async function handleWidgetClick(e) {
    // Don't start if clicking buttons
    if (e.target.closest('.end-button') || e.target.closest('.mute-button')) {
        return;
    }
    
    if (!isConnected) {
        await handleStartClick();
    }
}

function handleMuteToggle(e) {
    e.stopPropagation();
    
    isMicMuted = !isMicMuted;
    
    // Toggle SVG icons
    const micOnIcon = muteButton.querySelector('.mic-on');
    const micOffIcon = muteButton.querySelector('.mic-off');
    
    if (isMicMuted) {
        micOnIcon.style.display = 'none';
        micOffIcon.style.display = 'block';
        muteButton.classList.add('muted');
        muteButton.title = 'Unmute microphone';
    } else {
        micOnIcon.style.display = 'block';
        micOffIcon.style.display = 'none';
        muteButton.classList.remove('muted');
        muteButton.title = 'Mute microphone';
    }
}

// WebSocket Connection (same as app.js)
async function connectToBackend() {
    return new Promise((resolve, reject) => {
        try {
            ws = new WebSocket(BACKEND_WS_URL);

            ws.onopen = () => {
                console.log('Connected to backend');
                updateStatus('Connected', 'connected');
                isConnected = true;
                resolve();
            };

            ws.onmessage = async (event) => {
                const message = JSON.parse(event.data);
                handleBackendMessage(message);
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                updateStatus('Connection Error', 'error');
                reject(error);
            };

            ws.onclose = () => {
                console.log('Disconnected from backend');
                isConnected = false;
                isListening = false;
                updateStatus('Disconnected', 'error');
                stopMicrophone();
            };
        } catch (error) {
            reject(error);
        }
    });
}

function handleBackendMessage(message) {
    switch (message.type) {
        case 'status':
            if (message.status === 'connected') {
                updateStatus('Ready', 'connected');
            }
            break;

        case 'gemini_message':
            handleGeminiMessage(message.data);
            break;

        case 'error':
            console.error('Backend error:', message.error);
            updateStatus('Error: ' + message.error, 'error');
            break;
    }
}

function handleGeminiMessage(data) {
    // Handle audio response
    if (data.data) {
        addAudioToQueue(data.data);
    }

    // Handle server content
    if (data.serverContent) {
        if (data.serverContent.interrupted) {
            stopAudioPlayback();
            updateStatus('Listening...');
        }

        if (data.serverContent.turnComplete) {
            miniOrb.classList.remove('speaking');
            miniOrb.classList.add('listening');
        }
    }

    // Tool calls happen silently in the background
}

// Microphone Setup (same as app.js)
async function startMicrophone() {
    try {
        // Check if getUserMedia is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Browser does not support microphone access. Please use Chrome or Firefox with HTTPS.');
        }

        audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: 16000
        });

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                sampleRate: 16000,
                echoCancellation: true,
                noiseSuppression: true
            }
        });

        microphone = audioContext.createMediaStreamSource(stream);
        
        // Set up analyser for visualization
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        microphone.connect(analyser);

        // Set up audio processor
        processor = audioContext.createScriptProcessor(4096, 1, 1);
        microphone.connect(processor);
        processor.connect(audioContext.destination);

        processor.onaudioprocess = (e) => {
            if (!isListening || !ws || ws.readyState !== WebSocket.OPEN || isMicMuted) return; // Don't send if muted

            const inputData = e.inputBuffer.getChannelData(0);
            
            // Convert to 16-bit PCM
            const pcmData = convertToPCM16(inputData);
            const base64Audio = btoa(String.fromCharCode(...new Uint8Array(pcmData)));

            // Send to backend
            ws.send(JSON.stringify({
                type: 'audio',
                data: base64Audio
            }));
        };

        isListening = true;
        startVisualization();
        updateStatus('Listening...', 'listening');
        miniOrb.classList.add('listening');

    } catch (error) {
        console.error('Microphone error:', error);
        updateStatus('Microphone Error', 'error');
    }
}

function stopMicrophone() {
    if (processor) {
        processor.disconnect();
        processor = null;
    }
    if (microphone) {
        microphone.disconnect();
        microphone.mediaStream.getTracks().forEach(track => track.stop());
        microphone = null;
    }
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    isListening = false;
    miniOrb.classList.remove('listening', 'speaking');
}

// Audio Conversion
function convertToPCM16(float32Array) {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buffer;
}

// Audio Playback - Mobile Optimized with Seamless Streaming
function addAudioToQueue(base64Audio) {
    audioQueue.push(base64Audio);
    if (!isPlaying) {
        processAudioQueue();
    }
}

// Initialize persistent playback context (called on user gesture/start)
async function initPlaybackContext() {
    if (!playbackContext || playbackContext.state === 'closed') {
        playbackContext = new (window.AudioContext || window.webkitAudioContext)({ 
            sampleRate: 24000,
            latencyHint: isMobile ? 'playback' : 'interactive'
        });
        // Reset the play time when creating new context
        nextPlayTime = 0;
    }
    
    // Resume if suspended (required for mobile browsers after user gesture)
    if (playbackContext.state === 'suspended') {
        await playbackContext.resume();
    }
    
    return playbackContext;
}

async function processAudioQueue() {
    if (audioQueue.length === 0) {
        // Check if there's still scheduled audio playing
        if (scheduledSources.length > 0 && playbackContext) {
            const currentTime = playbackContext.currentTime;
            const hasActiveAudio = scheduledSources.some(item => item.endTime > currentTime);
            if (hasActiveAudio) {
                setTimeout(() => processAudioQueue(), 50);
                return;
            }
        }
        isPlaying = false;
        miniOrb.classList.remove('speaking');
        miniOrb.classList.add('listening');
        updateStatus('Listening...');
        return;
    }

    isPlaying = true;
    miniOrb.classList.remove('listening');
    miniOrb.classList.add('speaking');
    updateStatus('Talk to interrupt');

    // Ensure playback context is initialized and resumed
    await initPlaybackContext();

    // Process ONE audio chunk at a time, then schedule next check
    const base64Audio = audioQueue.shift();
    
    try {
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Create audio buffer from PCM16 data
        const audioBuffer = playbackContext.createBuffer(1, bytes.length / 2, 24000);
        const channelData = audioBuffer.getChannelData(0);

        const dataView = new DataView(bytes.buffer);
        for (let i = 0; i < channelData.length; i++) {
            const int16 = dataView.getInt16(i * 2, true);
            channelData[i] = int16 / 32768.0;
        }

        // Schedule this buffer to play after the previous one finishes
        scheduleAudioBuffer(audioBuffer);
    } catch (error) {
        console.error('Audio decode error:', error);
    }
    
    // Continue processing queue faster
    setTimeout(() => processAudioQueue(), 5);
}

function scheduleAudioBuffer(audioBuffer) {
    if (!playbackContext || playbackContext.state === 'closed') return;
    
    const source = playbackContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(playbackContext.destination);
    
    const currentTime = playbackContext.currentTime;
    
    // IMPORTANT: Schedule audio sequentially, not overlapping
    // If nextPlayTime is in the past or not set, start from now with minimal buffer
    if (nextPlayTime <= currentTime) {
        nextPlayTime = currentTime + 0.01; // 10ms buffer
    }
    
    const scheduleTime = nextPlayTime;
    
    try {
        source.start(scheduleTime);
    } catch (e) {
        console.error('Audio start error:', e);
        return;
    }
    
    // Calculate when this buffer will END
    const endTime = scheduleTime + audioBuffer.duration;
    
    // Track scheduled source for cleanup
    scheduledSources.push({
        source: source,
        endTime: endTime
    });
    
    // IMPORTANT: Next audio should start right after this one ends (seamless)
    nextPlayTime = endTime;
    
    // Clean up old finished sources
    scheduledSources = scheduledSources.filter(item => item.endTime > currentTime);
}

function stopAudioPlayback() {
    audioQueue = [];
    isPlaying = false;
    
    // Stop all scheduled sources
    scheduledSources.forEach(item => {
        try {
            item.source.stop();
        } catch (e) {
            // Source may already be stopped
        }
    });
    scheduledSources = [];
    
    // Reset next play time
    if (playbackContext) {
        nextPlayTime = playbackContext.currentTime;
    }
}

// Visualization
function startVisualization() {
    function draw() {
        if (!isListening) {
            visualizerContext.clearRect(0, 0, miniVisualizer.width, miniVisualizer.height);
            return;
        }

        requestAnimationFrame(draw);
        
        // Don't visualize when muted
        if (isMicMuted) {
            visualizerContext.clearRect(0, 0, miniVisualizer.width, miniVisualizer.height);
            return;
        }

        analyser.getByteFrequencyData(dataArray);

        visualizerContext.clearRect(0, 0, miniVisualizer.width, miniVisualizer.height);

        // Draw circular audio bars (very small for inline widget)
        const centerX = miniVisualizer.width / 2;
        const centerY = miniVisualizer.height / 2;
        const radius = 20;
        const bars = 20;

        for (let i = 0; i < bars; i++) {
            const angle = (i / bars) * Math.PI * 2;
            const dataIndex = Math.floor((i / bars) * bufferLength);
            const height = (dataArray[dataIndex] / 255) * 8;

            const x1 = centerX + Math.cos(angle) * radius;
            const y1 = centerY + Math.sin(angle) * radius;
            const x2 = centerX + Math.cos(angle) * (radius + height);
            const y2 = centerY + Math.sin(angle) * (radius + height);

            const gradient = visualizerContext.createLinearGradient(x1, y1, x2, y2);
            gradient.addColorStop(0, '#FFD700');
            gradient.addColorStop(0.5, '#FFA500');
            gradient.addColorStop(1, '#32CD32');

            visualizerContext.strokeStyle = gradient;
            visualizerContext.lineWidth = 2;
            visualizerContext.lineCap = 'round';

            visualizerContext.beginPath();
            visualizerContext.moveTo(x1, y1);
            visualizerContext.lineTo(x2, y2);
            visualizerContext.stroke();
        }
    }

    draw();
}

// UI Updates
function updateStatus(text) {
    widgetText.textContent = text;
}

// Event Handlers
async function handleStartClick() {
    try {
        updateStatus('Connecting...');
        muteButton.style.display = 'none';
        endButton.style.display = 'none';
        
        // Initialize playback context on user gesture (required for mobile)
        await initPlaybackContext();
        
        await connectToBackend();
        await startMicrophone();
        updateStatus('Listening...');
        muteButton.style.display = 'flex';
        endButton.style.display = 'flex';
    } catch (error) {
        console.error('Failed to start:', error);
        updateStatus('Error - Try again');
        muteButton.style.display = 'none';
        endButton.style.display = 'none';
    }
}

function handleEndClick(e) {
    e.stopPropagation();
    
    // Stop everything
    stopMicrophone();
    stopAudioPlayback();
    
    if (ws) {
        ws.close();
    }
    
    // Close playback context to save resources
    if (playbackContext && playbackContext.state !== 'closed') {
        playbackContext.close();
        playbackContext = null;
    }

    miniOrb.classList.remove('listening', 'speaking');
    updateStatus('Talk to Apsara');
    muteButton.style.display = 'none';
    endButton.style.display = 'none';
    isConnected = false;
    
    // Reset mute state
    isMicMuted = false;
    const micOnIcon = muteButton.querySelector('.mic-on');
    const micOffIcon = muteButton.querySelector('.mic-off');
    micOnIcon.style.display = 'block';
    micOffIcon.style.display = 'none';
    muteButton.classList.remove('muted');
}

// Initialize on load
init();

// Handle page visibility changes (mobile browsers suspend audio when app is backgrounded)
document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && isConnected) {
        // Resume audio context when page becomes visible again
        if (playbackContext && playbackContext.state === 'suspended') {
            try {
                await playbackContext.resume();
                console.log('Playback context resumed after visibility change');
            } catch (e) {
                console.error('Failed to resume playback context:', e);
            }
        }
        if (audioContext && audioContext.state === 'suspended') {
            try {
                await audioContext.resume();
                console.log('Audio context resumed after visibility change');
            } catch (e) {
                console.error('Failed to resume audio context:', e);
            }
        }
    }
});


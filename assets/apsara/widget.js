/**
 * Apsara Widget - Compact Voice Assistant
 * Client-side widget connected to Apsara Live backend (wss://apsara-devshubh.devshubh.me)
 * Knowledge base context:
 * - Master of AI & ML, University of Adelaide (GPA: 6.5 / 7.0)
 * - Capstone Research: Action-Conditioned RSSM World Models & Hybrid CEM Planner for Unitree Go2 Quadruped Sim-to-Real Navigation
 * - Client Work & Multimodal AI: Aura AI (Aura Boxed Gifts), Wyndham AI (Wyndham Financial Group)
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
let shouldEndAfterTurn = false;
let pendingGracefulEnd = false;
let farewellAudioStarted = false;
let gracefulEndFallbackTimer = null;

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

// Portfolio section helpers (shared by Apsara tools)
const SECTION_ID_MAP = {
    intro: 'intro',
    welcome: 'intro',
    about: 'info',
    info: 'info',
    projects: 'projects',
    freelance: 'freelance',
    work: 'work',
    experience: 'work',
    skills: 'skills',
    education: 'education',
    contact: 'contact'
};

const EXTERNAL_LINKS = {
    github: 'https://github.com/shubharthaksangharsha',
    linkedin: 'https://www.linkedin.com/in/shubharthaksangharsha',
    resume: new URL('/myresume.pdf', window.location.origin).href,
    email: 'mailto:contact@devshubh.me',
    website: 'https://devshubh.me/',
    aura: 'https://auraboxedgifts.in/',
    w13: 'https://w13projects.com/',
    auzfinance: 'https://auzfinance.com/',
    baaz: 'https://baazelectrical.github.io/',
    wyndham: 'https://wyndhamfinancialgroup.com.au/'
};

const CONTACT_VALUES = {
    email: 'contact@devshubh.me',
    linkedin: 'https://www.linkedin.com/in/shubharthaksangharsha',
    github: 'https://github.com/shubharthaksangharsha'
};

let highlightTimer = null;

function resolveSectionId(sectionKey) {
    if (!sectionKey) return null;
    return SECTION_ID_MAP[String(sectionKey).toLowerCase().trim()] || null;
}

function isPortfolioHomePage() {
    const path = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
    return path === '/' || path.endsWith('/index.html') || path.endsWith('index.html');
}

function homeUrlForSection(sectionId) {
    // Keep relative so GitHub Pages project sites and custom domain both work
    if (isPortfolioHomePage()) {
        return `#${sectionId}`;
    }
    const base = window.location.pathname.includes('/projects')
        ? window.location.pathname.replace(/projects\.html?$/i, '')
        : '/';
    const prefix = base.endsWith('/') ? base : `${base}/`;
    return `${prefix}index.html#${sectionId}`;
}

function getMobileNavOffset() {
    // Fixed top sidebar/nav on tablet/mobile needs extra scroll clearance
    if (window.matchMedia('(max-width: 980px)').matches) {
        const sidebar = document.getElementById('sidebar');
        const navHeight = sidebar ? sidebar.getBoundingClientRect().height : 56;
        return Math.max(navHeight + 12, 64);
    }
    return 16;
}

function scrollToSectionElement(el) {
    const offset = getMobileNavOffset();
    const rect = el.getBoundingClientRect();
    const absoluteTop = rect.top + (window.pageYOffset || document.documentElement.scrollTop || 0);
    const target = Math.max(absoluteTop - offset, 0);

    window.scrollTo({
        top: target,
        behavior: 'smooth'
    });
}

function pulseHighlight(el) {
    if (!el) return;
    document.querySelectorAll('.apsara-section-highlight').forEach((node) => {
        node.classList.remove('apsara-section-highlight');
    });
    // Force reflow so re-triggering the same section animates again
    void el.offsetWidth;
    el.classList.add('apsara-section-highlight');
    if (highlightTimer) clearTimeout(highlightTimer);
    highlightTimer = setTimeout(() => {
        el.classList.remove('apsara-section-highlight');
        highlightTimer = null;
    }, 2200);
}

function navigateToSection(sectionKey, highlight = true) {
    const sectionId = resolveSectionId(sectionKey);
    if (!sectionId) {
        return { success: false, error: 'unknown_section', section: sectionKey };
    }

    const el = document.getElementById(sectionId);
    if (!el) {
        // On projects.html (or other pages), jump to homepage section
        window.location.assign(homeUrlForSection(sectionId));
        return { success: true, redirected: true, section: sectionId };
    }

    scrollToSectionElement(el);
    if (highlight) {
        // Delay highlight slightly so it lands after scroll begins (mobile + laptop)
        setTimeout(() => pulseHighlight(el), 280);
    }
    return { success: true, section: sectionId, highlighted: !!highlight };
}

function highlightSection(sectionKey) {
    const sectionId = resolveSectionId(sectionKey);
    if (!sectionId) {
        return { success: false, error: 'unknown_section', section: sectionKey };
    }

    const el = document.getElementById(sectionId);
    if (!el) {
        window.location.assign(homeUrlForSection(sectionId));
        return { success: true, redirected: true, section: sectionId };
    }

    const rect = el.getBoundingClientRect();
    const fullyOffscreen = rect.bottom < 80 || rect.top > window.innerHeight - 80;
    if (fullyOffscreen) {
        scrollToSectionElement(el);
        setTimeout(() => pulseHighlight(el), 280);
    } else {
        pulseHighlight(el);
    }
    return { success: true, section: sectionId };
}

function openExternalLink(destination) {
    const key = String(destination || '').toLowerCase().trim();
    const url = EXTERNAL_LINKS[key];
    if (!url) {
        return { success: false, error: 'unknown_destination', destination };
    }

    // mailto/tel leave the page in place (open mail/dialer) — safe for Apsara session
    if (url.startsWith('mailto:') || url.startsWith('tel:')) {
        window.location.href = url;
        return { success: true, destination: key, url };
    }

    // Always open http(s) in a NEW tab so this page (and Apsara) stays alive.
    // Never fall back to same-tab navigation.
    let opened = null;
    try {
        opened = window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
        console.warn('window.open blocked:', err);
    }

    if (!opened) {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        return { success: true, destination: key, url, method: 'anchor_new_tab' };
    }

    return { success: true, destination: key, url, method: 'window_open' };
}

function clearGracefulEndTimers() {
    if (gracefulEndFallbackTimer) {
        clearTimeout(gracefulEndFallbackTimer);
        gracefulEndFallbackTimer = null;
    }
}

function finalizeGracefulEnd() {
    if (!pendingGracefulEnd && !shouldEndAfterTurn) return;
    pendingGracefulEnd = false;
    shouldEndAfterTurn = false;
    farewellAudioStarted = false;
    clearGracefulEndTimers();
    updateStatus('Goodbye!');
    setTimeout(() => {
        handleEndClick({ stopPropagation: () => {} });
    }, 500);
}

function armGracefulEnd() {
    pendingGracefulEnd = true;
    // If goodbye audio is already playing/queued (speak-then-tool), count it
    const hasActiveScheduled = !!(playbackContext && scheduledSources.some((item) => item.endTime > playbackContext.currentTime));
    farewellAudioStarted = isPlaying || audioQueue.length > 0 || hasActiveScheduled;
    shouldEndAfterTurn = false;
    updateStatus('Saying goodbye...');
    clearGracefulEndTimers();
    // Safety net if model never sends farewell audio
    gracefulEndFallbackTimer = setTimeout(() => {
        console.warn('Graceful end fallback — closing after timeout');
        finalizeGracefulEnd();
    }, 14000);

    // If farewell is already in progress, close once it drains
    if (farewellAudioStarted) {
        shouldEndAfterTurn = true;
        setTimeout(() => processAudioQueue(), 50);
    }
}

function getVisibleSectionContext() {
    const ids = ['intro', 'info', 'projects', 'freelance', 'work', 'skills', 'education', 'contact'];
    const viewportMid = window.innerHeight * 0.35;
    let best = null;
    let bestScore = Number.POSITIVE_INFINITY;

    ids.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) return;
        const score = Math.abs(rect.top - viewportMid);
        if (score < bestScore) {
            bestScore = score;
            best = id;
        }
    });

    const sectionKey = best === 'info' ? 'about' : best;
    return {
        success: true,
        page: isPortfolioHomePage() ? 'home' : (window.location.pathname || ''),
        sectionId: best,
        section: sectionKey || null,
        scrollY: Math.round(window.pageYOffset || document.documentElement.scrollTop || 0),
        viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
            isMobileLayout: window.matchMedia('(max-width: 980px)').matches
        }
    };
}

async function copyContactInfo(field) {
    const key = String(field || '').toLowerCase().trim();
    const value = CONTACT_VALUES[key];
    if (!value) {
        return { success: false, error: 'unknown_field', field };
    }

    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(value);
        } else {
            const ta = document.createElement('textarea');
            ta.value = value;
            ta.setAttribute('readonly', '');
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        updateStatus(`Copied ${key}`);
        setTimeout(() => {
            if (isListening) updateStatus(isPlaying ? 'Talk to interrupt' : 'Listening...');
        }, 1200);
        return { success: true, field: key, value };
    } catch (err) {
        console.error('Clipboard copy failed:', err);
        return { success: false, error: 'clipboard_failed', field: key };
    }
}

async function handleClientToolRequest(message) {
    const { requestId, tool, args = {} } = message;
    let result = { success: false, error: 'unknown_tool', tool };

    try {
        switch (tool) {
            case 'navigate_to_section':
                result = navigateToSection(args.section, args.highlight !== false);
                break;
            case 'highlight_section':
                result = highlightSection(args.section);
                break;
            case 'open_external_link':
                result = openExternalLink(args.destination);
                break;
            case 'get_page_context':
                result = getVisibleSectionContext();
                break;
            case 'copy_contact_info':
                result = await copyContactInfo(args.field);
                break;
            default:
                break;
        }
    } catch (err) {
        console.error('Client tool error:', tool, err);
        result = { success: false, error: err.message || 'client_tool_failed', tool };
    }

    if (ws && ws.readyState === WebSocket.OPEN && requestId) {
        ws.send(JSON.stringify({
            type: 'client_tool_result',
            requestId,
            result
        }));
    }
}

// Initialize
function init() {
    setupVisualizerCanvas();
    setupEventListeners();

    // If we landed with a hash from another page tool redirect, soft-highlight
    if (window.location.hash) {
        const id = window.location.hash.slice(1);
        const el = document.getElementById(id);
        if (el) {
            setTimeout(() => {
                scrollToSectionElement(el);
                pulseHighlight(el);
            }, 450);
        }
    }
}

function setupVisualizerCanvas() {
    miniVisualizer.width = 38;
    miniVisualizer.height = 38;
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
        // Send audioStreamEnd signal to Gemini via WebSocket proxy
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'audioStreamEnd' }));
        }
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

        case 'client_tool':
            handleClientToolRequest(message);
            break;

        case 'end_conversation':
            console.log('👋 Received end_conversation signal — waiting for farewell audio');
            armGracefulEnd();
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
        if (pendingGracefulEnd) {
            farewellAudioStarted = true;
        }
        addAudioToQueue(data.data);
    }

    // Handle server content
    if (data.serverContent) {
        if (data.serverContent.interrupted) {
            // User interrupted goodbye — cancel graceful end and keep listening
            if (pendingGracefulEnd) {
                pendingGracefulEnd = false;
                farewellAudioStarted = false;
                shouldEndAfterTurn = false;
                clearGracefulEndTimers();
            }
            stopAudioPlayback();
            updateStatus('Listening...');
        }

        if (data.serverContent.turnComplete) {
            miniOrb.classList.remove('speaking');
            miniOrb.classList.add('listening');
            // Farewell turn finished — close only after queued audio fully plays
            if (pendingGracefulEnd && farewellAudioStarted) {
                shouldEndAfterTurn = true;
                setTimeout(() => processAudioQueue(), 30);
            }
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
        // Still waiting for farewell speech — do not disconnect yet
        if (pendingGracefulEnd && !farewellAudioStarted) {
            updateStatus('Saying goodbye...');
            return;
        }
        // Farewell played — brief settle so late chunks can arrive, then close
        if (pendingGracefulEnd && farewellAudioStarted) {
            updateStatus('Goodbye!');
            clearGracefulEndTimers();
            gracefulEndFallbackTimer = setTimeout(() => {
                if (audioQueue.length > 0 || isPlaying) {
                    processAudioQueue();
                    return;
                }
                finalizeGracefulEnd();
            }, 1100);
            return;
        }
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
        if (widgetPanel) widgetPanel.classList.add('connected');
        muteButton.style.display = 'flex';
        endButton.style.display = 'flex';
    } catch (error) {
        console.error('Failed to start:', error);
        updateStatus('Error - Try again');
        if (widgetPanel) widgetPanel.classList.remove('connected');
        muteButton.style.display = 'none';
        endButton.style.display = 'none';
    }
}

function handleEndClick(e) {
    if (e && e.stopPropagation) e.stopPropagation();

    pendingGracefulEnd = false;
    farewellAudioStarted = false;
    shouldEndAfterTurn = false;
    clearGracefulEndTimers();
    
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
    if (widgetPanel) widgetPanel.classList.remove('connected');
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


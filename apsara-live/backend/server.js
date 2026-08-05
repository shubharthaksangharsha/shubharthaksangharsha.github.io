/**
 * Apsara Live - Backend Server for Oracle Hosting
 * This server acts as a secure proxy between your frontend and Gemini Live API
 */

const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration - Update this with your GitHub Pages URL
const allowedOrigins = [
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'https://shubharthaksangharsha.github.io', // UPDATE THIS!
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use(express.json());

// Email configuration
const emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD // Use App Password, not regular password
    }
});

// Function to send email
async function sendEmailToShubharthak(message, userContext = '') {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: 'shubharthaksangharsha@gmail.com',
            subject: `Message from Apsara Live Assistant`,
            html: `
                <h2>New message from Apsara Live</h2>
                <p><strong>Message:</strong> ${message}</p>
                ${userContext ? `<p><strong>Context:</strong> ${userContext}</p>` : ''}
                <p><em>Sent at: ${new Date().toLocaleString()}</em></p>
            `
        };

        const info = await emailTransporter.sendMail(mailOptions);
        console.log('Email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Email error:', error);
        return { success: false, error: error.message };
    }
}

const SYSTEM_PROMPT = require('./systemprompt');
const tools = require('./tools');

// WebSocket server
const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', (clientWs) => {
    console.log('Client connected');
    let geminiWs = null;

    // Connect to Gemini Live API
    const connectToGemini = async () => {
        console.log('🔄 Connecting to Gemini Live API...');
        const { GoogleGenAI, Modality } = await import('@google/genai');

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const model = 'gemini-3.1-flash-live-preview'; // Use half-cascade for better tool support
        console.log('📡 Using model:', model);

        const config = {
            responseModalities: [Modality.AUDIO],
            systemInstruction: SYSTEM_PROMPT,
            tools: tools,
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: {
                        voiceName: 'Aoede' // Friendly female voice
                    }
                }
            }
        };

        const session = await ai.live.connect({
            model: model,
            callbacks: {
                onopen: () => {
                    console.log('Connected to Gemini');
                    clientWs.send(JSON.stringify({ type: 'status', status: 'connected' }));
                },
                onmessage: async (message) => {
                    console.log('📨 Received message from Gemini:', JSON.stringify(Object.keys(message)));

                    // Log the full structure to understand where audio is
                    if (message.serverContent) {
                        console.log('🔍 serverContent keys:', JSON.stringify(Object.keys(message.serverContent)));
                        if (message.serverContent.modelTurn) {
                            console.log('🔍 modelTurn keys:', JSON.stringify(Object.keys(message.serverContent.modelTurn)));
                        }
                    }

                    // Extract audio from serverContent.inlineData
                    let audioData = null;
                    if (message.serverContent?.modelTurn?.parts) {
                        console.log('🔍 Found parts, checking for audio...');
                        for (const part of message.serverContent.modelTurn.parts) {
                            console.log('🔍 Part keys:', JSON.stringify(Object.keys(part)));
                            if (part.inlineData) {
                                console.log('🔍 inlineData keys:', JSON.stringify(Object.keys(part.inlineData)));
                                console.log('🔍 mimeType:', part.inlineData.mimeType);
                                // Check for any audio mime type
                                if (part.inlineData.mimeType && part.inlineData.mimeType.includes('audio')) {
                                    audioData = part.inlineData.data;
                                    console.log('🔊 AUDIO DATA LENGTH:', audioData.length);
                                    break;
                                }
                            }
                        }
                    }

                    // Handle tool calls
                    if (message.toolCall) {
                        for (const fc of message.toolCall.functionCalls) {
                            if (fc.name === 'send_email_to_shubharthak') {
                                const { message: emailMessage, senderInfo } = fc.args;
                                const result = await sendEmailToShubharthak(emailMessage, senderInfo);

                                session.sendToolResponse({
                                    functionResponses: [{
                                        id: fc.id,
                                        name: fc.name,
                                        response: result
                                    }]
                                });
                            } else if (fc.name === 'end_conversation') {
                                console.log('👋 Received end_conversation tool call');
                                session.sendToolResponse({
                                    functionResponses: [{
                                        id: fc.id,
                                        name: fc.name,
                                        response: { status: 'ending_conversation' }
                                    }]
                                });
                                clientWs.send(JSON.stringify({ type: 'end_conversation' }));
                            }
                        }
                    }

                    // Forward message to client with extracted audio
                    const messageToSend = {
                        type: 'gemini_message',
                        data: {
                            ...message,
                            data: audioData // Add extracted audio data
                        }
                    };
                    clientWs.send(JSON.stringify(messageToSend));
                },
                onerror: (error) => {
                    console.error('Gemini error:', error);
                    clientWs.send(JSON.stringify({ type: 'error', error: error.message }));
                },
                onclose: (event) => {
                    console.log('Gemini connection closed:', event.reason);
                    clientWs.send(JSON.stringify({ type: 'status', status: 'disconnected' }));
                }
            },
            config: config
        });

        geminiWs = session;
    };

    connectToGemini();

    // Handle messages from client
    clientWs.on('message', (data) => {
        try {
            const message = JSON.parse(data);

            if (message.type === 'audio' && geminiWs) {
                // Forward audio to Gemini
                console.log('🎤 Forwarding audio to Gemini...');
                geminiWs.sendRealtimeInput({
                    audio: {
                        data: message.data,
                        mimeType: 'audio/pcm;rate=16000'
                    }
                });
            } else if (message.type === 'text' && geminiWs) {
                const textMsg = typeof message.data === 'string' ? message.data : 
                               (Array.isArray(message.data) ? message.data[0]?.parts?.[0]?.text : String(message.data));
                console.log('💬 Forwarding text to Gemini via sendRealtimeInput:', textMsg);
                
                try {
                    if (typeof geminiWs.sendRealtimeInput === 'function') {
                        geminiWs.sendRealtimeInput({ text: textMsg });
                    } else if (typeof geminiWs.sendClientContent === 'function') {
                        geminiWs.sendClientContent({
                            turns: [{
                                role: 'user',
                                parts: [{ text: textMsg }]
                            }]
                        });
                    }
                } catch (err) {
                    console.error('Error forwarding text to Gemini:', err);
                }
            }
        } catch (error) {
            console.error('Error handling client message:', error);
        }
    });

    clientWs.on('close', () => {
        console.log('Client disconnected');
        if (geminiWs) {
            geminiWs.close();
        }
    });
});

// HTTP server
const server = app.listen(PORT, () => {
    console.log(`🚀 Apsara Live Backend running on port ${PORT}`);
    console.log(`📧 Email service configured for: shubharthaksangharsha@gmail.com`);
});

// Upgrade HTTP connection to WebSocket
server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'Apsara Live Backend' });
});

// Test email endpoint (for debugging)
app.post('/test-email', async (req, res) => {
    const { message } = req.body;
    const result = await sendEmailToShubharthak(message || 'Test message from Apsara Live');
    res.json(result);
});


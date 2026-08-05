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

// System prompt with all your data
const SYSTEM_PROMPT = `You are Apsara, an advanced AI voice assistant created by Shubharthak Sangharasha. You are friendly, helpful, and conversational. When greeting users or introducing yourself, be warm and professional.

**Your Capabilities:**
- Real-time voice conversations with natural interruption handling
- Sending messages to Shubharthak via email
- Searching Google for real-time information (current events, news, weather, sports, latest tech updates, etc.)
- Answering questions about Shubharthak's work, projects, and experience
- Providing information about his skills, education, and background
- Discussing his freelance work and client projects
- Explaining his technical expertise in detail

**How to interact with users:**
- Be conversational and friendly
- Respond only in English until user wants to speak in another language
- Answer questions naturally about Shubharthak's experience and projects
- If someone wants to contact Shubharthak, offer to send a message via email
- Provide detailed but concise information
- Show enthusiasm about his research, capstone, and client applications
- For questions about current events, news, weather, sports scores, latest tech updates, or anything requiring real-time information, Google Search will automatically provide accurate, up-to-date answers
- Always cite sources when sharing information from Google Search

**Important:** 
- When users ask you to send a message to Shubharthak, use the send_email_to_shubharthak function.
- Google Search is available for real-time information - the system will handle it automatically when needed.

**About Shubharthak Sangharasha:**

**Professional Summary:**
Applied AI & ML Engineer with a Master's from the University of Adelaide and hands-on experience spanning robotics, LLMs, computer vision, and scalable production AI web apps on AWS. Adaptable developer across Python, C++, C, Java, Ruby, and JavaScript.

**Contact:**
- Email: contact@devshubh.me / shubharthaksangharsha@gmail.com
- Phone: +61 485 515 430
- Location: Adelaide, Australia
- GitHub: github.com/shubharthaksangharsha
- LinkedIn: linkedin.com/in/shubharthaksangharsha
- Website: devshubh.me

**Work Experience:**
1. **Freelance Full-Stack & AI Developer** (Aug 2023 – Present)
   - Self Employed (devshubh.me), Adelaide, Australia
   - End-to-End Client Engineering: Architected, built, and deployed production web applications across e-commerce (Aura Boxed Gifts), fintech (Wyndham Financial Group, Auz Finance), and trade services (W13 Projects, BAAZ Electrical Group).
   - Applied AI & Voice Assistants: Designed and integrated custom multi-modal AI tools, including **Aura AI** (automated product discovery and checkout) and **Wyndham AI** (voice-activated mortgage assistance).
   - Full-Stack & Growth Systems: Conversion-focused interfaces with dynamic loan calculators, project showcases, lead-generation engines, and performance/SEO optimizations.

2. **Backend Web Development Intern at Curve Tomorrow** (Jun 2022 – Sep 2022)
   - Parkville, Melbourne, Australia
   - Engineered scalable Ruby on Rails backends for healthcare admin tools, implementing custom user authentication, dynamic CMS capability (cut publishing turnaround from days to minutes), and RESTful APIs.
   - Designed a dynamic user activity logging and auditing system to streamline compliance and simplify debugging.

**Education:**
- **Master of Artificial Intelligence & Machine Learning** - University of Adelaide, Adelaide, SA, Australia (Sep 2024 – May 2026)
  GPA: 6.375 / 7.00
  Courses: Deep Learning Fundamentals, Mining Big Data, ML & AI, Applied NLP, Computer Vision
- **B.E. in Computer Science & Engineering (AI/ML)** - Chandigarh University, Punjab, India (Apr 2020 – May 2024)
  CGPA: 8.39 / 10.00
- **12th (Senior Secondary), CBSE Board** - NP Co-ed, Lodhi Estate, New Delhi (2018–2019)
  Percentage: 81.5%

**Skills:**
- **Programming Languages:** Python, C++, C, Java, Ruby, JavaScript
- **AI & Machine Learning:** PyTorch, TensorFlow, OpenCV, Reinforcement Learning (RSSM/CEM), World Models, NLP, LLMs, LangChain, TTS, Speech Recognition, Audio Signal Processing
- **Web & Cloud:** HTML, CSS, React, Flask, Ruby on Rails, AWS, MySQL, Node.js, Express
- **Data & Tools:** NumPy, Pandas, Git, Selenium, Unix/Linux, Big Data, Prompt Engineering

**Featured Projects & Capstone Research:**

1. **Action-Conditioned World Models for Autonomous Navigation** (Jan 2026 – May 2026) - https://github.com/shubharthaksangharsha/action-conditioned-world-models-navigation
   - Master's Capstone project at University of Adelaide, supervised by Prof. Peng Shi & Dr. Bing Yan.
   - Designed and trained a 4.57M-parameter Recurrent State-Space Model (RSSM) on 617K simulated transitions, achieving 0.815 SSIM for multi-step depth prediction.
   - Engineered a hybrid Cross-Entropy Method (CEM) planner, reducing collisions by an order of magnitude compared to baseline PPO reactive models.
   - Transferred model to physical Unitree Go2 quadruped hardware with 10.8K real-world transitions and ChronoDreamer-inspired proximity-gating safety layer.
   - Video Demo: https://www.youtube.com/watch?v=QKoCmm2ckRY
   - Report PDF: https://drive.google.com/file/d/1wkySlwk0GYyf20Yjmq02rYhhwWkMmBWI/view?usp=sharing

2. **GPT-2 Pretraining & Supervised Fine-Tuning From Scratch** (Aug 2025)
   - Pretrained 124M-parameter GPT-2 on 5B tokens (FineWeb-Edu), matching OpenAI's baseline with 28.34% HellaSwag accuracy using FlashAttention, FP16 AMP, AdamW, and DDP across multiple GPUs.
   - Implemented SFT and DPO alignment pipelines, deploying fine-tuned LLM via an interactive Gradio app.

3. **Apsara: Multimodal AI Assistant & RAG Engine** (Jan 2025) - https://apsara.devshubh.me
   - Open-source cross-platform AI desktop assistant with voice, vision, and OS-level automation.
   - Custom RAG system using LangChain for unstructured PDFs and web data.
   - Apsara Dark (Android successor) currently in development with real-time screen awareness and tap targeting.

4. **Karpathy ML Implementations** - https://github.com/shubharthaksangharsha/karpathy
   - Comprehensive collection of neural network implementations following Andrej Karpathy's 'Zero to Hero' series.

5. **Aura AI & E-commerce Platform (Aura Boxed Gifts)** - https://auraboxedgifts.in
   - Integrated conversational AI shopping assistant for automated product discovery and checkout.

6. **Wyndham AI & Fintech Platform (Wyndham Financial Group)**
   - Voice-activated AI assistant for mortgage and loan guidance.`;

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

        // Function declarations for tools
        const tools = [
            // Google Search - Built-in tool (no function declaration needed)
            { googleSearch: {} },
            // Custom function for sending emails
            {
                functionDeclarations: [
                    {
                        name: 'send_email_to_shubharthak',
                        description: 'Send an email message to Shubharthak Sangharasha. Use this when users want to contact him, leave a message, or send inquiries.',
                        parameters: {
                            type: 'object',
                            properties: {
                                message: {
                                    type: 'string',
                                    description: 'The message content to send to Shubharthak'
                                },
                                senderInfo: {
                                    type: 'string',
                                    description: 'Optional information about the sender (name, contact info if provided)'
                                }
                            },
                            required: ['message']
                        }
                    }
                ]
            }
        ];

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
                geminiWs.sendClientContent({ turns: message.data });
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


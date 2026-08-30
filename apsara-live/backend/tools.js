/**
 * Tool declarations for Gemini Live API session
 */

const tools = [
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
            },
            {
                name: 'end_conversation',
                description: 'Close the conversation after you have ALREADY spoken a warm goodbye out loud. Call this only AFTER your spoken farewell audio, never before speaking. Do not end silently.',
                parameters: {
                    type: 'object',
                    properties: {
                        farewell_message: {
                            type: 'string',
                            description: 'The farewell you already spoke or will immediately speak aloud (for logging only). Always speak it as voice; do not rely on this field alone.'
                        }
                    }
                }
            },
            {
                name: 'navigate_to_section',
                description: 'Scroll the portfolio website to a relevant section while answering. Use whenever the user asks about a topic that maps to a page section (GPA/education, skills, projects, work experience, freelance, about, contact, intro). Prefer calling this before or while explaining so the visitor can see the content.',
                parameters: {
                    type: 'object',
                    properties: {
                        section: {
                            type: 'string',
                            description: 'Target section key',
                            enum: [
                                'intro',
                                'about',
                                'projects',
                                'freelance',
                                'work',
                                'skills',
                                'education',
                                'contact'
                            ]
                        },
                        highlight: {
                            type: 'boolean',
                            description: 'If true (default), briefly pulse/glow the section after scrolling so it is easy to notice on mobile and laptop.'
                        }
                    },
                    required: ['section']
                }
            },
            {
                name: 'highlight_section',
                description: 'Briefly glow/pulse a portfolio section to draw attention without needing a full explanation change. Use when the section is already nearby or when you want to emphasize something the user should look at.',
                parameters: {
                    type: 'object',
                    properties: {
                        section: {
                            type: 'string',
                            description: 'Target section key',
                            enum: [
                                'intro',
                                'about',
                                'projects',
                                'freelance',
                                'work',
                                'skills',
                                'education',
                                'contact'
                            ]
                        }
                    },
                    required: ['section']
                }
            },
            {
                name: 'open_external_link',
                description: 'Open one of Shubharthak\'s approved external links in a NEW browser tab so the portfolio page and this voice session stay open (GitHub, LinkedIn, resume PDF, email compose, or a featured client website). Never navigate away from the current page.',
                parameters: {
                    type: 'object',
                    properties: {
                        destination: {
                            type: 'string',
                            description: 'Which approved link to open',
                            enum: [
                                'github',
                                'linkedin',
                                'resume',
                                'email',
                                'website',
                                'aura',
                                'w13',
                                'auzfinance',
                                'baaz',
                                'wyndham'
                            ]
                        }
                    },
                    required: ['destination']
                }
            },
            {
                name: 'get_page_context',
                description: 'Read which portfolio section is currently most visible in the visitor\'s browser viewport. Use this when you need better follow-up awareness (e.g. user says "what about this section?" or "tell me more about what I\'m looking at").',
                parameters: {
                    type: 'object',
                    properties: {}
                }
            },
            {
                name: 'copy_contact_info',
                description: 'Copy Shubharthak\'s contact details to the visitor\'s clipboard for convenience (email, LinkedIn URL, or GitHub URL).',
                parameters: {
                    type: 'object',
                    properties: {
                        field: {
                            type: 'string',
                            description: 'Which contact field to copy',
                            enum: ['email', 'linkedin', 'github']
                        }
                    },
                    required: ['field']
                }
            }
        ]
    }
];

module.exports = tools;

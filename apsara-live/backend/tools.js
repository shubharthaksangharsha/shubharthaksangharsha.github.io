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
                description: 'End and close the conversation gracefully when the user says goodbye, bye, see you later, ttyl, or indicates they want to wrap up or end the chat.',
                parameters: {
                    type: 'object',
                    properties: {
                        farewell_message: {
                            type: 'string',
                            description: 'Optional warm farewell message to deliver before closing.'
                        }
                    }
                }
            }
        ]
    }
];

module.exports = tools;

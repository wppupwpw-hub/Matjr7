const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Environment variables
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// Response files to try loading
const RESPONSE_FILES = [
    'responses_optimized.json',
    'responses_mega_optimized.json',
    'responses_simple_1million.json',
    'responses_chunk_1.json'
];

let responsesData = null;
let isLoading = false;

/**
 * Load responses from external files only
 */
async function loadResponsesFromFiles() {
    if (responsesData !== null || isLoading) {
        return;
    }
    
    isLoading = true;
    console.log("🔍 Looking for response files...");
    
    // Try each possible file
    for (const fileName of RESPONSE_FILES) {
        const filePath = path.resolve(__dirname, fileName);
        
        try {
            if (fs.existsSync(filePath)) {
                console.log(`📁 Found file: ${fileName}`);
                const fileContent = fs.readFileSync(filePath, 'utf-8');
                const data = JSON.parse(fileContent);
                
                // Handle different file formats
                if (data.responses && data.keywords) {
                    // Optimized format
                    responsesData = data;
                    console.log("✅ Loaded optimized format");
                    console.log(`📊 Questions: ${Object.keys(data.responses).length}`);
                    console.log(`🔍 Keywords: ${Object.keys(data.keywords).length}`);
                } else if (typeof data === 'object') {
                    // Simple key-value format
                    responsesData = {
                        responses: {},
                        keywords: {},
                        simple: data
                    };
                    
                    // Convert simple format
                    let questionId = 1;
                    for (const [question, answer] of Object.entries(data)) {
                        const key = `q_${questionId}`;
                        responsesData.responses[key] = {
                            question: question,
                            answer: answer,
                            category: 'general'
                        };
                        
                        // Create keywords
                        const words = question.toLowerCase().split(/\s+/);
                        for (const word of words) {
                            if (word.length > 2) {
                                const cleanWord = word.replace(/[؟.,!()[\]{}\"']/g, '');
                                if (!responsesData.keywords[cleanWord]) {
                                    responsesData.keywords[cleanWord] = [];
                                }
                                responsesData.keywords[cleanWord].push(key);
                            }
                        }
                        questionId++;
                    }
                    
                    console.log("✅ Loaded and converted simple format");
                    console.log(`📊 Questions: ${Object.keys(responsesData.responses).length}`);
                }
                
                isLoading = false;
                return;
            }
        } catch (error) {
            console.log(`❌ Error loading ${fileName}: ${error.message}`);
        }
    }
    
    console.log("❌ No valid response files found!");
    console.log("📂 Files in directory:", fs.readdirSync(__dirname));
    
    responsesData = null;
    isLoading = false;
}

/**
 * Search for response in loaded data only
 */
function findResponseInData(userMessage) {
    if (!responsesData) {
        return null;
    }
    
    const message = userMessage.toLowerCase().trim();
    console.log(`🔍 Searching for: "${message}"`);
    
    // If simple format exists, search there first
    if (responsesData.simple) {
        // Direct match
        if (responsesData.simple[message]) {
            console.log("⚡ Direct match found in simple format");
            return responsesData.simple[message];
        }
        
        // Partial match in simple format
        for (const [key, response] of Object.entries(responsesData.simple)) {
            if (key.includes(message) || message.includes(key)) {
                console.log("✅ Partial match found in simple format");
                return response;
            }
        }
    }
    
    // Search in optimized format
    if (responsesData.responses && responsesData.keywords) {
        let bestMatch = { score: 0, answer: null };
        const userWords = message.split(/\s+/).filter(word => word.length > 2);
        
        console.log(`🔍 Searching keywords: ${userWords.join(', ')}`);
        
        // Find potential matches using keywords
        const potentialMatches = new Set();
        for (const word of userWords) {
            const cleanWord = word.replace(/[؟.,!()[\]{}\"']/g, '');
            if (responsesData.keywords[cleanWord]) {
                responsesData.keywords[cleanWord].forEach(key => potentialMatches.add(key));
            }
        }
        
        console.log(`🎯 Found ${potentialMatches.size} potential matches`);
        
        // Score each match
        for (const matchKey of potentialMatches) {
            if (responsesData.responses[matchKey]) {
                const question = responsesData.responses[matchKey].question.toLowerCase();
                let score = 0;
                
                // Calculate match score
                for (const word of userWords) {
                    if (question.includes(word.replace(/[؟.,!()[\]{}\"']/g, ''))) {
                        score += 1;
                    }
                }
                
                // Exact match bonus
                if (question === message) {
                    score += 10;
                }
                
                if (score > bestMatch.score) {
                    bestMatch = {
                        score: score,
                        answer: responsesData.responses[matchKey].answer
                    };
                }
            }
        }
        
        if (bestMatch.answer && bestMatch.score > 0) {
            console.log(`✅ Best match found with score: ${bestMatch.score}`);
            return bestMatch.answer;
        }
    }
    
    return null;
}

/**
 * Main webhook handler
 */
exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (!VERIFY_TOKEN || !PAGE_ACCESS_TOKEN) {
        console.error("❌ Missing environment variables");
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: "Missing environment variables" })
        };
    }

    try {
        // Load response data
        await loadResponsesFromFiles();

        // Facebook verification (GET)
        if (event.httpMethod === "GET") {
            const params = event.queryStringParameters || {};
            
            if (params["hub.verify_token"] === VERIFY_TOKEN && params["hub.challenge"]) {
                console.log("✅ Webhook verified successfully");
                return {
                    statusCode: 200,
                    headers,
                    body: params["hub.challenge"]
                };
            }
            
            return { statusCode: 403, headers, body: "Verification failed" };
        }

        // Handle messages (POST)
        if (event.httpMethod === "POST") {
            if (!event.body) {
                return { statusCode: 400, headers, body: "No body provided" };
            }

            const body = JSON.parse(event.body);
            console.log("📨 Received webhook:", JSON.stringify(body, null, 2));

            if (body.object === "page" && body.entry) {
                await processWebhookEvents(body.entry);
                return { statusCode: 200, headers, body: "EVENT_RECEIVED" };
            }
            
            return { statusCode: 200, headers, body: "OK" };
        }

        return { statusCode: 405, headers, body: "Method not allowed" };

    } catch (error) {
        console.error("❌ Handler error:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

/**
 * Process webhook events
 */
async function processWebhookEvents(entries) {
    for (const entry of entries) {
        if (entry.messaging) {
            for (const event of entry.messaging) {
                await handleMessagingEvent(event);
            }
        }
    }
}

/**
 * Handle individual message
 */
async function handleMessagingEvent(event) {
    const senderId = event.sender?.id;

    if (!senderId) {
        console.error("❌ No sender ID found");
        return;
    }

    console.log("👤 Processing message from:", senderId);

    try {
        if (event.message?.text) {
            const userMessage = event.message.text;
            console.log("💬 User message:", userMessage);
            
            // Try to find response in data files
            const response = findResponseInData(userMessage);
            
            let botResponse;
            if (response) {
                botResponse = response;
                console.log("✅ Response found in data files");
            } else {
                // No data loaded or no match found
                if (!responsesData) {
                    botResponse = "عذراً، لم أتمكن من تحميل قاعدة البيانات. تأكد من وجود ملف responses_optimized.json";
                    console.log("❌ No response data loaded");
                } else {
                    botResponse = "عذراً، لم أجد إجابة لهذا السؤال في قاعدة البيانات. حاول إعادة صياغة السؤال.";
                    console.log("❌ No match found in loaded data");
                }
            }
            
            console.log("🤖 Bot response:", botResponse);
            await sendMessage(senderId, botResponse);
            
        } else if (event.postback?.payload === "GET_STARTED_PAYLOAD") {
            console.log("🚀 Get started button pressed");
            let welcomeMsg;
            
            if (!responsesData) {
                welcomeMsg = "مرحباً! لم أتمكن من تحميل قاعدة البيانات. تحقق من وجود ملف responses.";
            } else {
                const totalQuestions = responsesData.responses ? Object.keys(responsesData.responses).length : 
                                    responsesData.simple ? Object.keys(responsesData.simple).length : 0;
                welcomeMsg = `مرحباً بك! قاعدة البيانات محملة بنجاح مع ${totalQuestions.toLocaleString()} سؤال وجواب. اسأل عن أي شيء!`;
            }
            
            await sendMessage(senderId, welcomeMsg);
        }
    } catch (error) {
        console.error("❌ Error handling message:", error);
        await sendMessage(senderId, "حدث خطأ تقني. تحقق من إعدادات البوت.");
    }
}

/**
 * Send message to user
 */
async function sendMessage(recipientId, messageText) {
    const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;
    
    const payload = {
        recipient: { id: recipientId },
        message: { text: messageText }
    };

    console.log("📤 Sending message to Facebook API");

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            console.log("✅ Message sent successfully");
        } else {
            const errorText = await response.text();
            console.error("❌ Facebook API error:", response.status, errorText);
        }
    } catch (error) {
        console.error("❌ Error sending message:", error);
    }
}

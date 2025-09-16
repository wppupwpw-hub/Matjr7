const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Environment variables must be set on Netlify
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// Updated path - looking for the optimized file in the same directory as the function
const RESPONSES_FILE = path.resolve(__dirname, 'responses_optimized.json');
let responsesData = null;

/**
 * Load the optimized responses data from the JSON file.
 */
async function loadResponses() {
    if (responsesData) {
        return;
    }

    try {
        if (!fs.existsSync(RESPONSES_FILE)) {
            console.error("❌ responses_optimized.json file not found at:", RESPONSES_FILE);
            console.error("Available files:", fs.readdirSync(__dirname));
            return;
        }

        const fileContent = fs.readFileSync(RESPONSES_FILE, 'utf-8');
        responsesData = JSON.parse(fileContent);
        
        console.log("✅ Optimized responses data loaded successfully.");
        console.log(`📊 Loaded ${Object.keys(responsesData.responses || {}).length} Q&A pairs.`);
        console.log(`🔍 Indexed ${Object.keys(responsesData.keywords || {}).length} keywords.`);
    } catch (error) {
        console.error("❌ Error loading optimized responses file:", error);
    }
}

exports.handler = async (event) => {
    // Add CORS headers for all responses
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // Check for required environment variables
    if (!VERIFY_TOKEN || !PAGE_ACCESS_TOKEN) {
        console.error("❌ Missing environment variables");
        console.error("VERIFY_TOKEN exists:", !!VERIFY_TOKEN);
        console.error("PAGE_ACCESS_TOKEN exists:", !!PAGE_ACCESS_TOKEN);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: "Missing environment variables",
                details: "VERIFY_TOKEN or PAGE_ACCESS_TOKEN not set"
            })
        };
    }

    try {
        await loadResponses();

        // Verification for Facebook (GET request)
        if (event.httpMethod === "GET") {
            const params = event.queryStringParameters || {};
            console.log("📥 Verification request received:", params);
            
            if (params["hub.verify_token"] === VERIFY_TOKEN && params["hub.challenge"]) {
                console.log("✅ Webhook verified successfully.");
                return {
                    statusCode: 200,
                    headers,
                    body: params["hub.challenge"],
                };
            }
            
            console.log("❌ Verification failed - token mismatch or missing challenge");
            return {
                statusCode: 403,
                headers,
                body: "Forbidden - Invalid verify token"
            };
        }

        // Handle incoming messages (POST request)
        if (event.httpMethod === "POST") {
            if (!event.body) {
                return { 
                    statusCode: 400, 
                    headers,
                    body: JSON.stringify({ error: "No body provided" })
                };
            }

            const body = JSON.parse(event.body);
            console.log("📨 Incoming webhook data:", JSON.stringify(body, null, 2));

            if (body.object === "page" && body.entry) {
                await processWebhookEvents(body.entry);
                return { 
                    statusCode: 200, 
                    headers,
                    body: "EVENT_RECEIVED" 
                };
            }
            
            console.log("⚠️ Unrecognized webhook format");
            return { 
                statusCode: 404, 
                headers,
                body: "Not Found - Unrecognized format" 
            };
        }

        return { 
            statusCode: 405, 
            headers,
            body: "Method Not Allowed" 
        };
        
    } catch (error) {
        console.error("❌ General Webhook error:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: "Internal server error",
                details: error.message 
            })
        };
    }
};

/**
 * Process webhook events from Facebook
 */
async function processWebhookEvents(entries) {
    for (const entry of entries) {
        if (entry.messaging) {
            for (const webhookEvent of entry.messaging) {
                await handleMessagingEvent(webhookEvent);
            }
        }
    }
}

/**
 * Handle a single messaging event using the optimized data
 */
async function handleMessagingEvent(webhookEvent) {
    const senderId = webhookEvent.sender?.id;

    if (!senderId) {
        console.error("❌ No sender ID found in webhook event");
        return;
    }

    console.log("👤 Processing message from sender:", senderId);

    try {
        if (webhookEvent.message?.text) {
            const userMsg = webhookEvent.message.text.trim().toLowerCase();
            console.log("📩 User message:", userMsg);

            // Default response if no data loaded
            if (!responsesData || !responsesData.responses) {
                console.error("❌ No responses data available");
                await sendMessage(senderId, "عذراً، لم أستطع تحميل قاعدة البيانات. حاول مرة أخرى لاحقاً.");
                return;
            }
            
            // Search for the best response using keyword matching
            let botResponse = "عذراً، لم أجد إجابة لهذا السؤال. حاول صياغة السؤال بشكل مختلف. 🤔";
            let bestMatch = { score: 0, key: null };

            // Handle greetings first
            const greetings = ['مرحبا', 'السلام عليكم', 'صباح الخير', 'مساء الخير', 'أهلا', 'هلا'];
            if (greetings.some(greeting => userMsg.includes(greeting))) {
                botResponse = "مرحباً بك! 😊 أنا مساعدك الذكي. اسألني عن أي شيء تريد معرفته.";
                await sendMessage(senderId, botResponse);
                return;
            }

            // Tokenize the user message
            const userKeywords = userMsg.split(/\s+/).filter(word => word.length > 2);
            console.log("🔍 Searching for keywords:", userKeywords);

            // Find potential matches
            let potentialMatches = new Set();
            for (const keyword of userKeywords) {
                if (responsesData.keywords && responsesData.keywords[keyword]) {
                    responsesData.keywords[keyword].forEach(key => potentialMatches.add(key));
                }
            }
            
            console.log("🎯 Found potential matches:", potentialMatches.size);

            // Score each potential match
            for (const matchKey of potentialMatches) {
                if (responsesData.responses[matchKey]) {
                    const question = responsesData.responses[matchKey].question;
                    let score = 0;
                    
                    // Calculate match score
                    userKeywords.forEach(userWord => {
                        if (question.includes(userWord)) {
                            score += 1;
                        }
                    });
                    
                    // Bonus for exact matches
                    if (question === userMsg) {
                        score += 10;
                    }
                    
                    // Bonus for longer questions (more specific)
                    score += question.split(/\s+/).length * 0.1;

                    if (score > bestMatch.score) {
                        bestMatch = { score, key: matchKey };
                    }
                }
            }

            // Use best match if found
            if (bestMatch.key && bestMatch.score > 0) {
                botResponse = responsesData.responses[bestMatch.key].answer;
                console.log("✅ Found answer with score:", bestMatch.score);
            } else {
                console.log("⚠️ No good match found, using default response");
            }
            
            await sendMessage(senderId, botResponse);
            
        } else if (webhookEvent.postback?.payload === "GET_STARTED_PAYLOAD") {
            console.log("🚀 Get started payload received");
            const welcomeText = "مرحباً بك! أنا مساعدك الذكي. اسألني عن أي شيء تريد معرفته! 🤖";
            await sendMessage(senderId, welcomeText);
        } else {
            console.log("📝 Non-text message received, ignoring");
        }
    } catch (error) {
        console.error("❌ Error processing messaging event:", error);
        await sendMessage(senderId, "عذراً، حدث خطأ تقني. حاول مرة أخرى. 🔧");
    }
}

/**
 * Send a message back to the user
 */
async function sendMessage(recipientId, messageText) {
    const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;
    const payload = {
        recipient: { id: recipientId },
        message: { text: messageText }
    };

    console.log("📤 Sending message to:", recipientId);
    console.log("💬 Message:", messageText.substring(0, 50) + "...");

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload),
        });

        const responseData = await response.text();
        
        if (response.ok) {
            console.log("✅ Message sent successfully");
        } else {
            console.error("❌ Failed to send message:", response.status);
            console.error("📄 Response:", responseData);
        }
    } catch (error) {
        console.error("❌ Error sending message:", error);
    }
}
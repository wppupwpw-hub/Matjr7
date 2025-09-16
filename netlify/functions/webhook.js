const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Environment variables
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// Try multiple possible paths for the responses file
const POSSIBLE_PATHS = [
    path.resolve(__dirname, 'responses_optimized.json'),
    path.resolve(__dirname, '..', '..', 'responses_optimized.json'),
    path.resolve(process.cwd(), 'responses_optimized.json'),
    path.resolve(process.cwd(), 'netlify', 'functions', 'responses_optimized.json')
];

let responsesData = null;

// Simple fallback responses
const FALLBACK_RESPONSES = {
    "مرحبا": "مرحباً بك! كيف يمكنني مساعدتك؟",
    "السلام عليكم": "وعليكم السلام ورحمة الله وبركاته",
    "صباح الخير": "صباح الخير! كيف حالك اليوم؟",
    "مساء الخير": "مساء الخير! أهلاً وسهلاً",
    "كيف حالك": "الحمد لله بخير! كيف حالك أنت؟",
    "كيفك": "الحمد لله تمام! وانت كيفك؟",
    "أهلا": "أهلاً وسهلاً! مرحباً بك",
    "هيا": "تفضل، أنا هنا للمساعدة",
    "تحدث": "أهلاً! عن ماذا تريد أن نتحدث؟",
    "ما اسمك": "أنا مساعدك الذكي",
    "من أنت": "أنا بوت ذكي هنا لمساعدتك"
};

/**
 * Load responses data with fallback options
 */
async function loadResponses() {
    if (responsesData !== null) {
        return; // Already loaded
    }

    // Try to load from file
    for (const filePath of POSSIBLE_PATHS) {
        try {
            if (fs.existsSync(filePath)) {
                console.log("Found responses file at:", filePath);
                const fileContent = fs.readFileSync(filePath, 'utf-8');
                responsesData = JSON.parse(fileContent);
                
                console.log("✅ Responses loaded successfully");
                console.log(`📊 Questions: ${Object.keys(responsesData.responses || {}).length}`);
                console.log(`🔍 Keywords: ${Object.keys(responsesData.keywords || {}).length}`);
                return;
            }
        } catch (error) {
            console.log(`Failed to load from ${filePath}:`, error.message);
        }
    }
    
    // If no file found, use fallback
    console.log("⚠️ No responses file found, using fallback responses");
    responsesData = { fallback: true };
}

/**
 * Find best response for user message
 */
function findResponse(userMessage) {
    const message = userMessage.toLowerCase().trim();
    
    // Use fallback responses if no data file
    if (!responsesData || responsesData.fallback) {
        for (const [key, response] of Object.entries(FALLBACK_RESPONSES)) {
            if (message.includes(key.toLowerCase())) {
                return response;
            }
        }
        return "عذراً، لم أفهم طلبك. حاول كتابة شيء آخر.";
    }
    
    // Use loaded data if available
    if (responsesData.responses && responsesData.keywords) {
        let bestMatch = { score: 0, answer: null };
        const userWords = message.split(/\s+/).filter(word => word.length > 2);
        
        // Find potential matches using keywords
        const potentialMatches = new Set();
        for (const word of userWords) {
            if (responsesData.keywords[word]) {
                responsesData.keywords[word].forEach(key => potentialMatches.add(key));
            }
        }
        
        // Score each match
        for (const matchKey of potentialMatches) {
            if (responsesData.responses[matchKey]) {
                const question = responsesData.responses[matchKey].question.toLowerCase();
                let score = 0;
                
                // Calculate match score
                for (const word of userWords) {
                    if (question.includes(word)) {
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
            return bestMatch.answer;
        }
    }
    
    return "عذراً، لم أجد إجابة مناسبة. حاول إعادة صياغة السؤال.";
}

/**
 * Main handler function
 */
exports.handler = async (event) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Check environment variables
    if (!VERIFY_TOKEN || !PAGE_ACCESS_TOKEN) {
        console.error("❌ Missing environment variables");
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: "Missing environment variables",
                hasVerifyToken: !!VERIFY_TOKEN,
                hasPageToken: !!PAGE_ACCESS_TOKEN
            })
        };
    }

    try {
        // Load responses data
        await loadResponses();

        // Handle Facebook verification (GET)
        if (event.httpMethod === "GET") {
            const params = event.queryStringParameters || {};
            console.log("📥 Verification request:", params);
            
            if (params["hub.verify_token"] === VERIFY_TOKEN && params["hub.challenge"]) {
                console.log("✅ Webhook verified successfully");
                return {
                    statusCode: 200,
                    headers,
                    body: params["hub.challenge"]
                };
            }
            
            console.log("❌ Verification failed");
            return {
                statusCode: 403,
                headers,
                body: "Verification failed"
            };
        }

        // Handle incoming messages (POST)
        if (event.httpMethod === "POST") {
            if (!event.body) {
                return { 
                    statusCode: 400, 
                    headers,
                    body: "No body provided" 
                };
            }

            const body = JSON.parse(event.body);
            console.log("📨 Webhook received:", JSON.stringify(body, null, 2));

            if (body.object === "page" && body.entry) {
                await processWebhookEvents(body.entry);
                return { 
                    statusCode: 200, 
                    headers,
                    body: "EVENT_RECEIVED" 
                };
            }
            
            return { 
                statusCode: 200, 
                headers,
                body: "OK" 
            };
        }

        return { 
            statusCode: 405, 
            headers,
            body: "Method not allowed" 
        };

    } catch (error) {
        console.error("❌ Handler error:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: error.message 
            })
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
 * Handle individual messaging event
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
            
            const botResponse = findResponse(userMessage);
            console.log("🤖 Bot response:", botResponse);
            
            await sendMessage(senderId, botResponse);
            
        } else if (event.postback?.payload === "GET_STARTED_PAYLOAD") {
            console.log("🚀 Get started button pressed");
            const welcomeMsg = "مرحباً بك! أنا مساعدك الذكي. اكتب أي سؤال وسأجيب عليه.";
            await sendMessage(senderId, welcomeMsg);
        }
    } catch (error) {
        console.error("❌ Error handling message:", error);
        await sendMessage(senderId, "عذراً، حدث خطأ. حاول مرة أخرى.");
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

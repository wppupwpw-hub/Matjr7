const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Environment variables must be set on Netlify
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// Path to the responses JSON file
const RESPONSES_FILE = path.resolve(__dirname, '..', '..', 'responses.json');
let responsesData = {};

/**
 * Load the responses data from the JSON file
 */
async function loadResponses() {
    try {
        const fileContent = fs.readFileSync(RESPONSES_FILE, 'utf-8');
        const data = JSON.parse(fileContent);
        
        // Transform the array into a key-value object for faster lookup
        responsesData = data.reduce((acc, item) => {
            if (item.question && item.answer) {
                acc[item.question.toLowerCase().trim()] = item.answer;
            }
            return acc;
        }, {});
        console.log("✅ Responses data loaded successfully.");
        console.log(`📊 Loaded ${Object.keys(responsesData).length} Q&A pairs.`);
    } catch (error) {
        console.error("❌ Error loading responses file:", error);
    }
}

// Load responses on startup
loadResponses();

/**
 * Main Webhook handler function
 */
exports.handler = async (event) => {
    // Check for required environment variables
    if (!VERIFY_TOKEN || !PAGE_ACCESS_TOKEN) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Missing environment variables" })
        };
    }

    try {
        // Verification for Facebook (GET request)
        if (event.httpMethod === "GET") {
            const params = event.queryStringParameters || {};
            if (params["hub.verify_token"] === VERIFY_TOKEN && params["hub.challenge"]) {
                console.log("✅ Webhook verified successfully.");
                return {
                    statusCode: 200,
                    body: params["hub.challenge"],
                };
            }
            return {
                statusCode: 403,
                body: "Forbidden - Invalid verify token"
            };
        }

        // Handle incoming messages (POST request)
        if (event.httpMethod === "POST") {
            if (!event.body) {
                return { statusCode: 400, body: "No body provided" };
            }

            const body = JSON.parse(event.body);

            if (body.object === "page" && body.entry) {
                await processWebhookEvents(body.entry);
                return { statusCode: 200, body: "EVENT_RECEIVED" };
            }
            return { statusCode: 404, body: "Not Found" };
        }

        return { statusCode: 405, body: "Method Not Allowed" };
    } catch (error) {
        console.error("❌ General Webhook error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error" })
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
 * Handle a single messaging event
 */
async function handleMessagingEvent(webhookEvent) {
    const senderId = webhookEvent.sender?.id;

    if (!senderId) {
        console.error("❌ No sender ID found.");
        return;
    }

    try {
        if (webhookEvent.message?.text) {
            const userMsg = webhookEvent.message.text.trim().toLowerCase();
            console.log("📩 User message:", userMsg);
            
            // Generate response from the loaded data
            const botResponse = responsesData[userMsg] || "عذراً، لم أجد إجابة لهذا السؤال. حاول صياغة السؤال بشكل مختلف.";
            await sendMessage(senderId, botResponse);
        } else if (webhookEvent.postback?.payload === "GET_STARTED_PAYLOAD") {
            const welcomeText = "مرحباً بك! أنا مساعدك الذكي. اسألني عن أي شيء.";
            await sendMessage(senderId, welcomeText);
        }
    } catch (error) {
        console.error("❌ Error processing event:", error);
        await sendMessage(senderId, "عذراً، حدث خطأ. حاول مرة أخرى.");
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

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload),
        });

        if (response.ok) {
            console.log("✅ Message sent successfully.");
        } else {
            const errorData = await response.text();
            console.error("❌ Failed to send message:", response.status, errorData);
        }
    } catch (error) {
        console.error("❌ Error sending message:", error);
    }
}

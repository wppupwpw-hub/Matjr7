const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Environment variables
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// Multiple response files for better performance
const RESPONSE_FILES = [
    'responses_chunk_1.json',    // 50K responses
    'responses_chunk_2.json',    // 50K responses
    'responses_chunk_3.json',    // 50K responses
    // ... up to 20 files for 1M responses
    'responses_mega_optimized.json' // Full 1M responses file
];

let responsesData = null;
let isLoading = false;

// Enhanced fallback with more responses
const ENHANCED_FALLBACK = {
    // Arabic Greetings
    "مرحبا": "مرحباً بك! كيف يمكنني مساعدتك اليوم؟",
    "السلام عليكم": "وعليكم السلام ورحمة الله وبركاته! أهلاً وسهلاً",
    "صباح الخير": "صباح الخير! أتمنى لك يوماً مليئاً بالنجاح",
    "مساء الخير": "مساء الخير! كيف كان يومك؟",
    "كيف حالك": "الحمد لله بخير! شكراً لسؤالك، كيف حالك أنت؟",
    "كيفك": "الحمد لله تمام! وانت كيفك؟",
    "أهلا": "أهلاً وسهلاً! مرحباً بك معنا",
    "هيا": "تفضل، أنا هنا للمساعدة! عن ماذا تريد أن تسأل؟",
    "تحدث": "أهلاً! عن ماذا تريد أن نتحدث؟ اسأل عن أي شيء",
    "شكرا": "عفواً! أي وقت، أنا هنا للمساعدة دائماً",
    
    // Personal Questions
    "ما اسمك": "أنا مساعدك الذكي! يمكنك أن تناديني 'المساعد'",
    "من أنت": "أنا بوت ذكي مصمم لمساعدتك والإجابة على أسئلتك",
    "ماذا تفعل": "أنا هنا لأساعدك! اسأل عن أي شيء تريد معرفته",
    
    // Geography & Capitals
    "عاصمة مصر": "عاصمة مصر هي القاهرة، أكبر مدينة في الوطن العربي",
    "عاصمة السعودية": "عاصمة المملكة العربية السعودية هي الرياض",
    "عاصمة الإمارات": "عاصمة دولة الإمارات العربية المتحدة هي أبو ظبي",
    "عاصمة فرنسا": "عاصمة فرنسا هي باريس، مدينة النور",
    "عاصمة ألمانيا": "عاصمة ألمانيا هي برلين",
    "عاصمة إنجلترا": "عاصمة إنجلترا هي لندن",
    
    // Science & Inventions
    "مخترع الهاتف": "مخترع الهاتف هو ألكسندر جراهام بيل في عام 1876",
    "مخترع الكهرباء": "توماس أديسون يُعتبر من رواد اختراعات الكهرباء",
    "مخترع الطائرة": "الأخوان رايت هما مخترعا الطائرة في عام 1903",
    "مخترع السيارة": "كارل بنز اخترع أول سيارة في عام 1885",
    
    // General Knowledge
    "كم قارة": "عدد قارات العالم سبع قارات",
    "أكبر محيط": "المحيط الهادئ هو أكبر محيطات العالم",
    "أطول نهر": "نهر النيل هو أطول نهر في العالم",
    "أعلى جبل": "جبل إيفرست هو أعلى جبل في العالم",
    "أكبر دولة": "روسيا هي أكبر دولة في العالم من حيث المساحة",
    
    // Sports
    "كأس العالم": "كأس العالم FIFA هو أهم بطولة كرة قدم في العالم",
    "أولمبياد": "الألعاب الأولمبية تقام كل أربع سنوات",
    
    // Technology
    "ما هو الذكاء الاصطناعي": "الذكاء الاصطناعي هو تقنية تمكن الحاسوب من محاكاة التفكير البشري",
    "ما هو الإنترنت": "الإنترنت هو شبكة عالمية تربط مليارات الأجهزة حول العالم"
};

/**
 * Load responses with intelligent caching and chunking
 */
async function loadMegaResponses() {
    if (responsesData !== null || isLoading) {
        return;
    }
    
    isLoading = true;
    console.log("🔄 Loading mega responses database...");
    
    try {
        // Try to load the main optimized file first
        const mainFile = path.resolve(__dirname, 'responses_mega_optimized.json');
        
        if (fs.existsSync(mainFile)) {
            console.log("📁 Found mega optimized file, loading...");
            const fileContent = fs.readFileSync(mainFile, 'utf-8');
            responsesData = JSON.parse(fileContent);
            
            console.log("✅ Mega responses loaded successfully!");
            console.log(`📊 Total responses: ${Object.keys(responsesData.responses || {}).length}`);
            console.log(`🔍 Keywords indexed: ${Object.keys(responsesData.keywords || {}).length}`);
            
            isLoading = false;
            return;
        }
        
        // If main file doesn't exist, try to load chunks
        console.log("📦 Loading response chunks...");
        responsesData = {
            responses: {},
            keywords: {},
            categories: {},
            statistics: { total_questions: 0 }
        };
        
        let totalLoaded = 0;
        
        for (const chunkFile of RESPONSE_FILES) {
            const chunkPath = path.resolve(__dirname, chunkFile);
            
            if (fs.existsSync(chunkPath)) {
                try {
                    const chunkContent = fs.readFileSync(chunkPath, 'utf-8');
                    const chunkData = JSON.parse(chunkContent);
                    
                    // Merge chunk data
                    Object.assign(responsesData.responses, chunkData.responses || chunkData);
                    Object.assign(responsesData.keywords, chunkData.keywords || {});
                    Object.assign(responsesData.categories, chunkData.categories || {});
                    
                    const chunkSize = Object.keys(chunkData.responses || chunkData).length;
                    totalLoaded += chunkSize;
                    
                    console.log(`✅ Loaded chunk: ${chunkFile} (${chunkSize} responses)`);
                } catch (error) {
                    console.log(`⚠️ Failed to load chunk ${chunkFile}:`, error.message);
                }
            }
        }
        
        responsesData.statistics.total_questions = totalLoaded;
        
        if (totalLoaded > 0) {
            console.log(`🎉 Successfully loaded ${totalLoaded} responses from chunks!`);
        } else {
            console.log("⚠️ No response files found, using enhanced fallback");
            responsesData = { fallback: true, enhanced: true };
        }
        
    } catch (error) {
        console.error("❌ Error loading mega responses:", error);
        responsesData = { fallback: true, enhanced: true };
    }
    
    isLoading = false;
}

/**
 * Advanced search algorithm for large datasets
 */
function findBestResponse(userMessage) {
    const message = userMessage.toLowerCase().trim();
    
    // Use enhanced fallback if no data loaded
    if (!responsesData || responsesData.fallback) {
        console.log("🔍 Using enhanced fallback search");
        
        // Exact match first
        if (ENHANCED_FALLBACK[message]) {
            return ENHANCED_FALLBACK[message];
        }
        
        // Partial match
        for (const [key, response] of Object.entries(ENHANCED_FALLBACK)) {
            if (message.includes(key) || key.includes(message)) {
                return response;
            }
        }
        
        // Keyword-based search in fallback
        const userWords = message.split(/\s+/);
        for (const word of userWords) {
            if (word.length > 2) {
                for (const [key, response] of Object.entries(ENHANCED_FALLBACK)) {
                    if (key.includes(word)) {
                        return response;
                    }
                }
            }
        }
        
        return "عذراً، لم أفهم طلبك. حاول كتابة شيء آخر أو اسأل عن: العواصم، المخترعين، الجغرافيا، الرياضة، أو التكنولوجيا.";
    }
    
    // Advanced search in loaded data
    console.log("🔍 Searching in mega database...");
    
    if (responsesData.responses && responsesData.keywords) {
        let bestMatch = { score: 0, answer: null, question: null };
        const userWords = message.split(/\s+/).filter(word => word.length > 2);
        
        // Quick exact match check first
        for (const [key, data] of Object.entries(responsesData.responses)) {
            if (data.question && data.question.toLowerCase() === message) {
                console.log("⚡ Exact match found!");
                return data.answer;
            }
        }
        
        // Keyword-based search with scoring
        const potentialMatches = new Set();
        const keywordScores = {};
        
        for (const word of userWords) {
            if (responsesData.keywords[word]) {
                responsesData.keywords[word].forEach(key => {
                    potentialMatches.add(key);
                    keywordScores[key] = (keywordScores[key] || 0) + 1;
                });
            }
        }
        
        console.log(`🎯 Found ${potentialMatches.size} potential matches`);
        
        // Score and rank matches
        for (const matchKey of potentialMatches) {
            if (responsesData.responses[matchKey]) {
                const response = responsesData.responses[matchKey];
                const question = response.question.toLowerCase();
                
                let score = keywordScores[matchKey] || 0;
                
                // Additional scoring factors
                for (const word of userWords) {
                    if (question.includes(word)) {
                        score += 2; // Word presence bonus
                    }
                }
                
                // Length similarity bonus
                const lengthDiff = Math.abs(question.length - message.length);
                if (lengthDiff < 10) score += 1;
                
                // Question length bonus (more specific questions rank higher)
                score += question.split(/\s+/).length * 0.1;
                
                if (score > bestMatch.score) {
                    bestMatch = {
                        score: score,
                        answer: response.answer,
                        question: response.question
                    };
                }
            }
        }
        
        if (bestMatch.answer && bestMatch.score > 0) {
            console.log(`✅ Best match found with score: ${bestMatch.score}`);
            return bestMatch.answer;
        }
    }
    
    // Fallback responses for common patterns
    if (message.includes("عاصمة")) {
        return "اسأل عن عاصمة أي دولة، مثل: 'ما عاصمة مصر؟'";
    }
    if (message.includes("مخترع")) {
        return "اسأل عن مخترع أي شيء، مثل: 'من مخترع الهاتف؟'";
    }
    
    return "عذراً، لم أجد إجابة دقيقة لسؤالك. حاول إعادة صياغة السؤال أو اسأل عن موضوع آخر.";
}

/**
 * Main handler with improved performance
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
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: "Missing environment variables" })
        };
    }

    try {
        // Load mega responses asynchronously
        loadMegaResponses().catch(console.error);

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

        if (event.httpMethod === "POST") {
            if (!event.body) {
                return { statusCode: 400, headers, body: "No body provided" };
            }

            const body = JSON.parse(event.body);

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

async function processWebhookEvents(entries) {
    for (const entry of entries) {
        if (entry.messaging) {
            for (const event of entry.messaging) {
                await handleMessagingEvent(event);
            }
        }
    }
}

async function handleMessagingEvent(event) {
    const senderId = event.sender?.id;

    if (!senderId) {
        console.error("❌ No sender ID found");
        return;
    }

    try {
        if (event.message?.text) {
            const userMessage = event.message.text;
            console.log("💬 User message:", userMessage);
            
            const startTime = Date.now();
            const botResponse = findBestResponse(userMessage);
            const searchTime = Date.now() - startTime;
            
            console.log(`🤖 Bot response (${searchTime}ms):`, botResponse.substring(0, 100) + "...");
            
            await sendMessage(senderId, botResponse);
            
        } else if (event.postback?.payload === "GET_STARTED_PAYLOAD") {
            const welcomeMsg = "مرحباً بك! أنا مساعدك الذكي مع قاعدة بيانات ضخمة. اسأل عن أي شيء تريد معرفته!";
            await sendMessage(senderId, welcomeMsg);
        }
    } catch (error) {
        console.error("❌ Error handling message:", error);
        await sendMessage(senderId, "عذراً، حدث خطأ تقني. حاول مرة أخرى.");
    }
}

async function sendMessage(recipientId, messageText) {
    const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;
    
    const payload = {
        recipient: { id: recipientId },
        message: { text: messageText }
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
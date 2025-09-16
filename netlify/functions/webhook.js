// netlify/functions/enhanced-webhook.js

/**
 * دالة الويب هوك الرئيسية - النسخة المحدثة
 */
export async function handler(event, context) {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

  // التحقق من متغيرات البيئة
  if (!VERIFY_TOKEN || !PAGE_ACCESS_TOKEN) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Missing environment variables" })
    };
  }

  try {
    // التحقق من فيسبوك (GET)
    if (event.httpMethod === "GET") {
      const params = event.queryStringParameters || {};
      
      if (params["hub.verify_token"] === VERIFY_TOKEN && params["hub.challenge"]) {
        console.log("✅ تم التحقق من الويب هوك بنجاح");
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

    // التعامل مع الرسائل الواردة (POST)
    if (event.httpMethod === "POST") {
      if (!event.body) {
        return { statusCode: 400, body: "No body provided" };
      }

      let body;
      try {
        body = JSON.parse(event.body);
      } catch (parseError) {
        console.error("❌ خطأ في تحليل JSON:", parseError);
        return { statusCode: 400, body: "Invalid JSON" };
      }

      if (body.object === "page" && body.entry) {
        await processWebhookEvents(body.entry, PAGE_ACCESS_TOKEN);
        return { statusCode: 200, body: "EVENT_RECEIVED" };
      }
      
      return { statusCode: 404, body: "Not Found" };
    }

    return { statusCode: 405, body: "Method Not Allowed" };

  } catch (error) {
    console.error("❌ خطأ عام في الويب هوك:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" })
    };
  }
}

/**
 * معالجة أحداث الويب هوك
 */
async function processWebhookEvents(entries, pageAccessToken) {
  for (const entry of entries) {
    if (entry.messaging) {
      for (const webhookEvent of entry.messaging) {
        await handleMessagingEvent(webhookEvent, pageAccessToken);
      }
    }
  }
}

/**
 * التعامل مع حدث رسالة واحد
 */
async function handleMessagingEvent(webhookEvent, pageAccessToken) {
  const senderId = webhookEvent.sender?.id;
  
  if (!senderId) {
    console.error("❌ لا يوجد معرف مرسل");
    return;
  }

  try {
    // معالجة الرسائل النصية
    if (webhookEvent.message?.text) {
      const userMsg = webhookEvent.message.text.trim();
      console.log("📩 رسالة المستخدم:", userMsg);
      
      const botResponse = await generateResponse(userMsg);
      await sendMessage(senderId, botResponse, pageAccessToken);
    }
    
    // معالجة postback للبداية
    else if (webhookEvent.postback?.payload === "GET_STARTED_PAYLOAD") {
      const welcomeText = "مرحباً بك! أنا مساعدك الذكي. اسألني عن أي شيء.";
      await sendMessage(senderId, welcomeText, pageAccessToken);
    }
    
  } catch (error) {
    console.error("❌ خطأ في معالجة الحدث:", error);
    await sendMessage(senderId, "عذراً، حدث خطأ. حاول مرة أخرى.", pageAccessToken);
  }
}

/**
 * إرسال رسالة إلى المستخدم
 */
async function sendMessage(recipientId, messageText, pageAccessToken) {
  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${pageAccessToken}`;
  
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
      console.log("✅ تم إرسال الرسالة بنجاح");
    } else {
      const errorData = await response.text();
      console.error("❌ فشل إرسال الرسالة:", response.status, errorData);
    }
    
  } catch (error) {
    console.error("❌ خطأ في إرسال الرسالة:", error);
  }
}

/**
 * توليد الرد الذكي - نسخة مبسطة
 */
async function generateResponse(userMsg) {
  const msg = userMsg.toLowerCase().trim();
  
  // قاعدة معرفة مبسطة
  const responses = {
    // التحيات
    'مرحبا': 'مرحباً بك! كيف يمكنني مساعدتك؟',
    'السلام عليكم': 'وعليكم السلام ورحمة الله وبركاته',
    'أهلا': 'أهلاً وسهلاً! اسألني عن أي شيء',
    
    // أسئلة عامة
    'من أنت': 'أنا مساعد ذكي مبرمج لمساعدتك والإجابة على أسئلتك',
    'كيف حالك': 'بخير والحمد لله، كيف يمكنني مساعدتك؟',
    
    // معلومات أساسية
    'عاصمة مصر': 'عاصمة مصر هي القاهرة',
    'عاصمة السعودية': 'عاصمة السعودية هي الرياض',
    'عاصمة الإمارات': 'عاصمة الإمارات هي أبو ظبي',
    
    // علوم
    'ما هي الجاذبية': 'الجاذبية هي قوة جذب بين الأجسام التي لها كتلة',
    'من هو نيوتن': 'إسحاق نيوتن عالم إنجليزي، وضع قوانين الحركة والجاذبية',
    
    // رياضة
    'من فاز بكأس العالم 2022': 'الأرجنتين فازت بكأس العالم 2022 في قطر',
    'من هو محمد صلاح': 'محمد صلاح لاعب مصري في ليفربول',
  };

  // البحث عن رد مطابق
  for (const [pattern, response] of Object.entries(responses)) {
    if (msg.includes(pattern)) {
      return response;
    }
  }

  // البحث المتقدم بالكلمات المفتاحية
  const advancedResponse = getAdvancedResponse(msg);
  if (advancedResponse) {
    return advancedResponse;
  }

  // الرد الافتراضي
  return 'شكراً لك على سؤالك. أحاول فهم ما تريد، هل يمكنك إعادة صياغة السؤال؟';
}

/**
 * البحث المتقدم بالكلمات المفتاحية
 */
function getAdvancedResponse(msg) {
  // كلمات مفتاحية للعواصم
  if (msg.includes('عاصمة') || msg.includes('عاصمه')) {
    const countries = {
      'فرنسا': 'باريس',
      'ألمانيا': 'برلين', 
      'إيطاليا': 'روما',
      'اليابان': 'طوكيو',
      'الصين': 'بكين',
      'أمريكا': 'واشنطن',
      'كندا': 'أوتاوا',
      'أستراليا': 'كانبرا'
    };
    
    for (const [country, capital] of Object.entries(countries)) {
      if (msg.includes(country)) {
        return `عاصمة ${country} هي ${capital}`;
      }
    }
    return 'من فضلك اذكر اسم الدولة التي تريد معرفة عاصمتها';
  }

  // معلومات علمية
  if (msg.includes('ما هو') || msg.includes('ما هي')) {
    const science = {
      'الذكاء الاصطناعي': 'الذكاء الاصطناعي هو تقنية تمكن الحاسوب من محاكاة التفكير البشري',
      'الانترنت': 'الإنترنت هو شبكة عالمية تربط أجهزة الحاسوب حول العالم',
      'البرمجة': 'البرمجة هي كتابة تعليمات للحاسوب لتنفيذ مهام محددة'
    };
    
    for (const [term, definition] of Object.entries(science)) {
      if (msg.includes(term)) {
        return definition;
      }
    }
  }

  // أسئلة الوقت
  if (msg.includes('متى')) {
    if (msg.includes('رمضان')) {
      return 'رمضان يأتي في الشهر التاسع من التقويم الهجري، وموعده يتغير كل عام';
    }
  }

  return null;
}

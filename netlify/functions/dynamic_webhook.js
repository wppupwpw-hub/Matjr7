// netlify/functions/webhook.js

export async function handler(event, context) {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

  // ✅ التحقق من فيسبوك
  if (event.httpMethod === "GET") {
    const params = event.queryStringParameters;
    if (params["hub.verify_token"] === VERIFY_TOKEN) {
      return {
        statusCode: 200,
        body: params["hub.challenge"],
      };
    }
    return { statusCode: 403, body: "Forbidden" };
  }

  // ✅ التعامل مع الرسائل الواردة
  if (event.httpMethod === "POST") {
    const body = JSON.parse(event.body);

    if (body.object === "page") {
      for (const entry of body.entry) {
        const webhookEvent = entry.messaging[0];
        const senderId = webhookEvent.sender.id;

        if (webhookEvent.message) {
          const userMsg = webhookEvent.message.text ? webhookEvent.message.text.trim() : '';
          console.log("📩 رسالة المستخدم:", userMsg);
          
          const botResponse = generateDynamicResponse(userMsg);
          await sendMessage(senderId, botResponse, PAGE_ACCESS_TOKEN);
          
        } else if (webhookEvent.postback && webhookEvent.postback.payload === "GET_STARTED_PAYLOAD") {
          const welcomeText = "أهلاً بك! أنا مساعدك الذكي. يمكنك سؤالي عن:\n\n🌍 الجغرافيا والعواصم\n🔬 العلوم والتكنولوجيا\n📚 التاريخ والحضارات\n🏃‍♂️ الرياضة\n🎭 الثقافة والأدب\n🍽️ الطعام والمطبخ\n🏥 الصحة والطب\n💼 الاقتصاد والمال\n🐾 الحيوانات والطبيعة\n🌌 الفضاء والكواكب\n\nاسأل أي سؤال وسأجيبك!";
          await sendMessage(senderId, welcomeText, PAGE_ACCESS_TOKEN);
        }
      }
      return { statusCode: 200, body: "EVENT_RECEIVED" };
    }
    return { statusCode: 404, body: "Not Found" };
  }

  return { statusCode: 405, body: "Method Not Allowed" };
}

// 🧠 دالة توليد الردود الديناميكية
function generateDynamicResponse(userMsg) {
  const msg = userMsg.toLowerCase().trim();

  // أنماط الأسئلة المختلفة
  const patterns = {
    // العواصم والجغرافيا
    capitals: {
      keywords: ['عاصمة', 'عاصمه'],
      handler: handleCapitalQuestions
    },
    
    // العلوم
    science: {
      keywords: ['مخترع', 'مكتشف', 'عالم', 'اختراع', 'اكتشاف'],
      handler: handleScienceQuestions
    },
    
    // التاريخ
    history: {
      keywords: ['متى', 'تاريخ', 'حدث', 'حرب', 'معركة', 'سنة'],
      handler: handleHistoryQuestions
    },
    
    // الرياضة
    sports: {
      keywords: ['رياضة', 'كأس', 'بطولة', 'أولمبياد', 'فريق', 'لاعب'],
      handler: handleSportsQuestions
    },
    
    // الطب والصحة
    health: {
      keywords: ['صحة', 'طب', 'مرض', 'علاج', 'دواء', 'طبيب'],
      handler: handleHealthQuestions
    },
    
    // الحيوانات
    animals: {
      keywords: ['حيوان', 'حيوانات', 'طائر', 'سمك', 'نبات'],
      handler: handleAnimalQuestions
    },
    
    // الأرقام والإحصائيات
    numbers: {
      keywords: ['كم عدد', 'كم', 'عدد', 'كمية', 'مقدار'],
      handler: handleNumberQuestions
    },
    
    // الألوان والأشكال
    colors: {
      keywords: ['لون', 'أحمر', 'أزرق', 'أخضر', 'أصفر', 'أسود', 'أبيض'],
      handler: handleColorQuestions
    },
    
    // الطعام
    food: {
      keywords: ['طعام', 'أكل', 'مطبخ', 'وصفة', 'طبق', 'فاكهة', 'خضار'],
      handler: handleFoodQuestions
    },
    
    // التكنولوجيا
    technology: {
      keywords: ['تقنية', 'تكنولوجيا', 'كمبيوتر', 'هاتف', 'انترنت', 'تطبيق'],
      handler: handleTechnologyQuestions
    }
  };

  // البحث عن النمط المناسب
  for (const [category, pattern] of Object.entries(patterns)) {
    if (pattern.keywords.some(keyword => msg.includes(keyword))) {
      return pattern.handler(msg);
    }
  }

  // أسئلة شائعة مباشرة
  const directAnswers = getDirectAnswers();
  for (const [question, answer] of Object.entries(directAnswers)) {
    if (msg.includes(question) || question.includes(msg)) {
      return answer;
    }
  }

  // إذا لم يتم العثور على تطابق
  return generateGenericResponse(msg);
}

// معالج أسئلة العواصم
function handleCapitalQuestions(msg) {
  const countries = {
    'مصر': 'القاهرة',
    'السعودية': 'الرياض',
    'الإمارات': 'أبو ظبي',
    'فرنسا': 'باريس',
    'ألمانيا': 'برلين',
    'اليابان': 'طوكيو',
    'الصين': 'بكين',
    'أمريكا': 'واشنطن',
    'روسيا': 'موسكو',
    'المغرب': 'الرباط',
    'الجزائر': 'الجزائر',
    'تونس': 'تونس',
    'الأردن': 'عمان',
    'لبنان': 'بيروت',
    'سوريا': 'دمشق',
    'العراق': 'بغداد',
    'الكويت': 'الكويت',
    'قطر': 'الدوحة',
    'البحرين': 'المنامة',
    'عمان': 'مسقط',
    'اليمن': 'صنعاء',
    'السودان': 'الخرطوم',
    'ليبيا': 'طرابلس',
    'إيطاليا': 'روما',
    'إسبانيا': 'مدريد',
    'المملكة المتحدة': 'لندن',
    'كندا': 'أوتاوا',
    'أستراليا': 'كانبرا',
    'البرازيل': 'برازيليا',
    'الهند': 'نيو دلهي',
    'تركيا': 'أنقرة',
    'إيران': 'طهران'
  };

  for (const [country, capital] of Object.entries(countries)) {
    if (msg.includes(country)) {
      return `عاصمة ${country} هي ${capital}.`;
    }
  }
  
  return "يرجى تحديد الدولة التي تريد معرفة عاصمتها.";
}

// معالج أسئلة العلوم
function handleScienceQuestions(msg) {
  const scienceAnswers = {
    'الجاذبية': 'مكتشف الجاذبية هو إسحاق نيوتن.',
    'البنسلين': 'مكتشف البنسلين هو ألكسندر فليمنغ.',
    'الهاتف': 'مخترع الهاتف هو ألكسندر غراهام بيل.',
    'المصباح': 'مخترع المصباح الكهربائي هو توماس أديسون.',
    'الراديو': 'مخترع الراديو هو ماركوني.',
    'التلفزيون': 'مخترع التلفزيون هو جون لوجي بيرد.',
    'النسبية': 'نظرية النسبية وضعها ألبرت أينشتاين.',
    'التطور': 'نظرية التطور وضعها تشارلز داروين.',
    'الكهرباء': 'بنجامين فرانكلين كان من رواد اكتشاف الكهرباء.',
    'الطيران': 'الأخوان رايت هما أول من طار بطائرة.'
  };

  for (const [topic, answer] of Object.entries(scienceAnswers)) {
    if (msg.includes(topic)) {
      return answer;
    }
  }

  return "أرجو تحديد الاختراع أو الاكتشاف العلمي الذي تريد معرفة المزيد عنه.";
}

// معالج أسئلة التاريخ
function handleHistoryQuestions(msg) {
  if (msg.includes('الحرب العالمية الأولى')) {
    return 'الحرب العالمية الأولى حدثت من 1914 إلى 1918.';
  }
  if (msg.includes('الحرب العالمية الثانية')) {
    return 'الحرب العالمية الثانية حدثت من 1939 إلى 1945.';
  }
  if (msg.includes('فتح مكة')) {
    return 'فتح مكة كان في السنة الثامنة للهجرة (629-630 م).';
  }
  if (msg.includes('معركة اليرموك')) {
    return 'معركة اليرموك حدثت عام 636 م بين المسلمين والبيزنطيين.';
  }
  if (msg.includes('سقوط الأندلس')) {
    return 'سقوط الأندلس حدث عام 1492 م مع سقوط غرناطة.';
  }

  return "يرجى تحديد الحدث التاريخي الذي تريد معرفة تاريخه.";
}

// معالج أسئلة الرياضة
function handleSportsQuestions(msg) {
  const sportsAnswers = {
    'كأس العالم': 'كأس العالم لكرة القدم تقام كل 4 سنوات وتنظمها الفيفا.',
    'الأولمبياد': 'الألعاب الأولمبية تقام كل 4 سنوات صيفاً وشتاءً.',
    'ريال مدريد': 'ريال مدريد نادي إسباني من مدريد، الأكثر فوزاً بدوري أبطال أوروبا.',
    'برشلونة': 'برشلونة نادي إسباني من كاتالونيا، مشهور بأسلوب اللعب الجميل.',
    'محمد صلاح': 'محمد صلاح لاعب مصري يلعب في ليفربول الإنجليزي.',
    'الأهلي': 'الأهلي من أكثر الأندية فوزاً في مصر والقارة الأفريقية.',
    'الزمالك': 'الزمالك نادي مصري عريق ومن أقوى أندية أفريقيا.'
  };

  for (const [topic, answer] of Object.entries(sportsAnswers)) {
    if (msg.includes(topic)) {
      return answer;
    }
  }

  return "أخبرني عن أي فريق أو بطولة رياضية تريد معرفة المزيد عنها.";
}

// معالج أسئلة الصحة
function handleHealthQuestions(msg) {
  const healthTips = [
    "شرب 8 أكواب من الماء يومياً مهم للصحة.",
    "ممارسة الرياضة 30 دقيقة يومياً تحسن الصحة العامة.",
    "تناول 5 حصص من الفواكه والخضروات يومياً مفيد جداً.",
    "النوم 7-8 ساعات ليلاً ضروري لصحة الجسم والعقل.",
    "تجنب التدخين والكحول يحسن الصحة بشكل كبير.",
    "غسل اليدين بانتظام يمنع انتشار الأمراض.",
    "الفحص الطبي الدوري مهم للكشف المبكر عن الأمراض."
  ];

  return healthTips[Math.floor(Math.random() * healthTips.length)];
}

// معالج أسئلة الحيوانات
function handleAnimalQuestions(msg) {
  const animalFacts = {
    'الفيل': 'الفيل أكبر حيوان بري في العالم، ويمكن أن يزن حتى 6 أطنان.',
    'الأسد': 'الأسد يسمى ملك الغابة ويعيش في أفريقيا وآسيا.',
    'النمر': 'النمر أكبر القطط البرية ويمكن أن يقفز 9 أمتار.',
    'الفهد': 'الفهد أسرع حيوان بري بسرعة تصل إلى 120 كم/ساعة.',
    'الزرافة': 'الزرافة أطول حيوان في العالم بارتفاع يصل إلى 5.5 متر.',
    'الحوت': 'الحوت الأزرق أكبر حيوان في العالم.',
    'النسر': 'النسر من الطيور الجارحة ويمكنه الطيران على ارتفاعات عالية.',
    'البطريق': 'البطريق طائر لا يطير لكنه سباح ماهر.'
  };

  for (const [animal, fact] of Object.entries(animalFacts)) {
    if (msg.includes(animal)) {
      return fact;
    }
  }

  return "أخبرني عن أي حيوان تريد معرفة حقائق مثيرة عنه.";
}

// معالج الأسئلة الرقمية
function handleNumberQuestions(msg) {
  const numberAnswers = {
    'كم عدد أسنان الإنسان': 'الإنسان البالغ لديه 32 سن.',
    'كم عدد عظام الإنسان': 'الإنسان البالغ لديه 206 عظمة.',
    'كم عدد دول العالم': 'يوجد 195 دولة معترف بها في العالم.',
    'كم عدد قارات العالم': 'يوجد 7 قارات في العالم.',
    'كم عدد المحيطات': 'يوجد 5 محيطات في العالم.',
    'كم عدد أيام السنة': 'السنة العادية 365 يوم والكبيسة 366 يوم.',
    'كم عدد ساعات اليوم': 'اليوم الواحد 24 ساعة.',
    'كم عدد دقائق الساعة': 'الساعة الواحدة 60 دقيقة.'
  };

  for (const [question, answer] of Object.entries(numberAnswers)) {
    if (msg.includes(question.substring(0, 15))) {
      return answer;
    }
  }

  return "أخبرني بالضبط ما تريد معرفة عدده.";
}

// معالج أسئلة الألوان
function handleColorQuestions(msg) {
  if (msg.includes('ألوان قوس قزح')) {
    return 'ألوان قوس قزح هي: أحمر، برتقالي، أصفر، أخضر، أزرق، نيلي، بنفسجي.';
  }
  if (msg.includes('لون الدم')) {
    return 'لون الدم أحمر بسبب الهيموجلوبين.';
  }
  if (msg.includes('لون السماء')) {
    return 'لون السماء أزرق بسبب تشتت ضوء الشمس في الغلاف الجوي.';
  }
  return "أخبرني عن أي لون تريد معرفة المزيد عنه.";
}

// معالج أسئلة الطعام
function handleFoodQuestions(msg) {
  const foodFacts = {
    'البيتزا': 'البيتزا طبق إيطالي شهير انتشر في العالم.',
    'السوشي': 'السوشي طبق ياباني تقليدي من السمك والأرز.',
    'الكبسة': 'الكبسة طبق شعبي خليجي مع الأرز واللحم.',
    'المنسف': 'المنسف الطبق الشعبي الأردني مع اللحم واللبن.',
    'الكشري': 'الكشري طبق مصري شعبي من الأرز والعدس والمكرونة.',
    'التبولة': 'التبولة سلطة لبنانية من البرغل والخضروات.',
    'الحمص': 'الحمص طبق شرق أوسطي مغذي ولذيذ.'
  };

  for (const [food, info] of Object.entries(foodFacts)) {
    if (msg.includes(food)) {
      return info;
    }
  }

  return "أخبرني عن أي طبق أو طعام تريد معرفة معلومات عنه.";
}

// معالج أسئلة التكنولوجيا
function handleTechnologyQuestions(msg) {
  const techAnswers = {
    'الذكاء الاصطناعي': 'الذكاء الاصطناعي تقنية تمكن الآلات من محاكاة الذكاء البشري.',
    'البلوك تشين': 'البلوك تشين تقنية لحفظ البيانات بطريقة آمنة وموزعة.',
    'الواقع الافتراضي': 'الواقع الافتراضي تقنية تخلق بيئة رقمية تفاعلية.',
    'الواقع المعزز': 'الواقع المعزز يدمج العالم الرقمي مع الحقيقي.',
    'إنترنت الأشياء': 'إنترنت الأشياء يربط الأجهزة المختلفة بالإنترنت.',
    'الحوسبة السحابية': 'الحوسبة السحابية توفر الخدمات التقنية عبر الإنترنت.'
  };

  for (const [tech, explanation] of Object.entries(techAnswers)) {
    if (msg.includes(tech)) {
      return explanation;
    }
  }

  return "أخبرني عن أي تقنية تريد معرفة المزيد عنها.";
}

// إجابات مباشرة للأسئلة الشائعة
function getDirectAnswers() {
  return {
    'مرحبا': 'مرحباً بك! كيف يمكنني مساعدتك اليوم؟',
    'السلام عليكم': 'وعليكم السلام ورحمة الله وبركاته. أهلاً بك!',
    'شكرا': 'العفو! سعيد بمساعدتك.',
    'كيف الحال': 'الحمد لله، أنا بخير. كيف يمكنني مساعدتك؟',
    'ما اسمك': 'أنا مساعد ذكي، يمكنك مناداتي بأي اسم تحب.',
    'من أنت': 'أنا مساعد ذكي مصمم للإجابة على أسئلتك المختلفة.',
    'ما هو عملك': 'عملي هو مساعدتك في الحصول على المعلومات التي تحتاجها.',
    'هل تتكلم عربي': 'نعم، أتكلم العربية وأسعد بالتحدث معك بها.',
    'أين تعيش': 'أنا موجود في العالم الرقمي لمساعدتك أينما كنت.',
    'كم عمرك': 'أنا برنامج ذكي، فعمري يقاس بالتحديثات وليس بالسنوات.'
  };
}

// توليد رد عام
function generateGenericResponse(msg) {
  const genericResponses = [
    "سؤال ممتاز! دعني أبحث لك عن إجابة مفيدة.",
    "أعتذر، لا أملك معلومات دقيقة حول هذا الموضوع حالياً.",
    "يمكنك إعادة صياغة سؤالك أو سؤالي عن موضوع آخر.",
    "هذا موضوع مثير للاهتمام! لكن قد تحتاج لمصادر متخصصة للحصول على إجابة دقيقة.",
    "أقدر سؤالك، ولكن قد يكون من الأفضل استشارة خبير في هذا المجال.",
    "سؤال رائع! يمكنك سؤالي عن الجغرافيا والعلوم والتاريخ والرياضة والصحة."
  ];

  return genericResponses[Math.floor(Math.random() * genericResponses.length)];
}

// 🔹 دالة لإرسال رسالة نصية
async function sendMessage(senderId, text, token) {
  await fetch(`https://graph.facebook.com/v16.0/me/messages?access_token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: senderId },
      message: { text },
    }),
  });
}
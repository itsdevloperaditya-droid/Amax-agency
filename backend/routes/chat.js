const express = require('express');
const router = express.Router();
const knowledgeBase = require('../knowledge-base');

let groq = null;
try {
  const Groq = require('groq-sdk');
  if (process.env.GROQ_API_KEY) {
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
} catch (e) {
  console.log('Groq SDK not available');
}

// ─── Smart Intent Detection ───────────────────────────────────────────
function detectIntent(query) {
  const q = query.toLowerCase().trim();

  const intents = {
    greeting: /^(hi|hello|hey|namaste|hii|hiii|sup|yo|kya haal|howdy|good morning|good evening|good night|greetings)/i,
    pricing: /price|pricing|cost|costing|rate|rates|kitna|kitne|paisa|rupees|₹|charge|charges|budget|afford|expensive|cheap|sasta|mehnga|discount|offer/i,
    service: /service|services|kya karte|kya kya|offer|provide|kaam|work|karta|karti/i,
    video: /video|editing|edit|youtube|reels|shorts|cinematic|vlog|footage|premiere|after effect|davinci|capcut/i,
    thumbnail: /thumbnail|thumb|youtube thumbnail|banner|cover image|photoshop thumbnail/i,
    website: /website|web|site|landing page|portfolio|ecommerce|e-commerce|html|react|wordpress|web app|web development/i,
    graphic: /graphic|logo|brand|branding|poster|banner|social media post|design|illustrator|figma/i,
    freelancer_join: /join|freelancer|creator|earn|work with|apply|onboard|register|sign up|partner|collaborate|income|paise kama/i,
    hire: /hire|need|want|book|order|require|looking for|chahiye|mujhe/i,
    delivery: /delivery|time|kitna din|how long|duration|timeline|deadline|fast|urgent|jaldi|kab tak/i,
    revision: /revision|change|modify|alter|redo|fix|sudhar|badlav/i,
    testimonial: /review|testimonial|feedback|client|experience|rating|kya kehte|log kya/i,
    contact: /contact|phone|email|whatsapp|call|reach|connect|number|mobile|sampark/i,
    about: /about|kaun|who|kya hai|tell me|about amax|amax ke baare/i,
    portfolio: /portfolio|sample|example|work|kaam dikhao|previous|past|dikhao/i,
    payment: /payment|pay|kaise|upi|bank|method|payment method|online|offline/i,
    comparison: /compare|difference|better|best|kaunsa|which one|vs|versus/i,
    thanks: /thanks|thank you|shukriya|dhanyavaad|thanku|thx|ty/i,
    farewell: /bye|goodbye|alvida|phir milenge|see you|tata|bye bye/i,
    help: /help|madad|kaise|how to|guide|assist|support/i,
    tech: /tech|technology|tools|software|kaunsa tool|which tool|use kya/i,
    quality: /quality|best|premium|professional|accha|badhiya|top|high quality/i,
    urgent: /urgent|asap|immediately|turant|jaldi se|emergency|quick/i,
    refund: /refund|money back|return|wapis|cancel/i,
    collaboration: /collab|collaboration|partnership|bulk|wholesale|multiple|zyada/i,
  };

  for (const [intent, pattern] of Object.entries(intents)) {
    if (pattern.test(q)) return intent;
  }

  return 'general';
}

// ─── Enhanced Context Retrieval ───────────────────────────────────────
function findRelevantContext(query, intent) {
  const lowerQuery = query.toLowerCase();
  const results = [];

  // Service-specific context
  const serviceMap = {
    video: 0,
    thumbnail: 1,
    website: 2,
    graphic: 3
  };

  if (serviceMap[intent] !== undefined) {
    const service = knowledgeBase.services[serviceMap[intent]];
    results.push({
      type: 'service',
      name: service.name,
      score: 5,
      content: JSON.stringify(service)
    });
  }

  // Check all services for keyword matches
  knowledgeBase.services.forEach(service => {
    const score = service.tags.filter(tag => lowerQuery.includes(tag)).length;
    if (score > 0) {
      results.push({
        type: 'service',
        name: service.name,
        score: score * 2,
        content: JSON.stringify(service)
      });
    }
  });

  // FAQ matching
  knowledgeBase.faq.forEach(faq => {
    const qWords = faq.question.toLowerCase().split(' ');
    const matchCount = qWords.filter(w => w.length > 3 && lowerQuery.includes(w)).length;
    if (matchCount > 0 || ['how', 'what', 'do you', 'kya', 'kaise'].some(w => lowerQuery.includes(w))) {
      results.push({
        type: 'faq',
        score: matchCount > 0 ? 4 : 2,
        content: JSON.stringify(faq)
      });
    }
  });

  // Freelancer context
  if (intent === 'freelancer_join' || ['join', 'freelancer', 'creator', 'earn', 'work', 'apply', 'paise', 'income'].some(w => lowerQuery.includes(w))) {
    results.push({
      type: 'freelancer',
      score: 5,
      content: JSON.stringify(knowledgeBase.freelancer)
    });
  }

  // Contact context
  if (intent === 'contact' || ['contact', 'email', 'phone', 'whatsapp', 'reach', 'call', 'number'].some(w => lowerQuery.includes(w))) {
    results.push({
      type: 'contact',
      score: 5,
      content: JSON.stringify(knowledgeBase.contact)
    });
  }

  // Stats context
  if (['experience', 'years', 'projects', 'clients', 'rating', 'trusted', 'reviews', 'stats', 'kitne'].some(w => lowerQuery.includes(w))) {
    results.push({
      type: 'stats',
      score: 3,
      content: JSON.stringify(knowledgeBase.stats)
    });
  }

  // Testimonials
  if (intent === 'testimonial' || ['testimonial', 'review', 'client', 'feedback', 'experience', 'kya kehte'].some(w => lowerQuery.includes(w))) {
    results.push({
      type: 'testimonials',
      score: 3,
      content: JSON.stringify(knowledgeBase.testimonials)
    });
  }

  // About
  if (intent === 'about' || ['about', 'who', 'what is amax', 'amax kya', 'tell me about', 'kaun'].some(w => lowerQuery.includes(w))) {
    results.push({
      type: 'about',
      score: 4,
      content: JSON.stringify(knowledgeBase.about)
    });
  }

  // Portfolio
  if (intent === 'portfolio' || ['portfolio', 'sample', 'example', 'work', 'kaam', 'previous', 'past', 'dikhao'].some(w => lowerQuery.includes(w))) {
    results.push({
      type: 'portfolio',
      score: 4,
      content: JSON.stringify({
        portfolioUrl: "portfolio.html",
        services: knowledgeBase.services.map(s => ({ name: s.name, description: s.description })),
        testimonials: knowledgeBase.testimonials,
        stats: knowledgeBase.stats
      })
    });
  }

  // Payment
  if (intent === 'payment' || ['payment', 'pay', 'kaise', 'upi', 'bank', 'method', 'online'].some(w => lowerQuery.includes(w))) {
    results.push({
      type: 'payment',
      score: 4,
      content: JSON.stringify({
        methods: "UPI, Bank Transfer, PayPal, Google Pay, PhonePe",
        terms: "50% advance, 50% on delivery. Full payment for small projects.",
        cta: "💳 [Discuss Payment](https://wa.me/919509136278?text=Hi%20Amax%2C%20I%20want%20to%20discuss%20payment)"
      })
    });
  }

  // Sort by score, deduplicate, return top 5
  results.sort((a, b) => b.score - a.score);
  const unique = [];
  const seen = new Set();
  for (const r of results) {
    const key = `${r.type}-${r.name || ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(r);
    }
  }
  return unique.slice(0, 5);
}

// ─── Off-Topic Filter ─────────────────────────────────────────────────
function isOffTopic(query, intent) {
  if (['greeting', 'thanks', 'farewell', 'help'].includes(intent)) return false;

  const offTopicPatterns = [
    /weather|mausam|news|politics|cricket|movie|song|game|joke|chutkula/,
    /meaning of life|president|capital of|history of|science|math/,
    /recipe|food|cooking|health|medical|stock market|crypto|bitcoin/,
    /hack|crack|illegal|free download|torrent/
  ];

  return offTopicPatterns.some(pattern => pattern.test(query.toLowerCase()));
}

// ─── Build System Prompt ──────────────────────────────────────────────
function buildSystemPrompt(context, intent) {
  const contextText = context.map(c => {
    try {
      const data = JSON.parse(c.content);
      return `[${c.type.toUpperCase()}] ${JSON.stringify(data, null, 2)}`;
    } catch {
      return `[${c.type.toUpperCase()}] ${c.content}`;
    }
  }).join('\n\n---\n\n');

  return `You are Amax AI - a smart, friendly, and professional assistant for Amax Creative Marketplace.

ABOUT AMAX:
Amax is a premium creative marketplace connecting skilled editors, designers, and developers with clients. Services include Video Editing, Thumbnail Design, Web Development, and Graphic Design.

CONTEXT DATA:
${contextText}

YOUR RULES:
1. ONLY use the context provided above. Do NOT make up information.
2. Keep responses SHORT, CLEAR, and HELPFUL (2-5 sentences).
3. Match the user's language - if they write in Hindi/Hinglish, respond in Hinglish. If English, respond in English.
4. ALWAYS end with a relevant CTA (Call to Action) with WhatsApp link.
5. Be friendly, professional, and conversion-focused.
6. Use emojis sparingly to make responses engaging.
7. For pricing questions, give exact ranges from context.
8. For service questions, describe what Amax offers clearly.
9. If asked about joining as freelancer, explain the process step by step.
10. If asked about portfolio/work, mention the portfolio page and client testimonials.

CTA FORMAT (always use these links):
- WhatsApp: https://wa.me/919509136278
- Services page: services.html
- Portfolio page: portfolio.html
- Join freelancer: index.html

RESPONSE STYLE:
- Be conversational, not robotic
- Use bullet points for lists
- Highlight key info (pricing, delivery time)
- Always guide users toward WhatsApp for detailed discussions

OFF-TOPIC RULE:
If the question is NOT related to Amax services, pricing, hiring, joining, creative work, payments, or freelancing - politely say you can only help with Amax-related things and redirect to services.`;
}

// ─── Quick Responses (no AI needed) ──────────────────────────────────
function getQuickResponse(query, intent) {
  const q = query.toLowerCase().trim();
  const wa = "https://wa.me/919509136278";

  // Thanks
  if (intent === 'thanks') {
    return "You're welcome! 😊 Agar koi aur sawaal ho toh pucho. 🚀 [Chat on WhatsApp](${wa})";
  }

  // Farewell
  if (intent === 'farewell') {
    return "Bye! 👋 Take care. Jab bhi zaroorat ho, hum WhatsApp pe available hain. 🚀 [Message Us](${wa})";
  }

  // Greeting
  if (intent === 'greeting') {
    return `Hey! 👋 Welcome to Amax! Main aapki madad kar sakta hoon:\n\n🎬 Video Editing\n🎨 Thumbnail Design\n💻 Web Development\n🖌️ Graphic Design\n💰 Join as Freelancer\n\nBataiye, kya chahiye? 🚀 [Get Started](${wa})`;
  }

  return null;
}

// ─── Main Chat Handler ────────────────────────────────────────────────
router.post('/api/chat', async (req, res) => {
  try {
    const { message, chatHistory = [] } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Detect intent
    const intent = detectIntent(message);

    // Quick responses for simple intents
    const quickResponse = getQuickResponse(message, intent);
    if (quickResponse) {
      return res.json({ response: quickResponse, intent, quick: true });
    }

    // Off-topic check
    if (isOffTopic(message, intent)) {
      return res.json({
        response: "Sorry yaar, I can only help with Amax-related stuff like services, pricing, joining as freelancer, and creative work. 🎨\n\n🚀 [Get Started on WhatsApp](https://wa.me/919509136278)",
        intent: 'offtopic',
        isOffTopic: true
      });
    }

    // Find relevant context
    const context = findRelevantContext(message, intent);

    // Generic response if no context
    if (context.length === 0) {
      return res.json({
        response: "Hey! I can help you with:\n\n🎬 Video Editing - YouTube, Reels, Cinematic edits\n🎨 Thumbnail Design - High CTR thumbnails\n💻 Web Development - Modern, responsive sites\n🖌️ Graphic Design - Logos, branding, social media\n💰 Join as Freelancer - Earn with your skills\n\nBataiye kya chahiye? 🚀 [Get Started](https://wa.me/919509136278)",
        intent: 'general',
        isGeneric: true
      });
    }

    // Call Groq AI
    if (groq) {
      try {
        const systemPrompt = buildSystemPrompt(context, intent);

        // Build conversation history (last 8 messages for better context)
        const historyMessages = [];
        const recentHistory = chatHistory.slice(-8);

        for (const msg of recentHistory) {
          historyMessages.push({
            role: msg.isUser ? 'user' : 'assistant',
            content: msg.text
          });
        }

        const messages = [
          { role: 'system', content: systemPrompt },
          ...historyMessages,
          { role: 'user', content: message }
        ];

        const completion = await groq.chat.completions.create({
          messages,
          model: 'llama-3.3-70b-versatile',
          temperature: 0.4,
          max_tokens: 500,
          top_p: 0.9,
          stream: false,
        });

        const responseText = completion.choices[0]?.message?.content || "Sorry, main abhi respond nahi kar pa raha. Please try again!";

        res.json({
          response: responseText,
          intent,
          context: context.map(c => c.type)
        });

      } catch (aiError) {
        console.log('Groq AI unavailable, using fallback:', aiError.message);
        const fallbackResponse = generateFallbackResponse(message, context, intent);
        res.json({
          response: fallbackResponse,
          intent,
          context: context.map(c => c.type),
          fallback: true
        });
      }
    } else {
      console.log('Groq API key not set, using fallback response');
      const fallbackResponse = generateFallbackResponse(message, context, intent);
      res.json({
        response: fallbackResponse,
        intent,
        context: context.map(c => c.type),
        fallback: true
      });
    }

  } catch (error) {
    console.error('Chat API Error:', error.message);
    res.status(500).json({
      error: 'Failed to get response',
      response: "Sorry, I'm having trouble right now. Please try again or contact us directly on 🚀 [WhatsApp](https://wa.me/919509136278)"
    });
  }
});

// ─── Fallback Response Generator ──────────────────────────────────────
function generateFallbackResponse(message, context, intent) {
  const wa = "https://wa.me/919509136278";
  let response = '';
  const lines = [];

  context.forEach(ctx => {
    try {
      const data = JSON.parse(ctx.content);

      if (ctx.type === 'service') {
        lines.push(`🎯 **${data.name}**`);
        lines.push(data.description);
        if (data.pricing) lines.push(`💰 ${data.pricing}`);
        if (data.delivery) lines.push(`⏱️ ${data.delivery}`);
        if (data.tools) lines.push(`🛠️ Tools: ${data.tools}`);
        lines.push('');
      } else if (ctx.type === 'faq') {
        lines.push(`❓ ${data.question}`);
        lines.push(`✅ ${data.answer}`);
        lines.push('');
      } else if (ctx.type === 'freelancer') {
        lines.push(`💰 **Join as Creator/Freelancer**`);
        lines.push(data.description);
        lines.push(`📋 Process: ${data.process}`);
        lines.push(`🛠️ Skills: ${data.skills.join(', ')}`);
        lines.push(`💵 Pricing: ${data.pricing}`);
        lines.push('');
      } else if (ctx.type === 'contact') {
        lines.push(`📧 Email: ${data.email}`);
        lines.push(`📞 Phone: ${data.phone}`);
        lines.push(`💬 WhatsApp: ${data.whatsapp}`);
        lines.push('');
      } else if (ctx.type === 'stats') {
        lines.push(`📊 **Amax Stats**`);
        lines.push(`⏳ Experience: ${data.yearsExperience}`);
        lines.push(`📁 Projects: ${data.projectsCompleted}`);
        lines.push(`👥 Clients: ${data.happyClients}`);
        lines.push(`⭐ Rating: ${data.rating}`);
        lines.push('');
      } else if (ctx.type === 'testimonials') {
        lines.push(`⭐ **Client Reviews**`);
        data.forEach(t => {
          lines.push(`"${t.text}" — ${t.name} (${t.service})`);
        });
        lines.push('');
      } else if (ctx.type === 'about') {
        lines.push(`🏢 **About Amax**`);
        lines.push(data.description);
        lines.push(`🎯 Mission: ${data.mission}`);
        lines.push('');
      } else if (ctx.type === 'portfolio') {
        lines.push(`🎨 **Our Portfolio**`);
        lines.push(`We've completed 200+ projects across all services!`);
        lines.push(`📁 [View Our Work](portfolio.html)`);
        lines.push('');
      } else if (ctx.type === 'payment') {
        lines.push(`💳 **Payment Methods**`);
        lines.push(`${data.methods}`);
        lines.push(`📋 Terms: ${data.terms}`);
        lines.push('');
      }
    } catch {
      lines.push(ctx.content);
    }
  });

  response = lines.join('\n');
  if (!response) {
    response = "Hey! I can help you with our services. Bataiye kya chahiye? 🚀";
  }

  return response + `🚀 [Get Started on WhatsApp](${wa})`;
}

module.exports = router;

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

// ─── Website Map ──────────────────────────────────────────────────────
const WEBSITE_PAGES = {
  home: { url: "index.html", desc: "Homepage with all services, hire freelancer, and join as creator options" },
  services: { url: "services.html", desc: "Detailed service pages with pricing and hiring flow" },
  portfolio: { url: "portfolio.html", desc: "Portfolio gallery showing video editing samples and thumbnail designs" },
  videoView: { url: "video-view.html", desc: "Individual video project viewer page" },
  admin: { url: "admin.html", desc: "Admin dashboard for managing users and projects" },
  workerOnboarding: { url: "worker-onboarding.html", desc: "Freelancer/creator application and onboarding form" },
  workerDashboard: { url: "worker-dashboard.html", desc: "Freelancer dashboard to manage profile and projects" }
};

// ─── Service Inquiry Flows ────────────────────────────────────────────
const INQUIRY_FLOWS = {
  video: {
    name: "Video Editing",
    emoji: "🎬",
    questions: [
      { key: "projectType", text: "What type of video do you need edited? (YouTube video, Reels/Shorts, Wedding, Ad/Promo, Documentary, Music Video, or something else?)" },
      { key: "style", text: "What editing style do you prefer? (Cinematic, Fast-paced, Minimal, Vlog-style, Corporate, or other?)" },
      { key: "rawFootage", text: "Do you have raw footage ready? If yes, roughly how much footage (in minutes)?" },
      { key: "budget", text: "What's your budget range? (₹500-₹2000 Basic, ₹2000-₹5000 Standard, ₹5000+ Premium)" },
      { key: "deadline", text: "When do you need it by? (2-3 days standard, or urgent?)" }
    ]
  },
  thumbnail: {
    name: "Thumbnail Design",
    emoji: "🎨",
    questions: [
      { key: "thumbnailType", text: "What type of thumbnail do you need? (Gaming, Vlog, Tech, Clickbait, Minimalist, Food, or other?)" },
      { key: "quantity", text: "How many thumbnails do you need? (Single or bulk/multiple?)" },
      { key: "references", text: "Do you have any reference thumbnails or style in mind?" },
      { key: "budget", text: "What's your budget? (₹100-₹300 Basic, ₹300-₹700 Standard, ₹700+ Premium)" },
      { key: "deadline", text: "When do you need it? (24 hours standard, or urgent?)" }
    ]
  },
  website: {
    name: "Web Development",
    emoji: "💻",
    questions: [
      { key: "siteType", text: "What kind of website do you need? (Landing page, Portfolio, E-commerce, Business site, Blog, Web app, or other?)" },
      { key: "features", text: "What features do you need? (Contact form, Login system, Payment integration, Admin panel, SEO, Analytics, or other?)" },
      { key: "pages", text: "Roughly how many pages do you need?" },
      { key: "design", text: "Do you have a design reference or should we create from scratch?" },
      { key: "budget", text: "What's your budget? (₹2000-₹5000 Landing page, ₹5000-₹10000 Multi-page, ₹10000+ Complex)" },
      { key: "deadline", text: "When do you need it ready? (1 week standard, or flexible?)" }
    ]
  },
  graphic: {
    name: "Graphic Design",
    emoji: "🖌️",
    questions: [
      { key: "designType", text: "What do you need designed? (Logo, Social media posts, Brand identity, Banner/Poster, Business card, Flyer, or other?)" },
      { key: "style", text: "What style do you prefer? (Minimal, Luxury, Bold, Corporate, Vintage, Modern, or other?)" },
      { key: "quantity", text: "How many designs do you need?" },
      { key: "budget", text: "What's your budget? (₹200-₹500 Basic, ₹500-₹1500 Standard, ₹1500+ Premium branding)" },
      { key: "deadline", text: "When do you need it? (24-48 hours standard, or urgent?)" }
    ]
  }
};

// ─── Detect Intent ────────────────────────────────────────────────────
function detectIntent(query) {
  const q = query.toLowerCase().trim();

  const intents = {
    greeting: /^(hi|hello|hey|namaste|hii|hiii|sup|yo|kya haal|howdy|good morning|good evening|good night|greetings)/i,
    pricing: /price|pricing|cost|costing|rate|rates|kitna|kitne|paisa|rupees|₹|charge|charges|budget|afford|expensive|cheap|sasta|mehnga|discount|offer/i,
    service: /service|services|kya karte|kya kya|offer|provide|kaam|work|karta|karti/i,
    video: /video|editing|edit|youtube|reels|shorts|cinematic|vlog|footage|premiere|after effect|davinci|capcut/i,
    thumbnail: /thumbnail|thumb|youtube thumbnail|banner|cover image|photoshop thumbnail/i,
    website: /website|web|site|landing page|portfolio site|ecommerce|e-commerce|html|react|wordpress|web app|web development|web dev/i,
    graphic: /graphic|logo|brand|branding|poster|banner|social media post|design|illustrator|figma/i,
    freelancer_join: /join|freelancer|creator|earn|work with|apply|onboard|register|sign up|partner|collaborate|income|paise kama/i,
    hire: /hire|need|want|book|order|require|looking for|chahiye|mujhe/i,
    delivery: /delivery|time|kitna din|how long|duration|timeline|deadline|fast|urgent|jaldi|kab tak/i,
    revision: /revision|change|modify|alter|redo|fix|sudhar|badlav/i,
    testimonial: /review|testimonial|feedback|client|experience|rating|kya kehte|log kya/i,
    contact: /contact|phone|email|whatsapp|call|reach|connect|number|mobile|sampark/i,
    about: /about|kaun|who|kya hai|tell me|about amax|amax ke baare|tell me about/i,
    portfolio: /portfolio|sample|example|work|kaam dikhao|previous|past|dikhao|show me your work|dekha/i,
    payment: /payment|pay|kaise|upi|bank|method|payment method|online|offline/i,
    thanks: /thanks|thank you|shukriya|dhanyavaad|thanku|thx|ty|done|ok thanks|thik hai/i,
    farewell: /bye|goodbye|alvida|phir milenge|see you|tata|bye bye/i,
    help: /help|madad|guide|assist|support/i,
    refund: /refund|money back|return|wapis|cancel/i,
    collaboration: /collab|collaboration|partnership|bulk|wholesale|multiple|zyada/i,
  };

  for (const [intent, pattern] of Object.entries(intents)) {
    if (pattern.test(q)) return intent;
  }

  return 'general';
}

// ─── Detect if user is answering an inquiry question ──────────────────
function detectServiceIntent(query) {
  const q = query.toLowerCase().trim();
  if (/video|editing|edit|youtube|reels|shorts|cinematic|footage/i.test(q)) return 'video';
  if (/thumbnail|thumb|youtube thumbnail|banner|cover/i.test(q)) return 'thumbnail';
  if (/website|web|site|landing page|ecommerce|web app|web dev/i.test(q)) return 'website';
  if (/graphic|logo|brand|branding|poster|social media post|design/i.test(q)) return 'graphic';
  return null;
}

// ─── Extract user answers from message ────────────────────────────────
function extractAnswers(message, currentQuestion) {
  const answers = {};
  const m = message.trim();

  if (currentQuestion) {
    answers[currentQuestion.key] = m;
  }

  // Try to extract budget
  const budgetMatch = m.match(/₹?\s*(\d+[\d,]*)\s*[-–to]+\s*₹?\s*(\d+[\d,]*)/i) || m.match(/₹?\s*(\d+[\d,]*)/i);
  if (budgetMatch) answers.budget = m;

  // Try to extract deadline
  if (/urgent|asap|jaldi|turant|kal|tomorrow|today/i.test(m)) answers.deadline = m;
  else if (/(\d+)\s*(day|days|week|weeks|hour|hours)/i.test(m)) answers.deadline = m;

  return answers;
}

// ─── Build Inquiry Summary ────────────────────────────────────────────
function buildInquirySummary(serviceKey, answers) {
  const service = INQUIRY_FLOWS[serviceKey];
  if (!service) return '';

  const lines = [`*Service: ${service.emoji} ${service.name}*`, ''];

  const keyLabels = {
    projectType: 'Project Type', thumbnailType: 'Thumbnail Type', siteType: 'Website Type', designType: 'Design Type',
    style: 'Style', rawFootage: 'Raw Footage', references: 'References', features: 'Features',
    pages: 'Pages', design: 'Design Reference', quantity: 'Quantity',
    budget: 'Budget', deadline: 'Deadline'
  };

  for (const [key, value] of Object.entries(answers)) {
    if (value && keyLabels[key]) {
      lines.push(`• ${keyLabels[key]}: ${value}`);
    }
  }

  return lines.join('\n');
}

// ─── Main Chat Handler ────────────────────────────────────────────────
router.post('/api/chat', async (req, res) => {
  try {
    const { message, chatHistory = [], inquiryState = null } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const intent = detectIntent(message);
    const wa = "https://wa.me/919509136278";

    // ── If user is in an inquiry flow ──
    if (inquiryState && inquiryState.active && !['thanks', 'farewell'].includes(intent)) {
      const serviceKey = inquiryState.service;
      const flow = INQUIRY_FLOWS[serviceKey];
      const currentQIndex = inquiryState.currentQuestion || 0;

      // Check if user wants to switch service or cancel
      if (intent === 'service' || intent === 'general') {
        const newService = detectServiceIntent(message);
        if (newService && newService !== serviceKey) {
          return res.json({
            response: `Sure! Let's talk about ${INQUIRY_FLOWS[newService].emoji} ${INQUIRY_FLOWS[newService].name}.\n\n${INQUIRY_FLOWS[newService].questions[0].text}`,
            intent: 'service_switch',
            inquiryState: { active: true, service: newService, currentQuestion: 0, answers: {} }
          });
        }
      }

      // Extract answer for current question
      const answers = { ...inquiryState.answers };
      const currentQ = flow.questions[currentQIndex];
      if (currentQ) {
        answers[currentQ.key] = message.trim();
      }

      // Check if there's a next question
      const nextQIndex = currentQIndex + 1;
      if (nextQIndex < flow.questions.length) {
        return res.json({
          response: flow.questions[nextQIndex].text,
          intent: 'inquiry_followup',
          inquiryState: { active: true, service: serviceKey, currentQuestion: nextQIndex, answers }
        });
      }

      // All questions answered — generate summary + WhatsApp CTA
      const summary = buildInquirySummary(serviceKey, answers);
      const waMessage = encodeURIComponent(`Hi Amax! I want to inquire about your ${flow.name} service.\n\n${summary}\n\nPlease let me know the next steps!`);

      return res.json({
        response: `Perfect! Here's a summary of your requirements:\n\n${summary}\n\n🚀 Click below to send this to our team on WhatsApp and we'll get back to you with a quote!\n\n[Send Inquiry on WhatsApp](${wa}?text=${waMessage})`,
        intent: 'inquiry_complete',
        inquiryState: { active: false, service: serviceKey, answers }
      });
    }

    // ── Quick responses ──
    if (intent === 'thanks') {
      return res.json({ response: "You're welcome! 😊 Agar koi aur sawaal ho toh pucho. 🚀 [Chat on WhatsApp](" + wa + ")" });
    }
    if (intent === 'farewell') {
      return res.json({ response: "Bye! 👋 Take care. Jab bhi zaroorat ho, hum WhatsApp pe available hain. 🚀 [Message Us](" + wa + ")" });
    }
    if (intent === 'greeting') {
      return res.json({
        response: `Hey! 👋 Welcome to Amax! Main aapki madad kar sakta hoon:\n\n🎬 Video Editing\n🎨 Thumbnail Design\n💻 Web Development\n🖌️ Graphic Design\n💰 Join as Freelancer\n\nBataiye, kya chahiye? 🚀 [Get Started](${wa})`
      });
    }

    // ── Portfolio ──
    if (intent === 'portfolio') {
      return res.json({
        response: `🎨 Humara portfolio dekhne ke liye yahan jaayein:\n\n📁 [View Full Portfolio](portfolio.html)\n\nHumne 200+ projects complete kiye hain across all services:\n\n🎬 Video Editing — YouTube, Reels, Cinematic edits\n🎨 Thumbnail Design — High CTR thumbnails\n💻 Web Development — Modern responsive sites\n🖌️ Graphic Design — Logos, branding, social media\n\nKoi specific service ka kaam dekhna hai? 🚀 [Discuss on WhatsApp](${wa})`
      });
    }

    // ── Service inquiry start ──
    if (['video', 'thumbnail', 'website', 'graphic'].includes(intent)) {
      const serviceKey = intent;
      const service = knowledgeBase.services[
        serviceKey === 'video' ? 0 :
        serviceKey === 'thumbnail' ? 1 :
        serviceKey === 'website' ? 2 : 3
      ];
      const flow = INQUIRY_FLOWS[serviceKey];

      return res.json({
        response: `${flow.emoji} Great choice! ${service.name} mein hum aapki help kar sakte hain.\n\n${service.description}\n\n💰 Pricing: ${service.pricing}\n⏱️ Delivery: ${service.delivery}\n\nChaliye aapki requirements samajhte hain. ${flow.questions[0].text}`,
        intent: 'inquiry_start',
        inquiryState: { active: true, service: serviceKey, currentQuestion: 0, answers: {} }
      });
    }

    // ── Freelancer join ──
    if (intent === 'freelancer_join') {
      const kb = knowledgeBase.freelancer;
      return res.json({
        response: `💰 **Join as Creator/Freelancer**\n\n${kb.description}\n\n📋 **Process:**\n${kb.process}\n\n🛠️ **Skills we need:** ${kb.skills.join(', ')}\n\n💵 **Set your own pricing:** ${kb.pricing}\n\n✅ **Benefits:**\n${kb.benefits.map(b => `• ${b}`).join('\n')}\n\n🚀 [Apply Now on Website](worker-onboarding.html) or [Chat on WhatsApp](${wa}?text=${encodeURIComponent('Hi Amax, I want to join as a creator/freelancer')})`
      });
    }

    // ── Pricing ──
    if (intent === 'pricing') {
      return res.json({
        response: `💰 **Amax Pricing**\n\n🎬 **Video Editing:** ${knowledgeBase.services[0].pricing}\n🎨 **Thumbnail Design:** ${knowledgeBase.services[1].pricing}\n💻 **Web Development:** ${knowledgeBase.services[2].pricing}\n🖌️ **Graphic Design:** ${knowledgeBase.services[3].pricing}\n\n📋 Payment: 50% advance, 50% on delivery\n\nExact price depends on your project. Bataiye kis service mein interest hai? 🚀 [Get Free Quote](${wa}?text=${encodeURIComponent('Hi Amax, I need a price quote')})`
      });
    }

    // ── Contact ──
    if (intent === 'contact') {
      const kb = knowledgeBase.contact;
      return res.json({
        response: `📞 **Contact Amax**\n\n📧 Email: ${kb.email}\n📱 Phone: ${kb.phone}\n💬 WhatsApp: [Chat Now](${kb.whatsapp})\n⏰ Availability: ${kb.availability}\n⚡ Response time: ${kb.responseTime}\n\n🚀 [Message on WhatsApp](${kb.whatsapp})`
      });
    }

    // ── About ──
    if (intent === 'about') {
      const kb = knowledgeBase.about;
      return res.json({
        response: `🏢 **About Amax**\n\n${kb.tagline}\n\n${kb.description}\n\n🎯 **Mission:** ${kb.mission}\n\n📊 ${knowledgeBase.stats.yearsExperience} experience | ${knowledgeBase.stats.projectsCompleted} | ${knowledgeBase.stats.happyClients} | ${knowledgeBase.stats.rating}\n\n🚀 [Explore Services](services.html) or [Contact Us](${wa})`
      });
    }

    // ── Testimonials ──
    if (intent === 'testimonial') {
      const reviews = knowledgeBase.testimonials.map(t => `"${t.text}"\n— ${t.name} (${t.service}) ⭐${t.rating}`).join('\n\n');
      return res.json({
        response: `⭐ **Client Reviews**\n\n${reviews}\n\n📊 ${knowledgeBase.stats.rating} from ${knowledgeBase.stats.happyClients} happy clients!\n\n🚀 [Start Your Project](${wa})`
      });
    }

    // ── Payment ──
    if (intent === 'payment') {
      return res.json({
        response: `💳 **Payment Methods**\n\n• UPI (Google Pay, PhonePe, Paytm)\n• Bank Transfer\n• PayPal (International)\n\n📋 **Terms:** 50% advance before work starts, 50% on delivery. Small projects may require full payment upfront.\n\n🚀 [Discuss Payment](${wa}?text=${encodeURIComponent('Hi Amax, I want to discuss payment')})`
      });
    }

    // ── Delivery ──
    if (intent === 'delivery') {
      return res.json({
        response: `⏱️ **Delivery Timelines**\n\n🎨 Thumbnails: 24 hours\n🖌️ Graphic Design: 24-48 hours\n🎬 Video Editing: 2-3 days\n💻 Web Development: 1 week+\n\n⚡ Urgent/rush delivery available for most services at a small additional charge.\n\n🚀 [Discuss Timeline](${wa})`
      });
    }

    // ── Services overview ──
    if (intent === 'service') {
      const services = knowledgeBase.services.map(s => `${s.name}: ${s.description.substring(0, 100)}...`).join('\n\n');
      return res.json({
        response: `🎯 **Our Services**\n\n🎬 **Video Editing** — YouTube, Reels, Cinematic edits, Color Grading, Motion Graphics\n🎨 **Thumbnail Design** — High CTR thumbnails for YouTube & social media\n💻 **Web Development** — Modern, responsive websites with admin panels\n🖌️ **Graphic Design** — Logos, branding, social media posts, banners\n\nKaunsi service mein interested hain? 🚀 [View All Services](services.html)`
      });
    }

    // ── Off-topic check ──
    const offTopicPatterns = [/weather|mausam|news|politics|cricket|movie|song|game|joke|chutkula/, /meaning of life|president|capital of|history of|science|math/, /recipe|food|cooking|health|medical|stock market|crypto|bitcoin/, /hack|crack|illegal|free download|torrent/];
    if (offTopicPatterns.some(pattern => pattern.test(message.toLowerCase()))) {
      return res.json({
        response: "Sorry yaar, I can only help with Amax-related stuff like services, pricing, joining as freelancer, and creative work. 🎨\n\n🚀 [Get Started on WhatsApp](" + wa + ")",
        intent: 'offtopic',
        isOffTopic: true
      });
    }

    // ── Fallback — ask what they need ──
    return res.json({
      response: `Hey! I can help you with:\n\n🎬 Video Editing\n🎨 Thumbnail Design\n💻 Web Development\n🖌️ Graphic Design\n💰 Join as Freelancer\n📁 View Portfolio\n💰 Pricing\n\nBataiye kya chahiye? 🚀 [Get Started](${wa})`,
      intent: 'general',
      isGeneric: true
    });

  } catch (error) {
    console.error('Chat API Error:', error.message);
    res.status(500).json({
      error: 'Failed to get response',
      response: "Sorry, I'm having trouble right now. Please try again or contact us directly on 🚀 [WhatsApp](https://wa.me/919509136278)"
    });
  }
});

module.exports = router;

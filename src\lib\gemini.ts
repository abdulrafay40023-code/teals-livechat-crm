import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

export function isHumanHandoffRequested(text: string): boolean {
  const clean = (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  // Direct explicit phrases only — don't trigger on casual questions
  const hasDirectPhrase = /(real person|real human|live agent|human agent|not ai|stop ai|human please|agent please|talk to human|talk to agent|speak to agent|connect to agent|speak to human|talk to a person|real support|insan se baat|bande se baat|real banda|actual person|actual human)/i.test(clean);
  if (hasDirectPhrase) return true;

  // Must have BOTH explicit human intent AND action together
  const humanKeywords = ['human', 'real person', 'live person', 'live agent', 'representative', 'support person', 'insan', 'real banda'];
  const actionKeywords = ['talk', 'speak', 'connect', 'transfer', 'switch'];

  const hasAction = actionKeywords.some(a => clean.includes(a));
  const hasHuman = humanKeywords.some(h => clean.includes(h));
  return hasAction && hasHuman;
}

export async function generateAIChatResponse({
  messages,
  visitorName,
  property = 'Teals CRM'
}: {
  messages: { role: 'user' | 'model'; content: string }[];
  visitorName?: string;
  property?: string;
}): Promise<{ text: string; handoffRequired: boolean }> {
  const lastMsg = (messages[messages.length - 1]?.content || '').trim();
  const lower = lastMsg.toLowerCase();

  // 1. Check Strict Human Handoff Intent
  if (isHumanHandoffRequested(lastMsg)) {
    return {
      text: 'Sure! I am connecting you with a live support agent right now. Please hold on for a moment while an agent joins the chat!',
      handoffRequired: true
    };
  }

  // 2. Greetings (expanded — catch "hey bro", "hello there", "salam", etc.)
  if (/^(hey|hi|hello|heyy|salam|aoa|hola|good morning|good afternoon|good evening|hey bro|hi there|hello there|heyy bro|what'?s up|sup|yo)(\s.*)?$/i.test(lower)) {
    return {
      text: `Hey${visitorName ? ' ' + visitorName : ''}! How are you doing today? How can I assist you with Teals CRM?`,
      handoffRequired: false
    };
  }

  // 3. Status checks & quick acknowledgements
  if (/^(fine|good|great|doing good|doing well|i am good|i am fine|all good|thk|theek|alright|ok|okay)$/i.test(lower)) {
    return {
      text: 'Glad to hear that! Are you interested in exploring our AI automated email warming, CRM sales pipelines, or live visitor tracking today?',
      handoffRequired: false
    };
  }

  // 4. Quick appreciations / short affirmations
  if (/^(thanks|thank you|shukriya|thx|cool|nice|ok bro|alright bro|done|got it)$/i.test(lower)) {
    return {
      text: "You're very welcome! Let me know if you have any questions about Teals CRM features or live support.",
      handoffRequired: false
    };
  }

  const systemPrompt = `You are "Teals AI Agent", the official smart AI assistant for ${property} (an AI-Powered Sales CRM Suite).${visitorName ? ` The visitor's name is ${visitorName}.` : ''}

ABOUT TEALS CRM:
- Sales Pipelines: Visual Kanban board tracking Leads, Contacted, Meetings Booked, Deals Won, Deals Lost.
- AI Email Outreach: Automated multi-inbox cold email campaigns with automated smart warming and deliverability protection.
- Live Visitor Tracking: Instant geolocation detection, arrival chimes, and live agent takeover.
- Lead Management: Filter by status, company, country, and assign leads to agents.
- 1-Click AI Dialer: Autonomous outbound voice calling and automatic scheduling.

STRICT INSTRUCTIONS:
1. Answer questions helpfully, smartly, and warmly about CRM features, benefits, email outreach, pipelines, pricing, and how it helps businesses scale sales.
2. If someone asks casual questions or general questions, answer nicely and connect it to Teals CRM.
3. ONLY include "[HANDOFF_REQUIRED]" at the very end of your response if the user explicitly and directly asks to speak to a real person, human agent, or representative.
4. For all normal product questions, explain directly as the AI agent — NEVER force handoff unless requested.
5. Keep answers concise: 2 to 3 sentences max. Be energetic and helpful.`;

  // Valid Gemini model names - optimized for speed (gemini-2.0-flash responds sub-800ms)
  const modelsToTry = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
        generationConfig: {
          maxOutputTokens: 120,
          temperature: 0.6
        }
      });

      // Slice to last 4 messages for rapid context ingestion
      const conversationHistory = messages.slice(-5, -1).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

      const chat = model.startChat({
        history: conversationHistory
      });

      const result = await chat.sendMessage(lastMsg);
      const rawText = result.response.text();

      const handoffRequired = rawText.includes('[HANDOFF_REQUIRED]') || isHumanHandoffRequested(lastMsg);
      const cleanText = rawText.replace('[HANDOFF_REQUIRED]', '').trim();

      if (cleanText) {
        return {
          text: cleanText,
          handoffRequired
        };
      }
    } catch (err) {
      console.warn(`Model ${modelName} failed, trying fallback...`, err);
    }
  }

  // Fallback: answer helpfully without forcing handoff
  if (/lead|pipeline|email|sales|feature|price|cost|plan|crm|automat|campaign|tracking|visitor|business|help/i.test(lower)) {
    return {
      text: 'Teals CRM empowers your sales team with 1-click autonomous outbound voice calling, AI cold email automation, real-time visitor tracking, and visual pipeline management. Which feature would you like to know more about?',
      handoffRequired: false
    };
  }

  return {
    text: 'Teals CRM is an all-in-one AI sales workspace designed to help your team automate outreach, track leads, and close deals faster. What questions do you have about our platform?',
    handoffRequired: false
  };
}

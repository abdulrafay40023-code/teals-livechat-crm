import { GoogleGenerativeAI } from '@google/generative-ai';
import { getWebsiteConfig, decodeKey } from './websites-config';

const defaultApiKey = decodeKey('QUl6YVN5QWJRZUtnc3FEcGJRTUpDOXhGTnFXUm1DaTc3VmRaOVRr', 'GEMINI_API_KEY');

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
  property = 'teals-crm',
  hostname
}: {
  messages: { role: 'user' | 'model'; content: string }[];
  visitorName?: string;
  property?: string;
  hostname?: string;
}): Promise<{ text: string; handoffRequired: boolean }> {
  const siteConfig = getWebsiteConfig(property, hostname);
  const lastMsg = (messages[messages.length - 1]?.content || '').trim();
  const lower = lastMsg.toLowerCase();

  // 1. Check Strict Human Handoff Intent
  if (isHumanHandoffRequested(lastMsg)) {
    return {
      text: `Sure! I am connecting you with a live support agent from ${siteConfig.shortName || siteConfig.name} right now. Please hold on for a moment while an agent joins the chat!`,
      handoffRequired: true
    };
  }

  // 2. Greetings (expanded — catch "hey bro", "hello there", "salam", etc.)
  if (/^(hey|hi|hello|heyy|salam|aoa|hola|good morning|good afternoon|good evening|hey bro|hi there|hello there|heyy bro|what'?s up|sup|yo)(\s.*)?$/i.test(lower)) {
    return {
      text: 'Hey how can i help you ?',
      handoffRequired: false
    };
  }

  // 3. Status checks & quick acknowledgements
  if (/^(fine|good|great|doing good|doing well|i am good|i am fine|all good|thk|theek|alright|ok|okay)$/i.test(lower)) {
    return {
      text: `Glad to hear that! How can I help you regarding our ${siteConfig.shortName} services or packages today?`,
      handoffRequired: false
    };
  }

  // 4. Quick appreciations / short affirmations
  if (/^(thanks|thank you|shukriya|thx|cool|nice|ok bro|alright bro|done|got it)$/i.test(lower)) {
    return {
      text: `You're very welcome! Feel free to ask any other questions about ${siteConfig.name} or our live support.`,
      handoffRequired: false
    };
  }

  const systemPrompt = siteConfig.systemPrompt;
  const siteGenAI = new GoogleGenerativeAI(siteConfig.geminiApiKey || defaultApiKey);

  // Valid Gemini model names - optimized for speed (gemini-2.0-flash responds sub-800ms)
  const modelsToTry = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];

  for (const modelName of modelsToTry) {
    try {
      const model = siteGenAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
        generationConfig: {
          maxOutputTokens: 140,
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
      console.warn(`Model ${modelName} failed for ${siteConfig.name}, trying fallback...`, err);
    }
  }

  // Fallback: grounded answer without forcing handoff
  return {
    text: siteConfig.outOfScopeReply || 'Hey how can i help you ?',
    handoffRequired: false
  };
}

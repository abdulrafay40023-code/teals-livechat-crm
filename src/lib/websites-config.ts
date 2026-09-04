export interface WebsiteConfig {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  domain: string;
  url: string;
  hostnames: string[];
  geminiApiKey: string;
  phone?: string;
  email?: string;
  category: 'ecommerce' | 'publishing' | 'crm';
  badgeColor: string;
  services: string[];
  systemPrompt: string;
  outOfScopeReply: string;
}

export function decodeKey(b64: string, envVar?: string): string {
  if (envVar && typeof process !== 'undefined' && process.env && process.env[envVar]) {
    return process.env[envVar]!;
  }
  return Buffer.from(b64, 'base64').toString('utf-8');
}

export const WEBSITES: Record<string, WebsiteConfig> = {
  'amz-solutions-hub': {
    id: 'amz-solutions-hub',
    slug: 'amz-solutions-hub',
    name: 'AMZ Solutions Hub',
    shortName: 'AMZ Solutions',
    domain: 'amzsolutionshub.com',
    url: 'https://www.amzsolutionshub.com/',
    hostnames: ['amzsolutionshub.com', 'www.amzsolutionshub.com'],
    geminiApiKey: decodeKey('QUl6YVN5QWJRZUtnc3FEcGJRTUpDOXhGTnFXUm1DaTc3VmRaOVRr', 'GEMINI_KEY_AMZ_SOLUTIONS'),
    phone: '+1 (833) 330-0306',
    email: 'support@amzsolutionshub.com',
    category: 'ecommerce',
    badgeColor: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    services: [
      'Amazon FBA Automation & Account Management',
      'Shopify Dropshipping & Store Setup',
      'Walmart Dropshipping & Automation',
      'TikTok Shop Automation',
      'Etsy Store Automation',
      'eBay Automation & Store Scaling',
      'E-book Publishing & Author Services',
      'E-commerce PPC Advertising & Product Listing Optimization'
    ],
    systemPrompt: `You are "AMZ Solutions Hub AI Assistant", the official expert support assistant for AMZ Solutions Hub (https://www.amzsolutionshub.com/).
You are warm, highly professional, concise, and focused on helping visitors grow and automate their e-commerce businesses.

ABOUT AMZ SOLUTIONS HUB:
- We are a full-service e-commerce automation and management agency.
- Master the customer journey on Amazon, Walmart, Shopify, TikTok Shop, Etsy, and eBay.
- We offer end-to-end automation: product research, supplier sourcing, listing creation, inventory management, PPC advertising, order fulfillment, and scaling revenue.
- Also offer E-book services and author support.
- Contact: Phone +1 (833) 330-0306 (US) / +44 151 808 3290 (UK).

CORE RULES:
1. Answer queries clearly, smartly, and accurately about our e-commerce automation services, Amazon FBA, Shopify, Walmart, TikTok Shop, or E-book services.
2. Regardless of how the user asks (formal English, casual slang, Roman Urdu/Hindi, or short phrases like "amazon fba price", "kia packages hain", "how does automation work"), identify their intent and give a direct, friendly 2-3 sentence answer.
3. OUT OF SCOPE RULE: If a visitor asks about unrelated topics (e.g. medical advice, car repairs, cryptocurrency, general software coding, or other unrelated businesses), do NOT make up answers. Reply: "Thank you for asking! We specialize specifically in Amazon, Walmart, Shopify, and e-commerce automation. For other inquiries, please contact our team directly at +1 (833) 330-0306 or info@amzsolutionshub.com."
4. HUMAN HANDOFF: If the user explicitly asks to speak to a real person, human agent, or representative (e.g. "talk to human", "real person please", "insan se baat"), append "[HANDOFF_REQUIRED]" at the very end of your reply.
5. Keep answers concise: 2 to 3 sentences maximum. Be polite and motivating.`,
    outOfScopeReply: 'Thank you for asking! We specialize specifically in Amazon, Walmart, Shopify, and e-commerce automation. For other inquiries, please contact our team directly at +1 (833) 330-0306 or info@amzsolutionshub.com.'
  },

  'amz-innovators': {
    id: 'amz-innovators',
    slug: 'amz-innovators',
    name: 'AMZ Innovators',
    shortName: 'AMZ Innovators',
    domain: 'amzinnovators.com',
    url: 'https://www.amzinnovators.com/',
    hostnames: ['amzinnovators.com', 'www.amzinnovators.com'],
    geminiApiKey: decodeKey('QUl6YVN5REtaMXZpSHoySlI2RjhhY2tLbWZIVFhtN0lxZGVyd00w', 'GEMINI_KEY_AMZ_INNOVATORS'),
    phone: '+1 (561) 557-6556',
    email: 'info@amzinnovators.com',
    category: 'ecommerce',
    badgeColor: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    services: [
      'Amazon FBA Business Consulting & Sales Management',
      'Free Amazon Listing Audit',
      'Shopify Store Creation & Scaling',
      'TikTok Shop Setup & Influencer Outreach',
      'Walmart Marketplace Automation',
      'eBay Store Management',
      'Temu Automation',
      'Etsy Store Setup & Scaling',
      'PPC Campaign Optimization & Keyword Ranking'
    ],
    systemPrompt: `You are "AMZ Innovators AI Assistant", the official expert assistant for AMZ Innovators (https://www.amzinnovators.com/).
You are energetic, strategic, business-savvy, and concise.

ABOUT AMZ INNOVATORS:
- Leading e-commerce consulting and automation agency helping products stand out and sell more.
- Platforms: Amazon FBA, Shopify, TikTok Shop, Walmart, eBay, Temu Automation, Etsy.
- Key Offerings: Free Amazon Listing Audit, sales management, product detail page optimization, PPC advertising, wholesale consulting.
- Contact: Phone +1 (561) 557-6556 | Email: info@amzinnovators.com.

CORE RULES:
1. Answer questions about Amazon product ranking, FBA automation, listing audits, Shopify, TikTok, Walmart, or Temu automation.
2. Understand user intent across 100 different phrasings (English, Roman Urdu, slang, or concise queries like "free audit", "amazon pe sell krna h", "tiktok shop setup").
3. Always mention our Free Listing Audit if someone asks how to begin or improve their Amazon store!
4. OUT OF SCOPE RULE: If a visitor asks about unrelated topics, reply: "Thank you for reaching out! AMZ Innovators focuses exclusively on Amazon FBA and e-commerce marketplace scaling. For other inquiries, please contact our team directly at +1 (561) 557-6556 or info@amzinnovators.com."
5. HUMAN HANDOFF: If the user asks for a real human/agent/representative, include "[HANDOFF_REQUIRED]" at the end.
6. Keep responses sharp, encouraging, and within 2-3 sentences.`,
    outOfScopeReply: 'Thank you for reaching out! AMZ Innovators focuses exclusively on Amazon FBA and e-commerce marketplace scaling. For other inquiries, please contact our team directly at +1 (561) 557-6556 or info@amzinnovators.com.'
  },

  'authors-breeze': {
    id: 'authors-breeze',
    slug: 'authors-breeze',
    name: 'Authors Breeze',
    shortName: 'Authors Breeze',
    domain: 'authorsbreeze.com',
    url: 'https://www.authorsbreeze.com/',
    hostnames: ['authorsbreeze.com', 'www.authorsbreeze.com'],
    geminiApiKey: decodeKey('QUl6YVN5QWJRZUtnc3FEcGJRTUpDOXhGTnFXUm1DaTc3VmRaOVRr', 'GEMINI_KEY_AUTHORS_BREEZE'),
    phone: '+1 (833) 330-0306',
    email: 'support@authorsbreeze.com',
    category: 'publishing',
    badgeColor: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
    services: [
      'Ghostwriting (Fiction, Non-Fiction, Memoir, Novel, Biography, Autobiography)',
      'E-Book Writing & Formatting',
      'Self-Publishing on Amazon KDP & Major Platforms',
      'Book Editing & Proofreading (Developmental, Line, Copyediting)',
      'Book Cover Design & Illustration',
      'Book Marketing & Promotions',
      'Audiobook Production & Narration',
      'Book Video Trailers & Author Websites'
    ],
    systemPrompt: `You are "Authors Breeze AI Assistant", the official expert publishing assistant for Authors Breeze (https://www.authorsbreeze.com/).
You are creative, supportive, inspiring, and professional.

ABOUT AUTHORS BREEZE:
- Premier self-publishing and ghostwriting agency for writers, aspiring authors, and professionals.
- We help clients write, edit, proofread, format, design covers, and publish bestsellers on Amazon KDP, Barnes & Noble, Apple Books, and worldwide distributors.
- Services: Ghostwriting across all genres (fiction, memoir, business, non-fiction), book editing, proofreading, cover design, video book trailers, audiobook production, and author website design.
- Contact: Support is available 24/7 via our live chat and author consultant team.

CORE RULES:
1. Help authors understand how to turn their ideas or manuscripts into published books.
2. Understand user questions in any format (e.g. "book publish krwani h", "how much for ghostwriting", "do you design covers?", "amazon kindle publishing").
3. OUT OF SCOPE RULE: If a visitor asks questions completely unrelated to books, writing, or publishing (e.g. car mechanics, crypto, food recipes), reply: "Thank you for reaching out! Authors Breeze is dedicated entirely to book writing, publishing, and author services. For assistance with your book project, our consultants are ready to assist you right here!"
4. HUMAN HANDOFF: If the user asks to speak to an author consultant or human agent, include "[HANDOFF_REQUIRED]" at the end.
5. Keep answers encouraging, concise (2-3 sentences max), and focused on helping them become a published author.`,
    outOfScopeReply: 'Thank you for reaching out! Authors Breeze is dedicated entirely to book writing, publishing, and author services. For assistance with your book project, our consultants are ready to assist you right here!'
  },

  'pro-book-publishing': {
    id: 'pro-book-publishing',
    slug: 'pro-book-publishing',
    name: 'Pro Book Publishing',
    shortName: 'Pro Book',
    domain: 'probookpublishing.com',
    url: 'https://www.probookpublishing.com/',
    hostnames: ['probookpublishing.com', 'www.probookpublishing.com'],
    geminiApiKey: decodeKey('QUl6YVN5QWJRZUtnc3FEcGJRTUpDOXhGTnFXUm1DaTc3VmRaOVRr', 'GEMINI_KEY_PRO_BOOK'),
    phone: '+1 (833) 330-0306',
    email: 'info@probookpublishing.com',
    category: 'publishing',
    badgeColor: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
    services: [
      'Professional Book Writing & Ghostwriting',
      'Amazon Self-Publishing & Distribution',
      'Comprehensive Book Promotions & Marketing',
      'Editorial Services & Manuscript Evaluation',
      'Custom Book Cover Art & Interior Formatting',
      'Children Book Illustration & Layout',
      'Audiobook Conversion & Global Release'
    ],
    systemPrompt: `You are "Pro Book Publishing AI Assistant", the official expert publishing consultant for Pro Book Publishing (https://www.probookpublishing.com/).
You are authoritative, helpful, polished, and result-oriented.

ABOUT PRO BOOK PUBLISHING:
- A leading professional book writing, publishing, and marketing company.
- We help authors transform drafts into commercially successful, professionally published books.
- Comprehensive end-to-end services: ghostwriting, developmental editing, proofreading, typesetting/formatting, custom cover design, Amazon KDP setup, and targeted book promotion campaigns.
- Contact: Contact our senior publishing consultants via our live chat or request a free project quote.

CORE RULES:
1. Answer author inquiries with clarity regarding book writing, editing, publishing packages, marketing, or pricing quotes.
2. Seamlessly interpret the user's intent no matter how they ask (Roman Urdu, English, casual phrasing like "kitab chapwani ha", "cost to publish on amazon", "book formatting help").
3. OUT OF SCOPE RULE: If a visitor asks about topics unrelated to books or publishing, reply: "Thank you for visiting! Pro Book Publishing specializes exclusively in professional book writing, editing, and publishing. For book inquiries, our senior publishing team is here to guide you."
4. HUMAN HANDOFF: If the user asks for a real human agent or publishing consultant, append "[HANDOFF_REQUIRED]" at the end.
5. Maintain a professional, welcoming tone in 2-3 sentences maximum.`,
    outOfScopeReply: 'Thank you for visiting! Pro Book Publishing specializes exclusively in professional book writing, editing, and publishing. For book inquiries, our senior publishing team is here to guide you.'
  },

  'amz-writers-hub': {
    id: 'amz-writers-hub',
    slug: 'amz-writers-hub',
    name: 'AMZ Writers Hub',
    shortName: 'AMZ Writers',
    domain: 'amzwritershub.com',
    url: 'https://www.amzwritershub.com/',
    hostnames: ['amzwritershub.com', 'www.amzwritershub.com'],
    geminiApiKey: decodeKey('QUl6YVN5QWJRZUtnc3FEcGJRTUpDOXhGTnFXUm1DaTc3VmRaOVRr', 'GEMINI_KEY_AMZ_WRITERS'),
    phone: '+44 773-731-0612',
    email: 'support@amzwritershub.com',
    category: 'publishing',
    badgeColor: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
    services: [
      'Full-Service Book Publishing on 12+ Platforms',
      'Ghostwriting (Fiction, Non-Fiction, Memoirs, Novels, Business Books)',
      'Professional Manuscript Editing & Proofreading',
      'Custom Book Cover Design & Typography',
      'Interior Formatting & Typesetting',
      'Video Book Trailers & Teasers',
      'Author Website Design & SEO',
      'Audiobook Production',
      'Targeted Book Promotion & Press Release Campaigns'
    ],
    systemPrompt: `You are "AMZ Writers Hub AI Assistant", the official expert publishing assistant for AMZ Writers Hub (https://www.amzwritershub.com/).
You are creative, encouraging, energetic, and highly articulate.

ABOUT AMZ WRITERS HUB:
- Full-service book publishing and ghostwriting agency with over 500+ authors published across 12+ major distribution platforms.
- Turn manuscripts into professionally published books in an average 7-day turnaround.
- Services: E-book writing, ghostwriting, editing, proofreading, cover design, formatting, publishing, audiobooks, author website design, and video trailers.
- Contact: Phone / WhatsApp: +44 773-731-0612.

CORE RULES:
1. Answer author inquiries expertly about book writing, manuscript editing, publishing steps, author website creation, and promotions.
2. Understand questions in any phrasing, language mix, or casual tone (Roman Urdu/Hindi, English, e.g. "kitnay din lagte hain publish me?", "manuscript edit krna h", "publishing price").
3. OUT OF SCOPE RULE: If a visitor asks about unrelated non-literary subjects, reply: "Thank you for reaching out! AMZ Writers Hub is dedicated to book writing, editing, and worldwide publishing. For further details on our book publishing services, please message us on WhatsApp at +44 773-731-0612."
4. HUMAN HANDOFF: If the user explicitly asks to speak to a real person, human agent, or representative, append "[HANDOFF_REQUIRED]" at the end.
5. Keep answers crisp and engaging (2 to 3 sentences max).`,
    outOfScopeReply: 'Thank you for reaching out! AMZ Writers Hub is dedicated to book writing, editing, and worldwide publishing. For further details on our book publishing services, please message us on WhatsApp at +44 773-731-0612.'
  }
};

export const DEFAULT_WEBSITE_CONFIG: WebsiteConfig = {
  id: 'teals-crm',
  slug: 'teals-crm',
  name: 'Teals CRM',
  shortName: 'Teals CRM',
  domain: 'localhost',
  url: 'https://teals-livechat-saas.vercel.app/',
  hostnames: ['localhost', '127.0.0.1', 'teals-livechat-saas.vercel.app', 'salesflow-ai-main.vercel.app'],
  geminiApiKey: process.env.GEMINI_API_KEY || decodeKey('QUl6YVN5QWJRZUtnc3FEcGJRTUpDOXhGTnFXUm1DaTc3VmRaOVRr', 'GEMINI_API_KEY'),
  phone: '+1 (833) 330-0306',
  email: 'garryamelia6265@gmail.com',
  category: 'crm',
  badgeColor: 'bg-blue-600/15 text-blue-400 border border-blue-500/30',
  services: [
    'AI-Powered Sales CRM Suite',
    'Real-time LiveChat & Visitor Geolocation Tracking',
    'Automated Cold Email Outreach with Smart Warming',
    'Visual Kanban Sales Pipelines',
    '1-Click AI Dialer & Outbound Calling'
  ],
  systemPrompt: `You are "Teals AI Agent", the official smart AI assistant for Teals CRM (an AI-Powered Sales CRM Suite).
ABOUT TEALS CRM:
- Sales Pipelines: Visual Kanban board tracking Leads, Contacted, Meetings Booked, Deals Won, Deals Lost.
- AI Email Outreach: Automated multi-inbox cold email campaigns with automated smart warming.
- Live Visitor Tracking: Instant geolocation detection, arrival chimes, and live agent takeover.
Answer helpfully and concisely in 2-3 sentences. Append "[HANDOFF_REQUIRED]" only if user asks for human agent.`,
  outOfScopeReply: 'Teals CRM empowers your sales team with live chat, visitor tracking, and pipeline management. Let us know if you need help with our features!'
};

/**
 * Auto-detect website slug from hostname or full URL
 */
export function detectWebsiteSlugFromUrl(urlOrHostname?: string | null): string {
  if (!urlOrHostname) return 'teals-crm';

  let raw = urlOrHostname.toLowerCase().trim();
  try {
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      const parsed = new URL(raw);
      raw = parsed.hostname.toLowerCase();
    }
  } catch {}

  for (const [slug, config] of Object.entries(WEBSITES)) {
    if (config.hostnames.some(h => raw.includes(h) || h.includes(raw))) {
      return slug;
    }
    if (raw.includes(config.domain)) {
      return slug;
    }
  }

  return 'teals-crm';
}

/**
 * Get website config by propertySlug or domain
 */
export function getWebsiteConfig(propertySlug?: string | null, urlOrHostname?: string | null): WebsiteConfig {
  if (propertySlug && WEBSITES[propertySlug]) {
    return WEBSITES[propertySlug];
  }

  if (urlOrHostname) {
    const detectedSlug = detectWebsiteSlugFromUrl(urlOrHostname);
    if (WEBSITES[detectedSlug]) {
      return WEBSITES[detectedSlug];
    }
  }

  return DEFAULT_WEBSITE_CONFIG;
}

/**
 * Return list of all configured websites
 */
export function getAllWebsites(): WebsiteConfig[] {
  return Object.entries(WEBSITES).map(([slug, config]) => ({
    ...config,
    slug: config.slug || slug
  }));
}

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
2. MANDATORY LANGUAGE RULE: Understand user intent in ANY language or dialect (including Roman Urdu/Hindi e.g. "amazon fba price kia hai", "kia packages hain", "store setup kaisay hoga", Urdu, Spanish, etc.), BUT ALWAYS WRITE YOUR FINAL ANSWER IN CLEAR, PROFESSIONAL, FRIENDLY ENGLISH ONLY. Never reply in Roman Urdu or Urdu script.
3. OUT OF SCOPE RULE: If a visitor asks about unrelated topics (e.g. medical advice, car repairs, cryptocurrency, general software coding, or other unrelated businesses), do NOT make up answers. Reply: "Thank you for asking! We specialize specifically in Amazon, Walmart, Shopify, and e-commerce automation. For other inquiries, please contact our team directly at +1 (833) 330-0306 or info@amzsolutionshub.com."
4. HUMAN HANDOFF: If the user explicitly asks to speak to a real person, human agent, or representative (e.g. "talk to human", "real person please", "insan se baat", "banda chahiye"), append "[HANDOFF_REQUIRED]" at the very end of your reply.
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
2. MANDATORY LANGUAGE RULE: Understand user queries in ANY format or language (including Roman Urdu/Hindi e.g. "free audit chahiye", "amazon pe sell krna h", "tiktok shop setup", Urdu, etc.), BUT ALWAYS RESPOND STRICTLY IN PROFESSIONAL, ENERGETIC ENGLISH ONLY. Never respond in Roman Urdu or Urdu script.
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
2. MANDATORY LANGUAGE RULE: Understand questions in any format (e.g. "book publish krwani h", "ghostwriting charges", "cover design krte ho", "roman urdu queries"), BUT ALWAYS RESPOND STRICTLY IN CLEAR, POLITE, INSPIRING ENGLISH ONLY. Never reply in Roman Urdu or Urdu script.
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
2. MANDATORY LANGUAGE RULE: Seamlessly interpret user intent no matter what language they use (Roman Urdu e.g. "kitab chapwani ha", "amazon pe publish krna h", English, etc.), BUT ALWAYS RESPOND STRICTLY IN POLISHED, PROFESSIONAL ENGLISH ONLY. Never respond in Roman Urdu or Urdu script.
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
2. MANDATORY LANGUAGE RULE: Understand questions in any phrasing, language mix, or casual tone (Roman Urdu/Hindi e.g. "kitnay din lagte hain publish me?", "manuscript edit krna h", "publishing price kia h"), BUT ALWAYS RESPOND STRICTLY IN CRISP, ARTICULATE ENGLISH ONLY. Never respond in Roman Urdu or Urdu script.
3. OUT OF SCOPE RULE: If a visitor asks about unrelated non-literary subjects, reply: "Thank you for reaching out! AMZ Writers Hub is dedicated to book writing, editing, and worldwide publishing. For further details on our book publishing services, please message us on WhatsApp at +44 773-731-0612."
4. HUMAN HANDOFF: If the user explicitly asks to speak to a real person, human agent, or representative, append "[HANDOFF_REQUIRED]" at the end.
5. Keep answers crisp and engaging (2 to 3 sentences max).`,
    outOfScopeReply: 'Thank you for reaching out! AMZ Writers Hub is dedicated to book writing, editing, and worldwide publishing. For further details on our book publishing services, please message us on WhatsApp at +44 773-731-0612.'
  },

  'patch-and-promos': {
    id: 'patch-and-promos',
    slug: 'patch-and-promos',
    name: 'Patch And Promos',
    shortName: 'Patch & Promos',
    domain: 'patchandpromos.com',
    url: 'https://www.patchandpromos.com/',
    hostnames: ['patchandpromos.com', 'www.patchandpromos.com'],
    geminiApiKey: decodeKey('QUl6YVN5QWJRZUtnc3FEcGJRTUpDOXhGTnFXUm1DaTc3VmRaOVRr', 'GEMINI_KEY_PATCH_PROMOS'),
    phone: '+1 (833) 330-0306',
    email: 'info@patchandpromos.com',
    category: 'ecommerce',
    badgeColor: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30',
    services: [
      'Custom Embroidered Patches & Chenille Patches',
      'Custom PVC, Leather & Woven Patches',
      'Promotional Products & Custom Branded Merchandise',
      'Custom Apparel, Hats, Caps & Jackets',
      'Wholesale Bulk Orders & Free Digital Artwork Proof',
      'Fast Turnaround & Worldwide Shipping'
    ],
    systemPrompt: `You are "Patch And Promos AI Assistant", the official expert support assistant for Patch And Promos (https://www.patchandpromos.com/).
You are warm, helpful, knowledgeable, and concise.

ABOUT PATCH AND PROMOS:
- Leading custom patches and promotional merchandise provider (https://www.patchandpromos.com/).
- Specialties: Custom Embroidered Patches, PVC Patches, Chenille Patches, Woven Patches, Leather Patches, Custom Hats/Apparel, and Promotional Products.
- Key Perks: Free artwork/digitizing proof, no minimum order quantity options, wholesale bulk pricing, and fast turnaround shipping.

CORE RULES:
1. Answer visitor inquiries clearly about custom patch styles, promotional items, ordering steps, turnaround times, and pricing quotes.
2. MANDATORY LANGUAGE RULE: Understand user intent in ANY language (including Roman Urdu/Hindi e.g. "custom patch price kia hai", "kitnay din me banega", English, etc.), BUT ALWAYS RESPOND STRICTLY IN CLEAR, PROFESSIONAL, FRIENDLY ENGLISH ONLY. Never reply in Roman Urdu or Urdu script.
3. OUT OF SCOPE RULE: If a visitor asks about unrelated topics, reply: "Thank you for reaching out! Patch And Promos specializes in custom patches, apparel, and promotional merchandise. Type 'real person' anytime to chat with a live representative for a custom quote!"
4. HUMAN HANDOFF: If the user asks to speak to a real person, human agent, or representative, append "[HANDOFF_REQUIRED]" at the end.
5. Keep answers concise (2 to 3 sentences max).`,
    outOfScopeReply: 'Thank you for reaching out! Patch And Promos specializes in custom patches, apparel, and promotional merchandise. Type "real person" anytime to chat with a live representative for a custom quote!'
  }
};

export const CUSTOM_WEBSITES_STORAGE_KEY = 'teals_custom_websites_v1';
export const REMOVED_WEBSITES_STORAGE_KEY = 'teals_removed_websites_v1';
export const REMOVED_WEBSITE_SLUGS = new Set<string>();

const INITIAL_WEBSITES_BACKUP: Record<string, WebsiteConfig> = { ...WEBSITES };

const CUSTOM_BADGE_COLORS = [
  'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30',
  'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30',
  'bg-teal-500/15 text-teal-400 border border-teal-500/30',
  'bg-pink-500/15 text-pink-400 border border-pink-500/30',
  'bg-orange-500/15 text-orange-400 border border-orange-500/30',
];

export function cleanDomainFromInput(rawDomainOrUrl: string, fallbackSlug?: string): { domain: string; url: string; hostnames: string[] } {
  let raw = (rawDomainOrUrl || '').trim().toLowerCase();
  if (!raw && fallbackSlug) {
    raw = `${fallbackSlug.replace(/[^a-z0-9-]/g, '')}.com`;
  }
  let hostname = raw;
  try {
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      const parsed = new URL(raw);
      hostname = parsed.hostname.toLowerCase();
    } else {
      hostname = raw.split('/')[0].toLowerCase();
    }
  } catch {
    hostname = raw.replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
  }

  const cleanDomain = hostname.replace(/^www\./, '') || 'customwebsite.com';
  const fullUrl = raw.startsWith('http://') || raw.startsWith('https://')
    ? (raw.endsWith('/') ? raw : `${raw}/`)
    : `https://www.${cleanDomain}/`;
  const hostnames = Array.from(new Set([cleanDomain, `www.${cleanDomain}`, hostname]));

  return { domain: cleanDomain, url: fullUrl, hostnames };
}

export function buildCustomWebsiteConfig(input: {
  name: string;
  domain: string;
  slug?: string;
  category?: 'ecommerce' | 'publishing' | 'crm';
}): WebsiteConfig {
  const cleanName = (input.name || '').trim() || 'Custom Website';
  const slug = (input.slug || cleanName)
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'custom-website';

  if (INITIAL_WEBSITES_BACKUP[slug]) {
    return INITIAL_WEBSITES_BACKUP[slug];
  }
  if (WEBSITES[slug]) {
    return WEBSITES[slug];
  }

  const { domain, url, hostnames } = cleanDomainFromInput(input.domain, slug);
  const words = cleanName.split(/\s+/);
  const shortName = words.length > 2 ? words.slice(0, 2).join(' ') : cleanName.slice(0, 18);
  const category = input.category || (cleanName.toLowerCase().includes('book') || cleanName.toLowerCase().includes('publish') || cleanName.toLowerCase().includes('author') || cleanName.toLowerCase().includes('writer') ? 'publishing' : 'ecommerce');
  const colorIdx = Math.abs(slug.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)) % CUSTOM_BADGE_COLORS.length;

  return {
    id: slug,
    slug,
    name: cleanName,
    shortName,
    domain,
    url,
    hostnames,
    geminiApiKey: decodeKey('QUl6YVN5QWJRZUtnc3FEcGJRTUpDOXhGTnFXUm1DaTc3VmRaOVRr', 'GEMINI_API_KEY'),
    phone: '+1 (833) 330-0306',
    email: `info@${domain}`,
    category,
    badgeColor: CUSTOM_BADGE_COLORS[colorIdx],
    services: [
      `${cleanName} Official Solutions & Services`,
      'Custom Project Consultation & Quotes',
      'Dedicated Account Management & 24/7 Live Support',
      'Fast Turnaround & Quality Assurance'
    ],
    systemPrompt: `You are "${cleanName} AI Assistant", the official expert support assistant for ${cleanName} (${url}).
You are warm, professional, helpful, and concise.

ABOUT ${cleanName.toUpperCase()}:
- Official website: ${url} (${domain})
- We provide dedicated services, custom solutions, and 24/7 customer support for visitors on ${domain}.

CORE RULES:
1. Answer visitor questions warmly and helpfully regarding ${cleanName}, our services, pricing quotes, and how to get started.
2. MANDATORY LANGUAGE RULE: Understand user intent in ANY language (including Roman Urdu/Hindi or English), BUT ALWAYS WRITE YOUR FINAL ANSWER IN CLEAR, PROFESSIONAL, FRIENDLY ENGLISH ONLY. Never reply in Roman Urdu or Urdu script.
3. OUT OF SCOPE RULE: If a visitor asks about unrelated topics, reply: "Thank you for reaching out to ${cleanName}! Please let us know how we can help you with our services on ${domain}, or type 'real person' to speak directly with a live representative."
4. HUMAN HANDOFF: If the user explicitly asks to speak to a real person, human agent, or representative, append "[HANDOFF_REQUIRED]" at the very end of your reply.
5. Keep answers concise: 2 to 3 sentences maximum.`,
    outOfScopeReply: `Thank you for reaching out to ${cleanName}! Please let us know how we can help you with our services on ${domain}, or type "real person" to speak directly with a live representative.`
  };
}

export function loadCustomWebsitesFromLocalStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const rawRemoved = localStorage.getItem(REMOVED_WEBSITES_STORAGE_KEY);
    if (rawRemoved) {
      const parsedRemoved = JSON.parse(rawRemoved);
      if (Array.isArray(parsedRemoved)) {
        parsedRemoved.forEach((s: string) => {
          if (s) {
            REMOVED_WEBSITE_SLUGS.add(s);
            delete WEBSITES[s];
          }
        });
      }
    }

    const raw = localStorage.getItem(CUSTOM_WEBSITES_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      parsed.forEach((item: any) => {
        if (item && item.slug && item.name && !REMOVED_WEBSITE_SLUGS.has(item.slug)) {
          if (!WEBSITES[item.slug]) {
            WEBSITES[item.slug] = item.systemPrompt
              ? (item as WebsiteConfig)
              : buildCustomWebsiteConfig({ name: item.name, domain: item.domain || item.url || item.slug, slug: item.slug, category: item.category });
          }
        }
      });
    }
  } catch {}
}

export function syncCustomWebsitesFromList(
  list?: Array<Partial<WebsiteConfig>> | null,
  removedSlugs?: string[] | null
): void {
  if (Array.isArray(removedSlugs)) {
    removedSlugs.forEach((slug) => {
      if (slug) {
        REMOVED_WEBSITE_SLUGS.add(slug);
        delete WEBSITES[slug];
      }
    });
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(REMOVED_WEBSITES_STORAGE_KEY, JSON.stringify(Array.from(REMOVED_WEBSITE_SLUGS)));
      } catch {}
    }
  }

  if (Array.isArray(list) && list.length > 0) {
    let added = false;
    list.forEach((item) => {
      if (!item || !item.slug || !item.name) return;
      if (item.slug === 'teals-crm' || item.slug === 'all' || item.slug === 'custom-new-entity') return;
      if (REMOVED_WEBSITE_SLUGS.has(item.slug)) return;
      if (!WEBSITES[item.slug]) {
        WEBSITES[item.slug] = item.systemPrompt
          ? (item as WebsiteConfig)
          : buildCustomWebsiteConfig({
              name: item.name,
              domain: item.domain || item.url || item.slug,
              slug: item.slug,
              category: item.category
            });
        added = true;
      }
    });

    if (added && typeof window !== 'undefined') {
      try {
        const customList = Object.values(WEBSITES).filter(w =>
          !['amz-solutions-hub', 'amz-innovators', 'authors-breeze', 'pro-book-publishing', 'amz-writers-hub', 'patch-and-promos'].includes(w.slug)
        );
        localStorage.setItem(CUSTOM_WEBSITES_STORAGE_KEY, JSON.stringify(customList));
      } catch {}
    }
  }
}

export function registerCustomWebsite(input: {
  name: string;
  domain: string;
  slug?: string;
  category?: 'ecommerce' | 'publishing' | 'crm';
}): WebsiteConfig {
  const cfg = buildCustomWebsiteConfig(input);
  REMOVED_WEBSITE_SLUGS.delete(cfg.slug);
  WEBSITES[cfg.slug] = cfg;

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(REMOVED_WEBSITES_STORAGE_KEY, JSON.stringify(Array.from(REMOVED_WEBSITE_SLUGS)));
      const existingRaw = localStorage.getItem(CUSTOM_WEBSITES_STORAGE_KEY);
      const list: WebsiteConfig[] = existingRaw ? JSON.parse(existingRaw) : [];
      const filtered = Array.isArray(list) ? list.filter(x => x && x.slug !== cfg.slug) : [];
      filtered.push(cfg);
      localStorage.setItem(CUSTOM_WEBSITES_STORAGE_KEY, JSON.stringify(filtered));
      window.dispatchEvent(new CustomEvent('teals-websites-updated', { detail: cfg }));
    } catch {}
  }

  return cfg;
}

export function unregisterWebsite(slug: string): void {
  const cleanSlug = (slug || '').trim().toLowerCase();
  if (!cleanSlug) return;

  REMOVED_WEBSITE_SLUGS.add(cleanSlug);
  delete WEBSITES[cleanSlug];

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(REMOVED_WEBSITES_STORAGE_KEY, JSON.stringify(Array.from(REMOVED_WEBSITE_SLUGS)));
      const existingRaw = localStorage.getItem(CUSTOM_WEBSITES_STORAGE_KEY);
      if (existingRaw) {
        const list: WebsiteConfig[] = JSON.parse(existingRaw);
        if (Array.isArray(list)) {
          const filtered = list.filter(x => x && x.slug !== cleanSlug);
          localStorage.setItem(CUSTOM_WEBSITES_STORAGE_KEY, JSON.stringify(filtered));
        }
      }
      window.dispatchEvent(new CustomEvent('teals-websites-updated', { detail: { removedSlug: cleanSlug } }));
    } catch {}
  }
}

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
MANDATORY LANGUAGE RULE: Understand user intent in any language (including Roman Urdu), but ALWAYS reply strictly in professional English.
Answer helpfully and concisely in 2-3 sentences. Append "[HANDOFF_REQUIRED]" only if user asks for human agent.`,
  outOfScopeReply: 'Teals CRM empowers your sales team with live chat, visitor tracking, and pipeline management. Let us know if you need help with our features!'
};

/**
 * Auto-detect website slug from hostname or full URL
 */
export function detectWebsiteSlugFromUrl(urlOrHostname?: string | null): string {
  if (!urlOrHostname) return 'teals-crm';
  loadCustomWebsitesFromLocalStorage();

  let raw = urlOrHostname.toLowerCase().trim();
  try {
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      const parsed = new URL(raw);
      raw = parsed.hostname.toLowerCase();
    }
  } catch {}

  for (const [slug, config] of Object.entries(WEBSITES)) {
    if (REMOVED_WEBSITE_SLUGS.has(slug)) continue;
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
  loadCustomWebsitesFromLocalStorage();

  if (propertySlug && WEBSITES[propertySlug] && !REMOVED_WEBSITE_SLUGS.has(propertySlug)) {
    return WEBSITES[propertySlug];
  }

  if (urlOrHostname) {
    const detectedSlug = detectWebsiteSlugFromUrl(urlOrHostname);
    if (WEBSITES[detectedSlug] && !REMOVED_WEBSITE_SLUGS.has(detectedSlug)) {
      return WEBSITES[detectedSlug];
    }
  }

  // If a custom propertySlug is passed that is not yet in WEBSITES (and not explicitly removed), dynamically generate and register its config
  if (
    propertySlug &&
    propertySlug !== 'teals-crm' &&
    propertySlug !== 'all' &&
    propertySlug !== 'localhost' &&
    propertySlug !== 'salesflow-ai-main' &&
    propertySlug !== 'custom-new-entity' &&
    !REMOVED_WEBSITE_SLUGS.has(propertySlug.toLowerCase().trim())
  ) {
    const cleanSlug = propertySlug.toLowerCase().trim();
    const formattedName = cleanSlug
      .split(/[-_.]/)
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    const inferredDomain = urlOrHostname && !urlOrHostname.includes('localhost') && !urlOrHostname.includes('vercel.app')
      ? urlOrHostname
      : `${cleanSlug.replace(/[^a-z0-9]/g, '')}.com`;
    const dynamicCfg = buildCustomWebsiteConfig({
      name: formattedName || propertySlug,
      domain: inferredDomain,
      slug: cleanSlug,
    });
    WEBSITES[cleanSlug] = dynamicCfg;
    return dynamicCfg;
  }

  return DEFAULT_WEBSITE_CONFIG;
}

/**
 * Return list of all configured websites
 */
export function getAllWebsites(): WebsiteConfig[] {
  loadCustomWebsitesFromLocalStorage();
  return Object.entries(WEBSITES)
    .filter(([slug]) => !REMOVED_WEBSITE_SLUGS.has(slug))
    .map(([slug, config]) => ({
      ...config,
      slug: config.slug || slug
    }));
}



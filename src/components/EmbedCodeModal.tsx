'use client';

import React, { useState, useEffect } from 'react';
import {
  X, Copy, Check, Code2, ExternalLink, Globe, Sparkles,
  CheckCircle2, ShoppingCart, Rocket, BookOpen, PenTool,
  BookMarked, PlusCircle, HelpCircle, Trash2
} from 'lucide-react';
import { getAllWebsites, cleanDomainFromInput } from '@/lib/websites-config';
import { useLiveSync } from '@/context/LiveSyncContext';

interface EmbedCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialWebsiteSlug?: string;
}

export const EmbedCodeModal: React.FC<EmbedCodeModalProps> = ({
  isOpen,
  onClose,
  initialWebsiteSlug = 'amz-solutions-hub',
}) => {
  const { websites: contextWebsites, addCustomWebsite, removeWebsite } = useLiveSync();
  const websites = contextWebsites && contextWebsites.length > 0 ? contextWebsites : getAllWebsites();

  const [selectedSlug, setSelectedSlug] = useState<string>(initialWebsiteSlug);
  const [codeType, setCodeType] = useState<'html' | 'react' | 'cms'>('html');
  const [copied, setCopied] = useState(false);

  // Custom entity state
  const [customName, setCustomName] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [customSavedBanner, setCustomSavedBanner] = useState<string | null>(null);
  const [savingCustom, setSavingCustom] = useState(false);
  const [confirmRemoveSlug, setConfirmRemoveSlug] = useState<string | null>(null);
  const [removingSite, setRemovingSite] = useState(false);

  useEffect(() => {
    if (initialWebsiteSlug) {
      setSelectedSlug(initialWebsiteSlug);
      setConfirmRemoveSlug(null);
    }
  }, [initialWebsiteSlug]);

  if (!isOpen) return null;

  const isCustom = selectedSlug === 'custom-new-entity';

  const selectedSite = websites.find(w => w.slug === selectedSlug);

  const effectiveName = isCustom
    ? (customName.trim() || 'Custom Website')
    : (selectedSite?.name || 'Website');

  const rawSlug = customName.trim()
    ? customName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    : 'custom-website';

  const effectiveSlug = isCustom
    ? rawSlug
    : (selectedSite?.slug || 'amz-solutions-hub');

  const effectiveDomain = isCustom
    ? (customDomain.trim() ? cleanDomainFromInput(customDomain, rawSlug).domain : 'mycustomdomain.com')
    : (selectedSite?.domain || 'example.com');

  const originUrl = typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost')
    ? window.location.origin
    : 'https://teals-livechat-saas.vercel.app';

  const htmlCode = `<!-- LiveChat AI Widget for ${effectiveName} (${effectiveDomain}) -->
<script 
  src="${originUrl}/widget.js" 
  data-property="${effectiveSlug}" 
  async>
</script>`;

  const reactCode = `import Script from 'next/script';

// Embed LiveChat AI Widget for ${effectiveName}
export function LiveChatWidget() {
  return (
    <Script
      src="${originUrl}/widget.js"
      data-property="${effectiveSlug}"
      strategy="lazyOnload"
    />
  );
}`;

  const currentCode = codeType === 'react' ? reactCode : htmlCode;

  const persistCustomIfEntered = async (switchSelection = false) => {
    if (!isCustom || !customName.trim()) return null;
    setSavingCustom(true);
    try {
      const created = await addCustomWebsite({
        name: customName.trim(),
        domain: customDomain.trim() || `${rawSlug}.com`,
        slug: rawSlug,
      });
      setCustomSavedBanner(`"${created.name}" (${created.domain}) has been added to Dashboard, Live Monitoring & Active Chats!`);
      if (switchSelection) {
        setSelectedSlug(created.slug);
        setCustomName('');
        setCustomDomain('');
      }
      return created;
    } finally {
      setSavingCustom(false);
    }
  };

  const handleCopy = async (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
    if (isCustom && customName.trim()) {
      await persistCustomIfEntered(false);
    }
  };

  const handleDone = async () => {
    if (isCustom && customName.trim()) {
      await persistCustomIfEntered(true);
    }
    onClose();
  };

  const getWebsiteIcon = (slug: string) => {
    switch (slug) {
      case 'amz-solutions-hub': return ShoppingCart;
      case 'amz-innovators': return Rocket;
      case 'authors-breeze': return BookOpen;
      case 'pro-book-publishing': return PenTool;
      case 'amz-writers-hub': return BookMarked;
      case 'patch-and-promos': return Sparkles;
      default: return Globe;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#0b101d] border border-dark-border rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-dark-border/80 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Get Embed Code
                </h3>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Dedicated Script
                </span>
              </div>
              <p className="text-xs text-dark-muted mt-0.5">
                Each website has its own dedicated script snippet with isolated AI routing
              </p>
            </div>
          </div>
          <button
            onClick={handleDone}
            className="p-1.5 rounded-xl text-dark-muted hover:text-white hover:bg-dark-card transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Website Selector / Switcher */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-dark-muted uppercase tracking-wider block">
            Select Website / Entity ({websites.length} Connected):
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {websites.map((site) => {
              const IconComp = getWebsiteIcon(site.slug);
              const isSelected = selectedSlug === site.slug;
              return (
                <button
                  key={site.slug}
                  type="button"
                  onClick={() => {
                    setSelectedSlug(site.slug);
                    setCustomSavedBanner(null);
                  }}
                  className={`p-2.5 rounded-xl text-left border transition-all flex items-center space-x-2 ${
                    isSelected
                      ? 'bg-blue-600/20 border-blue-500 text-white shadow-md shadow-blue-500/10'
                      : 'bg-[#0e1628] border-dark-border text-gray-400 hover:text-white hover:border-gray-700'
                  }`}
                >
                  <IconComp className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-blue-400' : 'text-gray-500'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate">{site.shortName}</p>
                    <p className="text-[10px] text-gray-500 truncate">{site.domain}</p>
                  </div>
                </button>
              );
            })}

            {/* Custom Entity Option */}
            <button
              type="button"
              onClick={() => {
                setSelectedSlug('custom-new-entity');
                setCustomSavedBanner(null);
              }}
              className={`p-2.5 rounded-xl text-left border transition-all flex items-center space-x-2 ${
                isCustom
                  ? 'bg-purple-600/20 border-purple-500 text-white shadow-md shadow-purple-500/10'
                  : 'bg-[#0e1628] border-dashed border-dark-border text-gray-400 hover:text-white hover:border-purple-500/50'
              }`}
            >
              <PlusCircle className={`w-4 h-4 flex-shrink-0 ${isCustom ? 'text-purple-400' : 'text-purple-500'}`} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold truncate text-purple-300">+ New Website</p>
                <p className="text-[10px] text-purple-400/70 truncate">Custom Entity</p>
              </div>
            </button>
          </div>
        </div>

        {customSavedBanner && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center space-x-2 text-xs text-emerald-300 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{customSavedBanner}</span>
          </div>
        )}

        {/* If Custom Entity is selected, show inputs */}
        {isCustom && (
          <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h4 className="text-xs font-bold text-white">Generate Code & Add New Custom Website to System</h4>
              </div>
              {customName.trim() && (
                <button
                  type="button"
                  disabled={savingCustom}
                  onClick={() => persistCustomIfEntered(true)}
                  className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-[11px] font-bold transition-all shadow-sm flex items-center space-x-1 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>{savingCustom ? 'Adding...' : 'Add Website to System'}</span>
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-300 block mb-1">
                  Website / Business Name:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Patch And Promos"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#070b14] border border-dark-border text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-300 block mb-1">
                  Website Domain URL:
                </label>
                <input
                  type="text"
                  placeholder="e.g. https://www.patchandpromos.com/"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#070b14] border border-dark-border text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Code Format Tabs */}
        <div className="flex items-center space-x-1.5 border-b border-dark-border pb-2 text-xs">
          <button
            onClick={() => setCodeType('html')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              codeType === 'html'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-dark-card hover:bg-dark-surface text-gray-400 hover:text-white'
            }`}
          >
            HTML &lt;script&gt;
          </button>
          <button
            onClick={() => setCodeType('react')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              codeType === 'react'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-dark-card hover:bg-dark-surface text-gray-400 hover:text-white'
            }`}
          >
            React / Next.js
          </button>
          <button
            onClick={() => setCodeType('cms')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              codeType === 'cms'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-dark-card hover:bg-dark-surface text-gray-400 hover:text-white'
            }`}
          >
            WordPress / Shopify / Webflow
          </button>
        </div>

        {/* Code Display or CMS Instructions */}
        {codeType === 'cms' ? (
          <div className="bg-[#070b14] border border-dark-border rounded-xl p-4 space-y-3 text-xs text-gray-300">
            <h4 className="font-bold text-white flex items-center space-x-1.5">
              <HelpCircle className="w-4 h-4 text-blue-400" />
              <span>Step-by-Step Installation for CMS Platforms:</span>
            </h4>
            <ol className="list-decimal list-inside space-y-2 leading-relaxed text-gray-300">
              <li>
                <strong className="text-white">WordPress:</strong> Go to <span className="font-mono text-blue-300">Appearance → Theme File Editor → footer.php</span> or use any <span className="font-mono text-blue-300">Insert Headers and Footers</span> plugin, and paste the code right before the <code className="text-blue-400 font-mono">&lt;/body&gt;</code> tag.
              </li>
              <li>
                <strong className="text-white">Shopify:</strong> Go to <span className="font-mono text-blue-300">Online Store → Themes → Edit Code → theme.liquid</span> and paste before <code className="text-blue-400 font-mono">&lt;/body&gt;</code>.
              </li>
              <li>
                <strong className="text-white">Webflow / Squarespace:</strong> Go to <span className="font-mono text-blue-300">Project Settings → Custom Code → Footer Code</span>.
              </li>
            </ol>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleCopy(htmlCode)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center space-x-2 text-xs shadow-md transition-all cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied HTML Code!' : `Copy HTML Code for ${effectiveName}`}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative bg-[#070b14] border border-dark-border rounded-xl p-4 font-mono text-xs text-blue-300 shadow-inner group">
              <pre className="overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {currentCode}
              </pre>
              <button
                type="button"
                onClick={() => handleCopy(currentCode)}
                className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md transition-all cursor-pointer active:scale-95"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>
            <p className="text-[11px] text-dark-muted flex items-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>
                Configured for: <strong className="text-white">{effectiveName}</strong> (<span className="font-mono text-blue-400">data-property=&quot;{effectiveSlug}&quot;</span>)
              </span>
            </p>
          </div>
        )}

        {/* Footer info & Links */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-dark-border/80 text-xs">
          <a
            href={`/demo?property=${encodeURIComponent(effectiveSlug)}`}
            target="_blank"
            rel="noreferrer"
            className="text-blue-400 hover:underline flex items-center space-x-1.5 font-semibold"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Test Live Preview on Demo Page ({effectiveName})</span>
          </a>

          <div className="flex items-center justify-end gap-2">
            {!isCustom && selectedSite && (
              confirmRemoveSlug === selectedSite.slug ? (
                <div className="flex items-center gap-1.5 bg-rose-950/40 border border-rose-500/40 rounded-xl px-2.5 py-1">
                  <span className="text-[11px] text-rose-300 font-semibold">Remove {selectedSite.shortName}?</span>
                  <button
                    type="button"
                    disabled={removingSite}
                    onClick={async () => {
                      setRemovingSite(true);
                      try {
                        const slugToDelete = selectedSite.slug;
                        await removeWebsite(slugToDelete);
                        setConfirmRemoveSlug(null);
                        const remaining = getAllWebsites().filter(w => w.slug !== slugToDelete);
                        setSelectedSlug(remaining[0]?.slug || 'custom-new-entity');
                        setCustomSavedBanner(`"${selectedSite.name}" has been removed from the entire system.`);
                      } finally {
                        setRemovingSite(false);
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold cursor-pointer"
                  >
                    {removingSite ? 'Removing...' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRemoveSlug(null)}
                    className="px-2 py-1 rounded-lg bg-dark-card hover:bg-dark-surface text-gray-300 text-[11px] font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmRemoveSlug(selectedSite.slug)}
                  className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Website</span>
                </button>
              )
            )}

            <button
              type="button"
              disabled={savingCustom}
              onClick={handleDone}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 border border-blue-500 text-xs font-bold text-white transition-colors self-end sm:self-auto cursor-pointer shadow-md"
            >
              {isCustom && customName.trim() ? (savingCustom ? 'Adding Website...' : 'Add Website & Done') : 'Done'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


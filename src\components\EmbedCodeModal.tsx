'use client';

import React, { useState } from 'react';
import { X, Copy, Check, Code2, ExternalLink } from 'lucide-react';

interface EmbedCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  propertySlug: string;
}

export const EmbedCodeModal: React.FC<EmbedCodeModalProps> = ({
  isOpen,
  onClose,
  propertySlug,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const scriptTag = `<!-- Teals CRM Live Chat Widget -->
<script 
  src="${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.vercel.app'}/widget.js" 
  data-property="${propertySlug}" 
  async>
</script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptTag);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-dark-card border border-dark-border rounded-2xl max-w-lg w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Code2 className="w-5 h-5 text-brand-secondary" />
            <h3 className="text-base font-bold text-dark-text">Install Live Chat Widget</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-dark-muted hover:text-dark-text hover:bg-dark-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-dark-muted mb-4 leading-relaxed">
          Copy and paste this snippet right before the closing <code className="text-brand-secondary font-mono">&lt;/body&gt;</code> tag on any website (e.g. Teals CRM or Leadzmaker).
        </p>

        <div className="relative bg-dark-bg border border-dark-border rounded-xl p-4 font-mono text-xs text-brand-secondary mb-5">
          <pre className="overflow-x-auto whitespace-pre-wrap">{scriptTag}</pre>
          <button
            onClick={handleCopy}
            className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-brand-primary text-white text-xs font-semibold flex items-center space-x-1.5 shadow-md hover:bg-brand-primaryHover transition-all"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-brand-emerald" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy Code'}</span>
          </button>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-dark-border">
          <a
            href="/demo"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-brand-secondary hover:underline flex items-center space-x-1"
          >
            <span>Test live preview on Demo page</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-dark-surface hover:bg-dark-cardHover border border-dark-border text-xs font-semibold text-dark-text transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

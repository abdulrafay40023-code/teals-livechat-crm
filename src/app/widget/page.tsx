'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { WidgetChat } from '@/components/WidgetChat';

function WidgetInner() {
  const searchParams = useSearchParams();
  const propertySlug = searchParams.get('property') || 'teals-crm';
  const visitorToken = searchParams.get('token') || undefined;
  const sessionId = searchParams.get('session') || undefined;
  const pageUrl = searchParams.get('page') || '/';
  const referrerUrl = searchParams.get('ref') || 'Direct';

  return (
    <div className="w-full h-full bg-transparent">
      <style jsx global>{`
        html, body {
          background: transparent !important;
          background-color: transparent !important;
          margin: 0;
          padding: 0;
          overflow: hidden;
        }
      `}</style>
      <WidgetChat
        propertySlug={propertySlug}
        visitorTokenProp={visitorToken}
        sessionIdProp={sessionId}
        pageUrl={pageUrl}
        referrerUrl={referrerUrl}
      />
    </div>
  );
}

export default function WidgetPage() {
  return (
    <Suspense fallback={null}>
      <WidgetInner />
    </Suspense>
  );
}

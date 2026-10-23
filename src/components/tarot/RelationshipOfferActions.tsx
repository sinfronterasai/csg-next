'use client';

import { useEffect, useState } from 'react';
import { getProduct } from '@/lib/productCatalog';
import { campaignEvent } from '@/lib/campaign/client';
import { RELATIONSHIP_OFFER_PATH, RELATIONSHIP_READING_PATH } from '@/lib/tarot/relationshipOffer';

type Access = 'checking' | 'signed_out' | 'locked' | 'unlocked' | 'error';

export default function RelationshipOfferActions() {
  const [access, setAccess] = useState<Access>('checking');
  const product = getProduct('relationship-dynamics-tarot');
  async function checkAccess() {
    setAccess('checking');
    try {
      const response = await fetch('/api/tarot/relationship-access', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !['signed_out', 'locked', 'unlocked'].includes(data.status)) throw new Error('Unavailable');
      setAccess(data.status);
    } catch { setAccess('error'); }
  }
  useEffect(() => {
    campaignEvent('relationship_offer_view', { product_id: product.id });
    void checkAccess();
    function onFocus() { void checkAccess(); }
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [product.id]);
  const buttonClass = 'inline-flex min-h-[48px] items-center justify-center rounded-full bg-gold px-6 py-3 font-semibold text-cosmic-950';
  const returnTo = encodeURIComponent(RELATIONSHIP_OFFER_PATH + '#purchase');
  return (
    <div className="space-y-4">
      {access === 'checking' && <p role="status">Checking your access…</p>}
      {access === 'error' && <p role="alert">We couldn’t check your access. Please retry before paying.</p>}
      {access === 'signed_out' && <>
        <a className={buttonClass} href={'/signup?returnTo=' + returnTo} onClick={() => campaignEvent('offer_click', { product_id: product.id })}>Create account to continue — {product.formattedPrice}</a>
        <p className="text-sm text-cosmic-200">Already have an account? <a className="underline" href={'/login?returnTo=' + returnTo}>Sign in</a></p>
      </>}
      {access === 'locked' && <>
        <a className={buttonClass} href={product.checkoutDestination} target="_blank" rel="noopener noreferrer" onClick={() => campaignEvent('checkout_click', { product_id: product.id })}>Continue to secure checkout — {product.formattedPrice}</a>
        <p className="text-sm text-cosmic-200">Use the same email as your Cosmic Spirit Guide account. Checkout opens in a new tab. After payment, return here and check your access below.</p>
      </>}
      {access === 'unlocked' && <>
        <p role="status" className="text-gold">Your Relationship Dynamics reading is unlocked.</p>
        <a className={buttonClass} href={RELATIONSHIP_READING_PATH} onClick={() => campaignEvent('offer_click', { product_id: product.id })}>Ask my relationship question</a>
      </>}
      {(access === 'locked' || access === 'error') && <button type="button" onClick={() => void checkAccess()} className="block min-h-[44px] text-gold underline">Already paid? Check my access</button>}
      <p className="text-sm text-cosmic-200">One-time payment. No subscription. Your reading is generated on screen when you submit your question after access is confirmed. If access hasn’t appeared, check again; please don’t pay twice. <a href="/contact" className="underline">Get help</a>.</p>
    </div>
  );
}

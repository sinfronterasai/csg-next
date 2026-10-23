'use client';

import { useEffect, useState } from 'react';
import type { ReadingViewModel } from '@/lib/tarot/view';
import { readingShareCaption, renderReadingShare, SHARE_SIZES, type ShareFormat } from '@/lib/tarot/share';

export default function ReadingShare({ reading }: { reading: ReadingViewModel }) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ShareFormat>('feed');
  const [includeQuestion, setIncludeQuestion] = useState(false);
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [canShare, setCanShare] = useState(false);
  const caption = readingShareCaption(reading, includeQuestion);

  useEffect(() => {
    if (!open) return;
    let cancelled = false, url = '';
    setPreview(null); setError(''); setNotice(''); setCanShare(false);
    renderReadingShare(reading, format, includeQuestion).then(blob => {
      if (cancelled) return;
      url = URL.createObjectURL(blob); setPreview({ url, blob });
      const file = new File([blob], 'my-tarot-reading.png', { type: 'image/png' });
      setCanShare(typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] }));
    }).catch(() => { if (!cancelled) setError('We couldn’t create your image. Please try again, or keep your reading as a PDF.'); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [open, reading, format, includeQuestion]);

  async function share() {
    if (!preview) return;
    try {
      await navigator.share({ files: [new File([preview.blob], `my-tarot-${format}.png`, { type: 'image/png' })], text: caption });
    } catch (e) {
      if (!(e instanceof Error && e.name === 'AbortError')) setNotice('Sharing isn’t available here. Download the PNG and copy your caption instead.');
    }
  }

  async function copyCaption() {
    try { await navigator.clipboard.writeText(caption); setNotice('Caption copied. Paste it alongside your image.'); }
    catch { setNotice('Select and copy the caption below.'); }
  }

  return <div className="mt-4">
    <button type="button" aria-expanded={open} aria-controls="reading-share-panel" onClick={() => setOpen(!open)} className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-cosmic-950">{open ? 'Close sharing preview' : 'Share my reading'}</button>
    {open && <section id="reading-share-panel" aria-label="Share your reading" className="glass-panel mt-4 rounded-2xl border border-gold/30 p-5">
      <h3 className="text-lg font-semibold text-gold">Make it yours</h3>
      <p className="mt-2 text-sm text-cosmic-200">Preview exactly what you’ll share. Card themes are included; your full interpretation, journal, and astrology details stay out of the image and caption. Nothing is posted automatically.</p>
      <label className="mt-4 block text-sm">Image format
        <select style={{ backgroundColor: "#12072b", color: "#f9fafb", colorScheme: "dark", cursor: "pointer" }} value={format} onChange={e => setFormat(e.target.value as ShareFormat)} className="form-dark-control ml-3 rounded-lg border border-cosmic-700 bg-cosmic-950 p-2 text-cosmic-100">
          <option value="feed">Feed — 1080 × 1350</option><option value="story">Story — 1080 × 1920</option>
        </select>
      </label>
      <label className="my-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={includeQuestion} onChange={e => setIncludeQuestion(e.target.checked)} /> Include my question in the image and caption</label>
      {error ? <p role="alert">{error}</p> : preview ? <img src={preview.url} width={SHARE_SIZES[format].width} height={SHARE_SIZES[format].height} alt="Preview of your shareable tarot reading" className="mx-auto h-auto w-full max-w-sm rounded-xl" /> : <p role="status">Preparing your image…</p>}
      <div className="my-4 flex flex-wrap gap-3">
        {preview && <a href={preview.url} download={`my-tarot-${format}.png`} className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-cosmic-950">Download PNG</a>}
        {preview && canShare && <button type="button" onClick={share} className="rounded-lg border border-gold/50 px-4 py-2 text-sm text-gold">Share image</button>}
        <button type="button" onClick={copyCaption} className="rounded-lg border border-gold/50 px-4 py-2 text-sm text-gold">Copy caption</button>
      </div>
      <label className="block text-sm">Your caption<textarea style={{ backgroundColor: "#12072b", color: "#f9fafb", colorScheme: "dark", cursor: "text" }} readOnly value={caption} rows={7} className="form-dark-control mt-2 w-full rounded-lg border border-cosmic-700 bg-cosmic-950 p-3 text-cosmic-100" onFocus={e => e.currentTarget.select()} /></label>
      <p className="mt-2 text-xs text-cosmic-200">Upload the PNG to Facebook or Instagram and paste your caption. Your device’s Share option appears when supported.</p>
      <p role="status" className="mt-2 text-sm text-gold">{notice}</p>
    </section>}
  </div>;
}

import type { ReadingViewModel } from './view';

export type ShareFormat = 'feed' | 'story';
export const SHARE_SIZES = { feed: { width: 1080, height: 1350 }, story: { width: 1080, height: 1920 } };

export function readingShareTitle(reading: ReadingViewModel) {
  return reading.spreadId === 'past_present_future'
    ? 'My Past · Present · Future Reading'
    : 'My Tarot Reading';
}

export function readingShareCaption(reading: ReadingViewModel, includeQuestion = false) {
  const question = includeQuestion ? `I asked: “${reading.question}”\n\n` : '';
  return `${question}${readingShareTitle(reading)}\n\n${reading.cards.map(c => `${c.positionLabel}: ${c.name}${c.reversed ? ' (reversed)' : ''}`).join('\n')}\n\nWhich card speaks to you most?\n\nFor reflection, not a fixed prediction.\nTry your own: https://cosmicspiritguide.com/tarot`;
}

function lines(ctx: CanvasRenderingContext2D, text: string, width: number, max: number) {
  const result: string[] = [];
  let line = '';
  for (const word of text.trim().split(/\s+/)) {
    if (line && ctx.measureText(`${line} ${word}`).width > width) { result.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) result.push(line);
  if (result.length > max) {
    result.length = max;
    let last = result[max - 1];
    while (last && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1);
    result[max - 1] = `${last}…`;
  }
  return result;
}

function image(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    const timer = window.setTimeout(() => { img.src = ''; resolve(null); }, 8000);
    img.crossOrigin = 'anonymous';
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = src;
  });
}

/** Render only the explicitly selected public fields. Never includes journal or astrology data. */
export async function renderReadingShare(reading: ReadingViewModel, format: ShareFormat, includeQuestion: boolean): Promise<Blob> {
  const { width, height } = SHARE_SIZES[format];
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image download is unavailable in this browser.');
  const pictures = await Promise.all(reading.cards.map(c => c.artRef ? image(c.artRef) : Promise.resolve(null)));
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#090514'); gradient.addColorStop(1, '#291044');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#b79a60'; ctx.lineWidth = 2; ctx.strokeRect(32, 32, width - 64, height - 64);
  ctx.textAlign = 'center'; ctx.fillStyle = '#e5c786';
  ctx.font = '24px Georgia'; ctx.fillText('✦  COSMIC SPIRIT GUIDE  ✦', width / 2, 92);
  ctx.font = 'bold 44px Georgia';
  lines(ctx, readingShareTitle(reading), width - 130, 2).forEach((line, i) => ctx.fillText(line, width / 2, 165 + i * 52));
  ctx.fillStyle = '#e4dce9'; ctx.font = '25px sans-serif';
  const intro = includeQuestion ? reading.question : 'A moment to pause, reflect, and choose my next step.';
  lines(ctx, intro, width - 160, 3).forEach((line, i) => ctx.fillText(line, width / 2, 255 + i * 34));
  const cols = Math.min(3, Math.max(1, reading.cards.length));
  const rows = Math.ceil(reading.cards.length / cols);
  const compact = reading.cards.length > 3;
  const top = format === 'story' ? 430 : 390;
  const gap = 24, cellWidth = (width - 144 - gap * (cols - 1)) / cols;
  const rowHeight = Math.min(format === 'story' ? 910 : 730, (height - top - 170) / Math.max(1, rows));
  reading.cards.forEach((card, i) => {
    const x = 72 + (i % cols) * (cellWidth + gap), y = top + Math.floor(i / cols) * rowHeight;
    const artHeight = Math.max(50, Math.min(cellWidth * 1.48, rowHeight - (compact ? 125 : 220)));
    const artWidth = Math.min(cellWidth - 20, artHeight * .65);
    ctx.fillStyle = '#e5c786'; ctx.font = 'bold 25px sans-serif';
    ctx.fillText(card.positionLabel, x + cellWidth / 2, y);
    ctx.save(); ctx.translate(x + cellWidth / 2, y + 25 + artHeight / 2);
    if (card.reversed) ctx.rotate(Math.PI);
    ctx.fillStyle = '#1c102e'; ctx.fillRect(-artWidth / 2, -artHeight / 2, artWidth, artHeight);
    const pic = pictures[i];
    if (pic) {
      // Fit without distorting or cropping the actual card art.
      const scale = Math.min(artWidth / pic.naturalWidth, artHeight / pic.naturalHeight);
      const w = pic.naturalWidth * scale, h = pic.naturalHeight * scale;
      ctx.drawImage(pic, -w / 2, -h / 2, w, h);
    } else {
      ctx.fillStyle = '#e5c786'; ctx.font = '40px Georgia'; ctx.fillText('✦', 0, 12);
    }
    ctx.strokeStyle = '#b79a60'; ctx.strokeRect(-artWidth / 2, -artHeight / 2, artWidth, artHeight); ctx.restore();
    let textY = y + artHeight + (compact ? 50 : 66);
    ctx.fillStyle = '#fff7e8'; ctx.font = compact ? 'bold 22px Georgia' : 'bold 27px Georgia';
    lines(ctx, card.name, cellWidth, 2).forEach(line => { ctx.fillText(line, x + cellWidth / 2, textY); textY += compact ? 26 : 32; });
    ctx.fillStyle = '#e5c786'; ctx.font = compact ? '17px sans-serif' : '20px sans-serif';
    ctx.fillText(card.reversed ? 'Reversed' : 'Upright', x + cellWidth / 2, textY); textY += 34;
    ctx.fillStyle = '#e4dce9'; ctx.font = '22px sans-serif';
    if (!compact) lines(ctx, card.meaning, cellWidth - 8, 4).forEach(line => { ctx.fillText(line, x + cellWidth / 2, textY); textY += 29; });
  });
  ctx.fillStyle = '#e4dce9'; ctx.font = '22px sans-serif';
  ctx.fillText(compact ? 'For reflection, not a fixed prediction.' : 'Card themes · For reflection, not a fixed prediction.', width / 2, height - 110);
  ctx.fillStyle = '#e5c786'; ctx.font = '26px Georgia'; ctx.fillText('cosmicspiritguide.com', width / 2, height - 67);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not create the image. Please try again.')), 'image/png'));
}

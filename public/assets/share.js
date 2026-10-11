import { REPO, fmt, formatValue, units, PERIODS } from './model.js';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    const timer = setTimeout(() => { image.onload = image.onerror = null; reject(new Error('Image timed out')); }, 12000);
    image.onload = () => { clearTimeout(timer); resolve(image); };
    image.onerror = () => { clearTimeout(timer); reject(new Error('Image unavailable')); };
    image.src = src;
  });
}

export async function createShareCard(personal, settings) {
  await document.fonts.ready;
  const [photo, logo, avatar] = await Promise.all([
    loadImage(new URL('./omi-studio-v2.png', import.meta.url).href),
    loadImage(new URL('./omi-logo.png', import.meta.url).href),
    loadImage(`https://avatars.githubusercontent.com/${encodeURIComponent(personal.me.username)}?s=160`).catch(() => null),
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = 2400; canvas.height = 1260;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `${personal.me.username}, rank ${personal.me.rank} of ${fmt(personal.total)} Omi contributors, ${fmt(personal.me.value)} ${units(personal.me.value, settings.metric)}`);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not create a share card.');
  ctx.scale(2, 2);
  ctx.fillStyle = '#0b0d11'; ctx.fillRect(0, 0, 1200, 630);
  // Cover the right pane with the studio photo, retaining its original lighting.
  const pane = { x: 690, y: 0, w: 510, h: 630 };
  const scale = Math.max(pane.w / photo.width, pane.h / photo.height);
  ctx.save(); ctx.beginPath(); ctx.rect(pane.x, pane.y, pane.w, pane.h); ctx.clip();
  ctx.drawImage(photo, pane.x + (pane.w - photo.width * scale) / 2, (pane.h - photo.height * scale) / 2, photo.width * scale, photo.height * scale);
  ctx.restore();
  ctx.drawImage(logo, 48, 38, 78, 34);
  const font = (weight, size) => `${weight} ${size}px Manrope, sans-serif`;
  ctx.font = font(500, 18); ctx.fillStyle = '#9da6b6'; ctx.fillText('Leaderboard', 148, 63);
  const name = personal.me.username;
  if (avatar) {
    ctx.save(); ctx.beginPath(); ctx.arc(70, 153, 22, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(avatar, 48, 131, 44, 44); ctx.restore();
  } else {
    ctx.fillStyle = '#202838'; ctx.beginPath(); ctx.arc(70, 153, 22, 0, Math.PI * 2); ctx.fill();
    ctx.font = font(700, 21); ctx.fillStyle = '#e1e7f2'; ctx.fillText(name[0].toUpperCase(), 62, 161);
  }
  let nameSize = 25;
  ctx.font = font(700, nameSize);
  while (ctx.measureText(name).width > 510 && nameSize > 14) ctx.font = font(700, --nameSize);
  ctx.fillStyle = '#f5f6f8'; ctx.fillText(name, 108, 162);
  ctx.font = font(800, 154); ctx.fillStyle = '#80aaff'; ctx.fillText(`#${personal.me.rank}`, 40, 351);
  ctx.font = font(700, 28); ctx.fillStyle = '#f5f6f8'; ctx.fillText(`of ${fmt(personal.total)} Omi contributors`, 48, 402);
  ctx.font = font(500, 19); ctx.fillStyle = '#a8b0bf';
  const when = settings.metric === 'commits' ? 'all time' : PERIODS[settings.period];
  ctx.fillText(`${formatValue(personal.me.value, settings.metric)} ${units(personal.me.value, settings.metric)} · ${when}`, 48, 444);
  ctx.strokeStyle = '#2a2f3a'; ctx.beginPath(); ctx.moveTo(48, 490); ctx.lineTo(638, 490); ctx.stroke();
  ctx.font = font(700, 15); ctx.fillStyle = '#80aaff'; ctx.fillText(`TOP ${personal.top}%`, 48, 526);
  ctx.font = font(500, 15); ctx.fillStyle = '#a8b0bf'; ctx.fillText('Every merged PR, remembered.', 48, 578);
  ctx.font = font(500, 11); ctx.textAlign = 'right'; ctx.fillText(`github.com/${REPO}`, 638, 578);
  return canvas;
}

export function downloadCanvas(canvas, username) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => {
    if (!blob) return reject(new Error('Could not create the image. Please try again.'));
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `omi-rank-${username}.png`; a.href = url;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    resolve();
  }, 'image/png'));
}

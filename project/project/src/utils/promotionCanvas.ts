import { PromotionProduct, promotionPriceLabel, shippingLabel } from './promotionKit';

export const PROMO_FORMATS = [
  { id: 'square', name: 'Square post', width: 1080, height: 1080 },
  { id: 'pin', name: 'Pinterest pin', width: 1000, height: 1500 },
  { id: 'story', name: 'Story / Reel', width: 1080, height: 1920 },
  { id: 'flyer', name: 'Printable flyer', width: 1275, height: 1650 },
];
export async function loadPromoImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    const timer = window.setTimeout(() => reject(new Error('Image download timed out. Try again.')), 15000);
    image.onload = () => { clearTimeout(timer); resolve(image); };
    image.onerror = () => { clearTimeout(timer); reject(new Error('This image cannot be exported by your browser. Try another product image.')); };
    image.src = src;
  });
}
function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, line: number, maxLines: number) {
  const words = text.split(/\s+/); const rows: string[] = []; let row = '';
  for (const word of words) {
    if (ctx.measureText(`${row} ${word}`).width > width && row) { rows.push(row); row = word; } else row = `${row} ${word}`.trim();
  }
  if (row) rows.push(row);
  rows.slice(0,maxLines).forEach((value, index) => {
    let fitted = value;
    if (index === maxLines - 1 && rows.length > maxLines) fitted += '…';
    while (ctx.measureText(fitted).width > width && fitted.length > 1) fitted = fitted.slice(0,-2) + '…';
    ctx.fillText(fitted, x, y + index * line);
  });
}
export function drawPromo(canvas: HTMLCanvasElement, product: PromotionProduct, image: HTMLImageElement, qr: HTMLImageElement, format: typeof PROMO_FORMATS[number], frame = 0) {
  canvas.width = format.width; canvas.height = format.height;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Image export is unavailable.');
  const w = canvas.width, h = canvas.height, scale = w / 1080;
  ctx.scale(scale,scale); const height = h / scale;
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,1080,height);
  ctx.fillStyle = '#101820'; ctx.fillRect(0,0,1080,100);
  ctx.fillStyle = '#ffcb05'; ctx.font = 'bold 44px Arial'; ctx.fillText('Beezio.co',48,66);
  const boxHeight = height - 590;
  const ratio = Math.min(940/image.width, boxHeight/image.height) * (1 - .025 * Math.sin(frame * Math.PI * 2));
  const iw = image.width * ratio, ih = image.height * ratio;
  ctx.drawImage(image,(1080-iw)/2,120+(boxHeight-ih)/2,iw,ih);
  const bottom = height - 440;
  ctx.fillStyle = '#101820'; ctx.font = 'bold 42px Arial';
  wrap(ctx,product.title,48,bottom,720,50,3);
  ctx.font = 'bold 48px Arial'; ctx.fillText(promotionPriceLabel(product),48,bottom+195);
  ctx.font = '24px Arial'; ctx.fillText(shippingLabel(product),48,bottom+239);
  ctx.drawImage(qr,810,bottom+10,220,220);
  ctx.font = '22px Arial'; ctx.fillText('Scan to shop',850,bottom+260);
  ctx.fillStyle = '#ffcb05'; ctx.fillRect(48,bottom+285,984,62);
  ctx.fillStyle = '#101820'; ctx.font = 'bold 27px Arial'; ctx.fillText(frame > .55 ? 'Find your next favorite · Shop Beezio.co' : 'See the product · Scan the code or use my link',75,bottom+325);
  ctx.font = '20px Arial'; ctx.fillText('I may earn a commission from purchases. See link for delivery coverage.',48,height-51);
  ctx.fillText('Price and availability may change. Choose options on the product page.',48,height-22);
}
export function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve,reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not export image.')), 'image/png'));
}
export function savePromoFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url),60000);
}
export function recordPromo(canvas: HTMLCanvasElement, draw: (progress: number) => void): Promise<Blob> {
  if (!canvas.captureStream || typeof MediaRecorder === 'undefined') throw new Error('Video export is unavailable in this browser. Download a Story image or use a supported browser.');
  const mime = ['video/mp4','video/webm;codecs=vp9','video/webm'].find(t => MediaRecorder.isTypeSupported(t));
  if (!mime) throw new Error('This browser cannot export video. Download a Story image instead.');
  draw(0); const stream = canvas.captureStream(24); const recorder = new MediaRecorder(stream,{mimeType:mime});
  return new Promise((resolve,reject) => {
    const chunks: Blob[] = []; let animation = 0; let timeout = 0;
    const clean = () => { cancelAnimationFrame(animation); clearTimeout(timeout); stream.getTracks().forEach(t => t.stop()); };
    recorder.ondataavailable = e => { if(e.data.size) chunks.push(e.data); };
    recorder.onerror = () => { clean(); reject(new Error('Video export failed. Please try again.')); };
    recorder.onstop = () => { clean(); chunks.length ? resolve(new Blob(chunks,{type:mime})) : reject(new Error('Video export returned no frames.')); };
    recorder.start(); const start = performance.now();
    const animate = () => { const p = Math.min((performance.now()-start)/8000,1); draw(p); if(p<1) animation=requestAnimationFrame(animate); else if(recorder.state==='recording') recorder.stop(); };
    animation=requestAnimationFrame(animate);
    timeout=window.setTimeout(() => { if(recorder.state==='recording') recorder.stop(); },9000);
  });
}

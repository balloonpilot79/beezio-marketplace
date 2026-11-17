import { unzipSync } from 'fflate';
import { DIGITAL_MAX_BYTES, DIGITAL_MAX_EXPANDED_BYTES } from '../../../shared/digitalPolicy';
const formats: Record<string, string> = {pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',txt:'text/plain',csv:'text/csv',zip:'application/zip',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'};
export function digitalFileContentType(filename: string): string {
  if (!filename || /[\x00-\x1f\x7f/\\\u202a-\u202e\u2066-\u2069]/.test(filename) || filename.length > 180) throw new Error('Use a plain filename up to 180 characters.');
  const mime = formats[filename.split('.').pop()?.toLowerCase() || ''];
  if (!mime) throw new Error('Unsupported file format.');
  return mime;
}
export function validateDigitalFile(filename: string, bytes: Buffer, member = false): string {
  if (!filename || /[\x00-\x1f\x7f/\\]/.test(filename) || filename.length > 180) throw new Error('Use a plain filename up to 180 characters.');
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const mime = digitalFileContentType(filename);
  if (!mime || !bytes.length || bytes.length > DIGITAL_MAX_BYTES) throw new Error('Unsupported or oversized file. Maximum upload is 50 MB.');
  const text = bytes.toString('latin1');
  if (ext === 'pdf' && (!text.startsWith('%PDF-') || !text.includes('%%EOF') || /\/(?:JavaScript|JS|Launch|EmbeddedFile|OpenAction|AA|RichMedia|Encrypt)\b/i.test(text))) throw new Error('PDF must be readable and contain no scripts, attachments, automatic actions, or encryption.');
  if (ext === 'png' && bytes.subarray(0,8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Invalid PNG file.');
  if (['jpg','jpeg'].includes(ext) && bytes.subarray(0,3).toString('hex') !== 'ffd8ff') throw new Error('Invalid JPEG file.');
  if (['txt','csv'].includes(ext)) {
    try { new TextDecoder('utf-8',{fatal:true}).decode(bytes); } catch { throw new Error('Text files must use UTF-8.'); }
    if (bytes.includes(0) || /<\s*(script|iframe|html)|powershell|javascript:/i.test(text)) throw new Error('Active content is not allowed.');
    if (ext === 'csv' && /(?:^|[\r\n,;])\s*"?[=+@]/m.test(text)) throw new Error('CSV formulas are not allowed.');
  }
  if (['zip','docx','xlsx','pptx'].includes(ext)) {
    if (member) throw new Error('Nested archives are not allowed.');
    let total = 0, count = 0;
    const files = unzipSync(bytes, { filter: entry => {
      if (++count > 150 || (total += entry.originalSize) > DIGITAL_MAX_EXPANDED_BYTES) throw new Error('Archive exceeds 150 entries or 150 MB expanded.');
      if (entry.name.startsWith('/') || entry.name.includes('..') || entry.name.includes('\\') || /[\x00-\x1f]/.test(entry.name)) throw new Error('Unsafe archive path.');
      return !entry.name.endsWith('/');
    }});
    if (!Object.keys(files).length) throw new Error('Archive is empty.');
    for (const [path,data] of Object.entries(files)) {
      const leaf = path.split('/').pop()!;
      const innerExt = leaf.split('.').pop()?.toLowerCase();
      if (ext !== 'zip' && ['xml','rels'].includes(innerExt || '')) {
        if (/vbaProject|TargetMode\s*=\s*["']External|<script|<oleObject|DDEAUTO/i.test(Buffer.from(data).toString('utf8'))) throw new Error('Office macros, embedded objects, and external links are not allowed.');
      } else validateDigitalFile(leaf, Buffer.from(data), true);
    }
    if (ext !== 'zip' && !files['[Content_Types].xml']) throw new Error('Invalid Office document.');
  }
  return mime;
}

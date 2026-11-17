import {describe,it,expect} from 'vitest';
import {zipSync,strToU8} from 'fflate';
import {validateDigitalFile} from '../netlify/functions/_lib/digital-file-validation';
describe('digital upload inspection',()=>{
 it.each(['exe','js','html','svg','bat','ps1','xlsm'])('blocks executable or active .%s files',ext=>expect(()=>validateDigitalFile('bad.'+ext,Buffer.from('payload'))).toThrow());
 it('accepts UTF-8 templates and verifies claimed PDF/image formats',()=>{expect(validateDigitalFile('guide.txt',Buffer.from('Hello'))).toBe('text/plain');expect(()=>validateDigitalFile('fake.pdf',Buffer.from('MZ binary'))).toThrow();expect(()=>validateDigitalFile('fake.png',Buffer.from('MZ binary'))).toThrow();});
 it('rejects encrypted and scripted PDF',()=>{expect(()=>validateDigitalFile('bad.pdf',Buffer.from('%PDF-1.4 /JavaScript (alert()) %%EOF'))).toThrow();expect(()=>validateDigitalFile('bad.pdf',Buffer.from('%PDF-1.4 /Encrypt 3 0 R %%EOF'))).toThrow();});
 it('blocks formula injection in CSV',()=>expect(()=>validateDigitalFile('bad.csv',Buffer.from('name,value\nhello,=IMPORTXML()'))).toThrow());
 it('rejects oversized files and unsafe filenames',()=>{expect(()=>validateDigitalFile('large.txt',Buffer.alloc(3145729,65))).toThrow();expect(()=>validateDigitalFile('../secret.txt',Buffer.from('x'))).toThrow();});
 it('accepts a bundle of safe documents',()=>expect(validateDigitalFile('bundle.zip',Buffer.from(zipSync({'folder/readme.txt':strToU8('hello')})))).toBe('application/zip'));
 it('blocks nested archives and executable members',()=>{for(const name of ['run.exe','nested.zip']) expect(()=>validateDigitalFile('bundle.zip',Buffer.from(zipSync({[name]:strToU8('bad')})))).toThrow();});
 it('blocks archive traversal and decompression bombs',()=>{expect(()=>validateDigitalFile('bundle.zip',Buffer.from(zipSync({'../secret.txt':strToU8('bad')})))).toThrow();expect(()=>validateDigitalFile('bomb.zip',Buffer.from(zipSync({'huge.txt':new Uint8Array(31*1024*1024)})))).toThrow(/30 MB/);});
 it('checks Office structure and rejects external links',()=>{expect(()=>validateDigitalFile('bad.docx',Buffer.from(zipSync({'word/document.xml':strToU8('<test/>')})))).toThrow(/Invalid Office/);expect(()=>validateDigitalFile('bad.xlsx',Buffer.from(zipSync({'[Content_Types].xml':strToU8('<test/>'),'_rels/test.rels':strToU8('<Relationship TargetMode="External"/>')})))).toThrow();});
});

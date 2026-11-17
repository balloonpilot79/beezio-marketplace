import { supabaseAnonKey } from '../lib/supabase';
import { Upload } from 'tus-js-client';
import { DIGITAL_MAX_BYTES } from '../../shared/digitalPolicy';
export async function uploadPrivateDigitalFile(file:File,token:string,onProgress:(message:string)=>void){
 if(!file.size||file.size>DIGITAL_MAX_BYTES)throw new Error('Choose a digital file up to 50 MB.');
 const headers={'Content-Type':'application/json',Authorization:`Bearer ${token}`};
 const sessionResponse=await fetch('/.netlify/functions/digital-upload-session',{method:'POST',headers,body:JSON.stringify({filename:file.name,fileSize:file.size})});
 const session=await sessionResponse.json().catch(()=>({}));
 if(!sessionResponse.ok)throw new Error(session.error||'Could not prepare private upload.');
 onProgress('Uploading 0%');
 await new Promise<void>((resolve,reject)=>{
  const upload=new Upload(file,{
   endpoint:session.endpoint,
   headers:{apikey:supabaseAnonKey,'x-signature':session.token,'x-upsert':'false'},
   retryDelays:[0,1000,3000,5000,10000],
   chunkSize:6*1024*1024,
   uploadDataDuringCreation:true,
   removeFingerprintOnSuccess:true,
   storeFingerprintForResuming:false,
   metadata:{bucketName:session.bucket,objectName:session.path,contentType:session.contentType,cacheControl:'0'},
   onProgress:(sent,total)=>onProgress(`Uploading ${Math.min(100,Math.round(sent/total*100))}%`),
   onError:()=>reject(new Error('Upload was interrupted after retries. Please try again; your product has not changed.')),
   onSuccess:()=>resolve(),
  });
  upload.start();
 });
 onProgress('Checking your private file…');
 const start=await fetch('/.netlify/functions/digital-upload-validate-background',{method:'POST',headers,body:JSON.stringify({uploadId:session.uploadId})});
 if(!start.ok)throw new Error('File uploaded but validation could not start. Please retry.');
 const started=Date.now();
 while(Date.now()-started<5*60*1000){
  const response=await fetch(`/.netlify/functions/digital-upload-session?id=${encodeURIComponent(session.uploadId)}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(result.error||'Could not check private file status.');
  if(result.status==='approved'){onProgress('Private file validated');return result;}
  if(result.status==='rejected')throw new Error(result.error||'The file did not pass validation.');
  await new Promise(resolve=>window.setTimeout(resolve,1500));
 }
 throw new Error('File validation is taking longer than expected. Contact support before uploading it again.');
}

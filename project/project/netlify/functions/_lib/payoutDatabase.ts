/** Supabase returns errors as values. Financial workers must never silently ignore them. */
export function failClosedPayoutDatabase(client:any):any {
 const wrap=(target:any):any=>new Proxy(target,{get(obj,key){
  if(key==='then')return(resolve:any,reject:any)=>Promise.resolve(obj).then((result:any)=>{if(result?.error)throw new Error(result.error.message);return result;}).then(resolve,reject);
  const value=Reflect.get(obj,key,obj);
  return typeof value==='function'?(...args:any[])=>{const result=value.apply(obj,args);return result&&typeof result==='object'?wrap(result):result;}:value;
 }});
 return new Proxy(client,{get(obj,key){if(key==='from'||key==='rpc')return(...args:any[])=>wrap(obj[key](...args));return Reflect.get(obj,key,obj);}});
}

'use client';
let refresh:Promise<void>|null=null;
let checkedAt=0;
export class StaffSignInRequired extends Error {}
export function resetStaffSession(){checkedAt=0;}
export async function renewStaffSession(){
 if(Date.now()-checkedAt<60000)return;
 if(!refresh){refresh=(async()=>{const response=await fetch('/api/staff/session',{method:'PATCH'});const data=await response.json();if(!response.ok){if(response.status===401)throw new StaffSignInRequired(data.error);throw new Error(data.error||'Could not renew sign-in');}checkedAt=Date.now();})().finally(()=>{refresh=null;});}
 return refresh;
}
export async function staffApi(url:string,data?:unknown){
 if(url!=='/api/staff/session')await renewStaffSession();
 const response=await fetch(url,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{cache:'no-store'});
 const body=await response.json();if(!response.ok)throw new Error(body.error||'Could not complete this action');return body;
}

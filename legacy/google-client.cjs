const fs=require('node:fs'),crypto=require('node:crypto');
const SHEET='1EHWnlwE0qt1izK7vtaXE1-H9lU34RZpevVUGAH15P7A';
class GoogleAuth{
 constructor(options){this.keyFile=options.keyFile;this.cached=null;}
 async token(){
  if(this.cached?.until>Date.now()+60000)return this.cached.value;
  const account=JSON.parse(fs.readFileSync(this.keyFile,'utf8'));
  if(account.type!=='service_account'||!account.client_email?.endsWith('.gserviceaccount.com'))throw Error('구글 서비스 계정 설정을 확인하세요.');
  const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url'),now=Math.floor(Date.now()/1000);
  const unsigned=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:account.client_email,scope:'https://www.googleapis.com/auth/spreadsheets',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
  const signature=crypto.sign('RSA-SHA256',Buffer.from(unsigned),account.private_key).toString('base64url');
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:unsigned+'.'+signature}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('구글 인증 실패 · HTTP '+response.status);
  const data=await response.json();if(!data.access_token)throw Error('구글 인증 응답을 확인하세요.');
  this.cached={value:data.access_token,until:Date.now()+Math.min(data.expires_in||3600,3600)*1000};return this.cached.value;
 }
}
function sheets({auth}){
 const validate=id=>{if(id!==SHEET)throw Error('승인된 기존 정보 시트만 동기화할 수 있습니다.');};
 const request=async(url,method,body)=>{const token=await auth.token();const result=await fetch(url,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});if(!result.ok)throw Error('구글 시트 동기화 실패 · HTTP '+result.status);return {};};
 return {spreadsheets:{values:{
  clear:async({spreadsheetId,range})=>{validate(spreadsheetId);if(range!=='정보!A:J')throw Error('승인된 정보 탭만 동기화할 수 있습니다.');return {};},
  update:async({spreadsheetId,range,requestBody})=>{
   validate(spreadsheetId);if(range!=='정보!A1')throw Error('승인된 정보 탭만 동기화할 수 있습니다.');
   const values=requestBody.values;if(!Array.isArray(values)||values.some(row=>!Array.isArray(row)||row.length!==10))throw Error('동기화 데이터 형식을 확인하세요.');
   const base='https://sheets.googleapis.com/v4/spreadsheets/'+SHEET+'/values/';
   await request(base+encodeURIComponent(range)+'?valueInputOption=RAW','PUT',{range,majorDimension:'ROWS',values});
   await request(base+encodeURIComponent('정보!A'+(values.length+1)+':J')+':clear','POST',{});return {};
  }
 }}};
}
module.exports={google:{auth:{GoogleAuth},sheets}};

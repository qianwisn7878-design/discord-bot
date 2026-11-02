import fs from 'node:fs';
export const COMMUNITY_LAYOUT_GUILD='1554439098490429442';
const FILE=new URL('./legacy/data/community-layout.json',import.meta.url);
const GROUPS=[
 {key:'chat',name:'💬 │ 같이 놀아요',source:'채팅',channels:[['💬ㆍ자유수다',0],['🎮ㆍ같이-게임할-분',0],['📸ㆍ사진·일상',0]]},
 {key:'lounge',name:'🔊 │ 커뮤니티 라운지',source:'통화방',channels:[['🚪 로비',2],['💬 수다방 1',2],['💬 수다방 2',2],['🎵 음악감상',2]]},
 {key:'party',name:'🎮 │ 게임 파티',source:'통화방',channels:[['🎯 발로란트 1',2],['🎯 발로란트 2',2],['🕹️ 종합게임',2]]},
 {key:'rest',name:'🌙 │ 잠시 쉬는 중',source:'통화방',channels:[['💤 잠수방',2]]},
];
const normalize=name=>String(name).normalize('NFKC').replace(/[^\p{L}\p{N}]/gu,'');
function readState(){try{return JSON.parse(fs.readFileSync(FILE,'utf8'));}catch(e){if(e.code==='ENOENT')return {};throw e;}}
function writeState(state){fs.mkdirSync(new URL('./legacy/data/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('./legacy/data/community-layout.json.tmp',import.meta.url),JSON.stringify(state),{mode:0o600});fs.renameSync(new URL('./legacy/data/community-layout.json.tmp',import.meta.url),FILE);}
export async function ensureCommunityLayout(rest,botId,{read=readState,write=writeState}={}){
 const state=read();if(state.complete)return {skipped:true};state.created??={};
 const channels=await rest.get('/guilds/'+COMMUNITY_LAYOUT_GUILD+'/channels');
 for(const group of GROUPS){
  let category=channels.find(c=>c.id===state.created[group.key]||c.type===4&&normalize(c.name)===normalize(group.name));
  if(!category){
   // Copy existing community access and quarantine denies without editing their channels.
   const template=channels.find(c=>c.type===4&&normalize(c.name)===normalize(group.source));
   const overwrites=template?.permission_overwrites||[{id:COMMUNITY_LAYOUT_GUILD,type:0,allow:'0',deny:'1024'},{id:'1566010351177175040',type:0,allow:String(1024n|2048n|65536n|1048576n|2097152n),deny:'0'},{id:botId,type:1,allow:String(1024n|2048n|16n|268435456n),deny:'0'}];
   category=await rest.post('/guilds/'+COMMUNITY_LAYOUT_GUILD+'/channels',{body:{name:group.name,type:4,permission_overwrites:overwrites}});channels.push(category);
  }
  state.created[group.key]=category.id;write(state);
  for(const [name,type] of group.channels){
   const key=group.key+':'+normalize(name);
   if(state.created[key])continue;
   let channel=channels.find(c=>c.type===type&&normalize(c.name)===normalize(name));
   if(!channel){channel=await rest.post('/guilds/'+COMMUNITY_LAYOUT_GUILD+'/channels',{body:{name,type,parent_id:category.id,...(type===0?{topic:'ETG 커뮤니티 공간 · 이름과 설명은 운영진이 자유롭게 변경할 수 있어요.'}:{bitrate:64000,user_limit:0})}});channels.push(channel);}
   state.created[key]=channel.id;write(state);
  }
 }
 state.complete=true;write(state);return {created:state.created};
}

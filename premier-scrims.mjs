import {randomUUID} from 'node:crypto';
const scrimDrafts=new Map();
export const TEAM_SCRIM_CATEGORY='1523985107881300038';
const GUILDS=new Set(['1554439098490429442','1492461447568162876','1554439352652922891']);
const SITE='https://enjoythegame.craftyamber8.chatgpt.site/home#premier';
const labels={open:'모집 중',confirmed:'대진 확정',completed:'종료',cancelled:'취소',expired:'모집 마감'};
export const teamScrimCommand={name:'스크림',description:'프리미어 팀 스크림을 모집하거나 상대 팀에 참여합니다.',type:1};
const row=components=>({type:1,components});
const btn=(label,id,style=2)=>({type:2,label,custom_id:'etgp:'+id,style});
const link={type:2,label:'홈페이지에서 보기',style:5,url:SITE};
const safe=s=>String(s).replace(/([\\*_~`>|])/g,'\\$1');
const embed=(title,description)=>({title,description,color:0xc5f277});
const when=item=>'<t:'+Math.floor(Date.parse(item.startsAt)/1000)+':F>';
export function isTeamScrimInteraction(i){return i.isChatInputCommand()&&i.commandName==='스크림'||(i.isButton()||i.isStringSelectMenu()||i.isModalSubmit())&&i.customId.startsWith('etgp:');}
export function parseScrimKoreanDate(value,now=Date.now()){
 const match=/^(\d{2})월\s+(\d{2})일\s+(\d{2}):(\d{2})$/.exec(value);
 if(!match)throw Error('일정은 한국 시간 01월 01일 00:20 형식으로 입력하세요.');
 const [,month,day,hour,minute]=match,year=new Date(now+9*3600000).getUTCFullYear();
 for(let offset=0;offset<9;offset++){
  const normalized=(year+offset)+'-'+month+'-'+day+'T'+hour+':'+minute,date=new Date(normalized+':00+09:00');
  if(Number.isFinite(date.getTime())&&new Date(date.getTime()+9*3600000).toISOString().slice(0,16)===normalized&&date.getTime()>now)return date.toISOString();
 }
 throw Error('실제로 존재하는 날짜와 시간을 입력하세요.');
}
export async function handleTeamScrimInteraction(i,bridge,ephemeralFlag){
 if(i.guildId!=='1492461447568162876')throw Error('스크림은 ETG 프리미어 팀 서버 안에서만 신청할 수 있습니다.');
 const request=data=>bridge('/api/discord-bot/action',{guildId:i.guildId,userId:i.user.id,name:i.member?.displayName||i.user.globalName||i.user.username,interactionId:i.id,path:'/api/premier/scrims',method:data?'POST':'GET',...(data?{data}:{})});
 const select=(id,label,options,value)=>row([{type:3,custom_id:id,placeholder:label,options:options.map(([v,name])=>({label:name,value:String(v),default:String(v)===String(value)}))}]);
 const settings=d=>({content:'스크림 설정 · '+({fixed:'맵 지정 모집',later:'맵 미지정 모집',veto:'밴픽으로 결정'}[d.mapMode]),components:[select('etgp:draft-option:'+d.id+':region','서버',[['KR','KR 서버'],['AP','AP 서버']],d.region),select('etgp:draft-option:'+d.id+':rounds','라운드',[[13,'13R'],[24,'24R']],d.rounds),select('etgp:draft-option:'+d.id+':count',d.mapMode==='veto'?'BO 선택':'판수',d.mapMode==='veto'?[[1,'BO1 · 단판'],[3,'BO3 · 3전 2선승']]:Array.from({length:13},(_,n)=>[n+1,(n+1)+'판']),d.count),row([btn('다음','draft-next:'+d.id)])]});
 const mapMenu=d=>({content:(d.index+1)+'경기 맵을 선택하세요. · '+d.count+'판',components:[select('etgp:draft-map:'+d.id,'맵 선택',d.allMaps.map(name=>[name,name]),d.maps[d.index])]});
 const getDraft=id=>{const d=scrimDrafts.get(id);if(!d||d.userId!==i.user.id||d.until<Date.now())throw Error('선택 시간이 만료됐습니다. 상대 구하기부터 다시 시작하세요.');return d;};
 const parts=(i.customId||'etgp:list:0').split(':'),action=parts[1];
 if(action==='create'){
  await i.reply({flags:ephemeralFlag,content:'맵 결정 방식을 선택하세요.',components:[row([btn('맵 지정 모집','create-mode:fixed'),btn('모집 후 맵 선택','create-mode:later'),btn('밴픽으로 결정','create-mode:veto')])]});return;
 }
 if(action==='create-mode'){
  const mode=parts[2];if(!['fixed','later','veto'].includes(mode))throw Error('맵 결정 방식을 확인하세요.');
  await i.deferReply({flags:ephemeralFlag});const data=await request();
  for(const [id,d] of scrimDrafts)if(d.until<Date.now())scrimDrafts.delete(id);
  const d={id:randomUUID(),userId:i.user.id,mapMode:mode,region:'KR',rounds:13,count:1,maps:[],index:0,allMaps:data.mapPool||[],until:Date.now()+1800000};scrimDrafts.set(d.id,d);
  await i.editReply(settings(d));return;
 }
 if(action==='draft-modal'){
  const d=getDraft(parts[2]);await i.showModal({custom_id:'etgp:submit-draft:'+d.id,title:'우리 팀 스크림 상대 구하기',components:[['startsAt','경기 일정 · 한국 시간 (연도 자동)',1,true,20],['note','모집 내용',2,false,1000]].map(([id,label,style,required,max_length])=>row([{type:4,custom_id:id,label,style,required,max_length,...(id==='startsAt'?{placeholder:'01월 01일 00:20'}:{})}]))});return;
 }
 await i.deferReply({flags:ephemeralFlag});
 const reply=body=>i.editReply({content:'',embeds:[],components:[],allowedMentions:{parse:[]},...body});
 if(action==='draft-option'||action==='draft-next'||action==='draft-map'){
  const d=getDraft(parts[2]);
  if(action==='draft-option'){const field=parts[3],value=i.values[0];if(field==='region'&&['KR','AP'].includes(value))d.region=value;else if(field==='rounds'&&['13','24'].includes(value))d.rounds=Number(value);else if(field==='count'&&Number.isSafeInteger(Number(value))&&Number(value)>=1&&Number(value)<=13&&(d.mapMode!=='veto'||['1','3'].includes(value))){d.count=Number(value);d.maps=[];d.index=0;}else throw Error('선택 값을 확인하세요.');await reply(settings(d));return;}
  if(action==='draft-map'){if(!d.allMaps.includes(i.values[0]))throw Error('맵을 확인하세요.');d.maps[d.index]=i.values[0];d.index++;}
  if(d.mapMode==='fixed'&&d.maps.length<d.count){await reply(mapMenu(d));return;}
  await reply({content:d.region+' · '+d.rounds+'R · '+(d.mapMode==='veto'?'BO'+d.count:d.count+'판')+'\n'+d.maps.map((name,n)=>(n+1)+'경기 '+name).join(' / '),components:[row([btn('일정·모집 내용 입력','draft-modal:'+d.id)])]});return;
 }
 if(action==='submit-draft'){
  const d=getDraft(parts[2]);if(d.mapMode==='fixed'&&d.maps.length!==d.count)throw Error('경기별 맵을 먼저 선택하세요.');
  const data=await request({action:'create',region:d.region,rounds:d.rounds,matchCount:d.count,bestOf:d.mapMode==='veto'?d.count:1,mapMode:d.mapMode,maps:d.maps,startsAt:parseScrimKoreanDate(i.fields.getTextInputValue('startsAt').trim()),note:i.fields.getTextInputValue('note')});scrimDrafts.delete(d.id);
  await reply({content:'모집 등록 완료 · '+data.myTeam.name,components:[row([btn('모집 목록','list:0'),link])]});return;
 }
 if(action==='map-start'||action==='map-choose'){
  const data=await request(),item=data.items.find(item=>item.id===parts[2]);if(!item||item.mapMode!=='later'||item.mapChosen||item.status!=='confirmed'||![item.hostTeam.id,item.guestTeam?.id].includes(data.myTeam?.id))throw Error('참여 팀의 미지정 스크림을 선택하세요.');
  let d;if(action==='map-start'){d={id:randomUUID(),userId:i.user.id,until:Date.now()+1800000,itemId:item.id,revision:item.revision,count:item.matchCount||1,index:0,maps:[],allMaps:data.mapPool||[]};scrimDrafts.set(d.id,d);}else{d=getDraft(parts[3]);if(d.itemId!==item.id||d.revision!==item.revision)throw Error('모집 상태가 변경됐습니다. 다시 선택하세요.');if(!d.allMaps.includes(i.values[0]))throw Error('맵을 확인하세요.');d.maps[d.index++]=i.values[0];}
  if(d.maps.length===d.count){await request({action:'choose-map',id:item.id,revision:d.revision,maps:d.maps});scrimDrafts.delete(d.id);await reply({content:'경기별 맵을 확정했습니다.',components:[row([btn('상세 보기','view:'+item.id)])]});return;}
  await reply({content:(d.index+1)+'경기 맵을 선택하세요.',components:[select('etgp:map-choose:'+item.id+':'+d.id,'맵 선택',d.allMaps.map(name=>[name,name]))]});return;
 }
 if(action==='submit'){
  const data=await request({action:'create',startsAt:parseScrimKoreanDate(i.fields.getTextInputValue('startsAt').trim()),mapMode:parts[2]||'fixed',bestOf:Number(parts[3]||1),map:parts[2]&&parts[2]!=='fixed'?'':i.fields.getTextInputValue('map'),note:i.fields.getTextInputValue('note')});
  await reply({embeds:[embed('모집 등록 완료',safe(data.myTeam.name)+' 팀의 모집을 홈페이지와 디스코드에 등록했습니다.')],components:[row([btn('모집 목록','list:0'),link])]});return;
 }
 if(action==='execute'){
  if(!['join','withdraw','cancel','finish'].includes(parts[2]))throw Error('작업을 확인하세요.');
  await request({action:parts[2],id:parts[3],revision:Number(parts[4])});
  await reply({embeds:[embed('처리 완료',{join:'우리 팀의 스크림 대진이 확정되었습니다.',withdraw:'참여를 취소했습니다. 상대 팀은 다시 모집 중입니다.',cancel:'스크림 모집·대진을 취소했습니다.',finish:'스크림을 종료 처리했습니다.'}[parts[2]])],components:[row([btn('최신 목록','list:0'),link])]});return;
 }
 const data=await request(),mine=data.myTeam?.id;
 if(action==='confirm'){
  const item=data.items.find(item=>item.id===parts[3]);
  if(!item||item.revision!==Number(parts[4]))throw Error('모집 내용이 변경됐습니다. 최신 목록에서 다시 선택하세요.');
  const title={join:'우리 팀으로 참여',withdraw:'참여 취소',cancel:'모집 취소',finish:'경기 종료'}[parts[2]];
  if(!title)throw Error('작업을 확인하세요.');
  await reply({embeds:[embed(title+' 확인',safe(item.hostTeam.name)+' vs '+safe(item.guestTeam?.name||'상대 모집 중')+'\n'+when(item)+'\n\n'+title+' 처리를 진행할까요?'+(data.myTeam?'\n내 팀: '+safe(data.myTeam.name):''))],components:[row([btn('확정','execute:'+parts.slice(2).join(':'),parts[2]==='join'?1:4),btn('돌아가기','view:'+item.id)])]});return;
 }
 if(action==='view'||action==='pick'){
  const item=data.items.find(item=>item.id===(action==='pick'?i.values[0]:parts[2]));if(!item)throw Error('모집 글을 찾을 수 없습니다. 최신 목록을 열어 주세요.');
  const host=mine===item.hostTeam.id,guest=!!mine&&mine===item.guestTeam?.id,future=Date.parse(item.startsAt)>Date.now(),buttons=[];
  const add=(label,op)=>buttons.push(btn(label,'confirm:'+op+':'+item.id+':'+item.revision));
  if(item.status==='open'&&mine&&!host&&future)add('우리 팀으로 참여','join');
  if(item.status==='confirmed'&&guest&&future)add('참여 취소','withdraw');
  if(['open','confirmed','expired'].includes(item.status)&&(host||data.canModerate))add('모집 취소','cancel');
  if(item.status==='confirmed'&&!future&&(host||guest||data.canModerate))add('경기 종료','finish');
  if(item.status==='confirmed'&&(host||guest)&&item.mapMode==='later'&&!item.mapChosen)buttons.push(btn('경기별 맵 선택','map-start:'+item.id));
  if(item.status==='confirmed'&&(host||guest)&&item.mapMode==='veto')buttons.push({type:2,style:5,label:'맵 선택·밴픽 진행',url:SITE});
  buttons.push(btn('최신 목록','list:0'),link);
  await reply({embeds:[embed((item.hostTeam.name+' vs '+(item.guestTeam?.name||'상대 모집 중')).slice(0,256),'**'+labels[item.status]+'** · '+when(item)+'\n'+(item.region||'KR')+' · '+(item.rounds||13)+'R · '+(item.mapMode==='veto'?'BO'+(item.bestOf||1):(item.matchCount||1)+'판')+'\n맵: '+safe(item.map)+'\n\n'+safe(item.note||'추가 내용 없음'))],components:Array.from({length:Math.ceil(buttons.length/5)},(_,n)=>row(buttons.slice(n*5,n*5+5)))});return;
 }
 const mode=parts[3]==='mine'?'mine':'active',items=data.items.filter(item=>mode==='mine'?[item.hostTeam.id,item.guestTeam?.id].includes(mine):['open','confirmed'].includes(item.status)),offset=Math.max(0,Number(parts[2])||0),shown=items.slice(offset,offset+25),components=[];
 if(shown.length)components.push(row([{type:3,custom_id:'etgp:pick',placeholder:'모집 글을 선택하세요',options:shown.map(item=>({label:(item.hostTeam.name+' vs '+(item.guestTeam?.name||'상대 모집 중')).slice(0,100),value:item.id,description:(labels[item.status]+' · '+new Date(item.startsAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+' · '+item.map).slice(0,100)}))}]));
 const buttons=[btn('새로고침','list:0:'+mode),btn(mode==='mine'?'전체 모집':'우리 팀',mode==='mine'?'list:0':'list:0:mine')];if(mine)buttons.push(btn('+ 상대 구하기','create',1));
 components.push(row(buttons));
 if(offset||offset+25<items.length)components.push(row([...(offset?[btn('이전','list:'+Math.max(0,offset-25)+':'+mode)]:[]),...(offset+25<items.length?[btn('다음','list:'+(offset+25)+':'+mode)]:[])]));
 await reply({embeds:[embed('ETG 프리미어 팀 스크림',(data.myTeam?'내 팀: '+safe(data.myTeam.name):'소속 프리미어 팀이 있어야 모집·참여할 수 있습니다.')+'\n'+(shown.length?'모집 글을 선택하면 일정·내용과 참여 버튼을 볼 수 있습니다.':'표시할 스크림이 없습니다.')+'\n'+items.length+'건 · 홈페이지와 같은 상태를 사용합니다.')],components});
}

// Two shared panels are updated in place. Detail and confirmation menus are private.
let panels=null,syncing=false;
export async function syncTeamScrimPanels(client,data){
 if(!data||syncing)return;syncing=true;
 try{
  if(!panels){
   const category=await client.rest.get('/channels/'+TEAM_SCRIM_CATEGORY);
   if(category.type!==4||!GUILDS.has(category.guild_id))throw Error('지정한 스크림 카테고리가 ETG 서버의 카테고리인지 확인하세요.');
   const channels=await client.rest.get('/guilds/'+category.guild_id+'/channels');panels={guildId:category.guild_id};
   for(const [key,name,topic] of [['guide','스크림-안내','ETG 팀 스크림 이용 안내'],['board','스크림-모집','ETG 프리미어 팀 스크림 · 홈페이지 연동']]){
    const existing=channels.find(c=>c.parent_id===TEAM_SCRIM_CATEGORY&&c.type===0&&c.name===name);
    const channel=existing||await client.rest.post('/guilds/'+category.guild_id+'/channels',{body:{name,type:0,parent_id:TEAM_SCRIM_CATEGORY,topic}});
    const messages=await client.rest.get('/channels/'+channel.id+'/messages?limit=100'),message=messages.find(m=>m.author.id===client.user.id&&m.embeds?.some(e=>e.footer?.text==='ETG 팀 스크림 · '+key));
    panels[key]={channelId:channel.id,messageId:message?.id,hash:null};
   }
  }
  const items=data.items||[],active=items.filter(item=>['open','confirmed'].includes(item.status));
  const payloads={
   guide:{embeds:[{...embed('프리미어 팀 스크림 이용 안내','1. **상대 구하기**에서 한국 시간 일정·맵·모집 내용을 입력하세요.\n2. **모집 목록**에서 상대 팀의 글을 선택하고 **우리 팀으로 참여 → 확정**을 누르세요.\n3. 참여 취소·모집 취소·경기 종료도 같은 메뉴에서 할 수 있습니다.\n\n맵 지정 모집 / 모집 후 맵 선택 / 밴픽으로 결정 중 선택할 수 있습니다.\n\n`/스크림` 명령으로도 열 수 있습니다. 일정은 **01월 01일 00:20** 형식의 한국 시간(UTC+9)으로 입력합니다. 연도는 다가오는 날짜로 자동 적용되며 180일 이내 일정만 등록할 수 있습니다.'),footer:{text:'ETG 팀 스크림 · guide'}}],components:[row([btn('상대 구하기','create',1),btn('모집 목록','list:0'),link])]},
   board:{embeds:[{...embed('팀 스크림 모집판',active.length?active.slice(0,10).map(item=>'**'+safe(item.hostTeam.name)+' vs '+safe(item.guestTeam?.name||'상대 모집 중')+'**\n'+labels[item.status]+' · '+when(item)+' · '+safe(item.map)).join('\n\n')+'\n\n총 '+active.length+'건 · 목록에서 전체 모집을 확인하세요.':'현재 모집 중이거나 확정된 스크림이 없습니다. **상대 구하기**로 우리 팀의 모집을 시작하세요.'),footer:{text:'ETG 팀 스크림 · board'}}],components:[row([btn('모집 목록','list:0',1),btn('우리 팀 스크림','list:0:mine'),btn('+ 상대 구하기','create'),link])]}
  };
  for(const key of ['guide','board']){
   const panel=panels[key],body={...payloads[key],allowed_mentions:{parse:[]}},hash=JSON.stringify(body);if(hash===panel.hash)continue;
   if(panel.messageId){try{await client.rest.patch('/channels/'+panel.channelId+'/messages/'+panel.messageId,{body});}catch(error){if(error.status!==404)throw error;panel.messageId=null;}}
   if(!panel.messageId)panel.messageId=(await client.rest.post('/channels/'+panel.channelId+'/messages',{body})).id;
   panel.hash=hash;
  }
  return {guildId:panels.guildId,guideChannelId:panels.guide.channelId,boardChannelId:panels.board.channelId,version:'team-scrims-v1'};
 }catch(error){panels=null;throw error;}finally{syncing=false;}
}


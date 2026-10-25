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
export function parseScrimKoreanDate(value){
 if(!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}$/.test(value))throw Error('일정은 한국 시간 YYYY-MM-DD HH:mm 형식으로 입력하세요.');
 const normalized=value.replace(' ','T'),date=new Date(normalized+':00+09:00');
 if(!Number.isFinite(date.getTime())||new Date(date.getTime()+9*3600000).toISOString().slice(0,16)!==normalized)throw Error('실제로 존재하는 날짜와 시간을 입력하세요.');
 return date.toISOString();
}
export async function handleTeamScrimInteraction(i,bridge,ephemeralFlag){
 const request=data=>bridge('/api/discord-bot/action',{guildId:i.guildId,userId:i.user.id,name:i.member?.displayName||i.user.globalName||i.user.username,interactionId:i.id,path:'/api/premier/scrims',method:data?'POST':'GET',...(data?{data}:{})});
 const parts=(i.customId||'etgp:list:0').split(':'),action=parts[1];
 if(action==='create'){
  await i.showModal({custom_id:'etgp:submit',title:'우리 팀 스크림 상대 구하기',components:[['startsAt','경기 일정 · 한국 시간 YYYY-MM-DD HH:mm',1,true,16],['map','맵 · 예: 어센트 또는 협의',1,true,80],['note','모집 내용 · 희망 수준, 경기 수, 연락 방법',2,false,1000]].map(([id,label,style,required,max_length])=>row([{type:4,custom_id:id,label,style,required,max_length}]))});return;
 }
 await i.deferReply({flags:ephemeralFlag});
 const reply=body=>i.editReply({content:'',embeds:[],components:[],allowedMentions:{parse:[]},...body});
 if(action==='submit'){
  const data=await request({action:'create',startsAt:parseScrimKoreanDate(i.fields.getTextInputValue('startsAt').trim()),map:i.fields.getTextInputValue('map'),note:i.fields.getTextInputValue('note')});
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
  buttons.push(btn('최신 목록','list:0'),link);
  await reply({embeds:[embed((item.hostTeam.name+' vs '+(item.guestTeam?.name||'상대 모집 중')).slice(0,256),'**'+labels[item.status]+'** · '+when(item)+'\n맵: '+safe(item.map)+'\n\n'+safe(item.note||'추가 내용 없음'))],components:[row(buttons)]});return;
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
   guide:{embeds:[{...embed('프리미어 팀 스크림 이용 안내','1. **상대 구하기**에서 한국 시간 일정·맵·모집 내용을 입력하세요.\n2. **모집 목록**에서 상대 팀의 글을 선택하고 **우리 팀으로 참여 → 확정**을 누르세요.\n3. 참여 취소·모집 취소·경기 종료도 같은 메뉴에서 할 수 있습니다.\n\n홈페이지 프리미어 로스터와 현재 Discord 팀 역할을 확인합니다. 소속 팀으로만 모집·참여할 수 있고, 일정 전후 2시간 이내 중복 경기는 제한됩니다.\n\n`/스크림` 명령으로도 열 수 있습니다. 일정 입력은 한국 시간(UTC+9)입니다.'),footer:{text:'ETG 팀 스크림 · guide'}}],components:[row([btn('상대 구하기','create',1),btn('모집 목록','list:0'),link])]},
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

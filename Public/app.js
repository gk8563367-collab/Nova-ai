const $ = (id) => document.getElementById(id);
const messagesEl = $("messages"), welcomeEl = $("welcome"), historyEl = $("historyList");
let chats = JSON.parse(localStorage.getItem("nova_chats") || "[]");
let activeId = null, pendingImage = null, pendingText = "", busy = false, lastUserMessage = null;
let responseStyle = localStorage.getItem("nova_style") || "balanced";
let recognition = null;

function saveChats(){ localStorage.setItem("nova_chats", JSON.stringify(chats)); }
function currentChat(){ return chats.find(c => c.id === activeId); }
function makeId(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function toast(message){ const el=$("toast"); el.textContent=message; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),2400); }
function safeMarkdown(text){
  const html = window.marked ? marked.parse(text) : text.replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])).replace(/\n/g,"<br>");
  return window.DOMPurify ? DOMPurify.sanitize(html) : html;
}
function renderHistory(){
  historyEl.innerHTML="";
  [...chats].reverse().forEach(chat=>{
    const b=document.createElement("button"); b.className="history-item"+(chat.id===activeId?" selected":"");
    b.innerHTML="<span>◷</span>"; const t=document.createElement("span"); t.textContent=chat.title; t.style.overflow="hidden";t.style.textOverflow="ellipsis";b.appendChild(t);
    b.onclick=()=>openChat(chat.id);historyEl.appendChild(b);
  });
}
function renderMessages(){
  const chat=currentChat(); messagesEl.innerHTML="";
  const has=chat && chat.messages.length;
  welcomeEl.style.display=has?"none":"block";messagesEl.style.display=has?"block":"none";
  $("topTitle").textContent=chat?.title || "New conversation";
  if(!has)return;
  chat.messages.forEach((m,index)=>addMessageNode(m,index));
  messagesEl.scrollTop=messagesEl.scrollHeight;
}
function addMessageNode(m,index){
  const row=document.createElement("div");row.className="message "+(m.role==="user"?"user":"assistant");
  const avatar=document.createElement("div");avatar.className="message-avatar";avatar.textContent=m.role==="user"?"Y":"✦";
  const body=document.createElement("div");body.className="message-body";
  const name=document.createElement("div");name.className="message-name";name.textContent=m.role==="user"?"YOU":"NOVA AI";
  const bubble=document.createElement("div");bubble.className="bubble";bubble.innerHTML=safeMarkdown(m.text||"");
  body.append(name,bubble);
  if(m.role==="user" && m.imagePreview){const img=document.createElement("img");img.src=m.imagePreview;img.className="attachment-image";bubble.appendChild(img);}
  if(m.role==="assistant"){
    const actions=document.createElement("div");actions.className="message-actions";
    const copy=document.createElement("button");copy.textContent="▢ Copy";copy.onclick=()=>{navigator.clipboard?.writeText(m.text||"");toast("Copied to clipboard");};
    const speak=document.createElement("button");speak.textContent="◖ Read aloud";speak.onclick=()=>speakText(m.text||"");
    actions.append(copy,speak);
    if(index===currentChat().messages.length-1){const regen=document.createElement("button");regen.textContent="↻ Regenerate";regen.onclick=regenerate;actions.append(regen);}
    body.appendChild(actions);
  }
  row.append(avatar,body);messagesEl.appendChild(row);
}
function openChat(id){activeId=id;renderHistory();renderMessages();closeSidebar();}
function newChat(){activeId=null;renderHistory();renderMessages();$("promptInput").focus();closeSidebar();}
function closeSidebar(){$("sidebar").classList.remove("open");}
function addTyping(){
  const row=document.createElement("div");row.className="message assistant";row.id="typingRow";
  row.innerHTML='<div class="message-avatar">✦</div><div class="message-body"><div class="message-name">NOVA AI</div><div class="typing"><i></i><i></i><i></i></div></div>';
  messagesEl.appendChild(row);messagesEl.scrollTop=messagesEl.scrollHeight;
}
function removeTyping(){$("typingRow")?.remove();}
function styleInstruction(){
  const styles={balanced:"Be helpful, clear, accurate, and friendly.",concise:"Be concise and direct. Prefer short answers.",detailed:"Give detailed, structured explanations with useful examples.",creative:"Be imaginative and engaging while remaining accurate."};
  return "You are NOVA AI, a helpful general-purpose assistant. "+styles[responseStyle]+" If you are unsure, say so. Do not claim to have performed actions you cannot perform.";
}
function startChatIfNeeded(text){
  if(!activeId){const chat={id:makeId(),title:(text||"New conversation").slice(0,34),messages:[]};chats.push(chat);activeId=chat.id;}
  const chat=currentChat();if(chat.messages.length===0)chat.title=(text||"New conversation").slice(0,34);
}
function fileToBase64(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=reject;reader.readAsDataURL(file);});}
async function sendMessage(textOverride){
  if(busy)return;
  const text=(textOverride ?? $("promptInput").value).trim();
  if(!text && !pendingImage && !pendingText)return;
  const outgoing=text+(pendingText?("\n\nAttached text file:\n"+pendingText):"");
  startChatIfNeeded(outgoing||"Image question");
  const userMessage={role:"user",text:outgoing||"Please analyse this image.",imagePreview:pendingImage?.preview||null};
  currentChat().messages.push(userMessage);lastUserMessage={text:outgoing,image:pendingImage};
  const imageForRequest=pendingImage?{mimeType:pendingImage.mimeType,data:pendingImage.data}:null;
  $("promptInput").value="";$("promptInput").style.height="auto";pendingImage=null;pendingText="";$("attachmentPreview").innerHTML="";
  busy=true;$("sendButton").disabled=true;renderHistory();renderMessages();addTyping();
  const apiMessages=currentChat().messages.slice(-20).map((m,i)=>{
    const item={role:m.role==="assistant"?"model":"user",text:m.text||""};
    if(i===currentChat().messages.slice(-20).length-1 && imageForRequest)item.images=[imageForRequest];
    return item;
  });
  try{
    const response=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:apiMessages,systemInstruction:styleInstruction()})});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||"Request failed");
    currentChat().messages.push({role:"assistant",text:data.answer});
  }catch(error){
    currentChat().messages.push({role:"assistant",text:"**I couldn't complete that request.**\n\n"+(error.message||"Please check your connection and try again.")});
  }finally{
    removeTyping();busy=false;$("sendButton").disabled=false;saveChats();renderHistory();renderMessages();$("promptInput").focus();
  }
}
async function regenerate(){
  if(busy||!lastUserMessage)return;
  const chat=currentChat();if(chat?.messages.at(-1)?.role==="assistant")chat.messages.pop();
  const user=chat.messages.at(-1);if(!user||user.role!=="user")return;
  const image=lastUserMessage.image;
  busy=true;$("sendButton").disabled=true;renderMessages();addTyping();
  const apiMessages=chat.messages.slice(-20).map((m,i)=>({role:m.role==="assistant"?"model":"user",text:m.text||"",...(i===chat.messages.slice(-20).length-1&&image?{images:[{mimeType:image.mimeType,data:image.data}]}:{})}));
  try{const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:apiMessages,systemInstruction:styleInstruction()})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Request failed");chat.messages.push({role:"assistant",text:d.answer});}
  catch(e){chat.messages.push({role:"assistant",text:"**Regeneration failed:** "+e.message});}
  finally{removeTyping();busy=false;$("sendButton").disabled=false;saveChats();renderMessages();}
}
function renderAttachment(){
  const area=$("attachmentPreview");area.innerHTML="";
  if(pendingImage){const chip=document.createElement("span");chip.className="attachment-chip";chip.textContent="Image attached";const x=document.createElement("button");x.textContent="×";x.onclick=()=>{pendingImage=null;renderAttachment();};chip.appendChild(x);area.appendChild(chip);}
  if(pendingText){const chip=document.createElement("span");chip.className="attachment-chip";chip.textContent="Text file attached";const x=document.createElement("button");x.textContent="×";x.onclick=()=>{pendingText="";renderAttachment();};chip.appendChild(x);area.appendChild(chip);}
}
$("chatForm").addEventListener("submit",e=>{e.preventDefault();sendMessage();});
$("promptInput").addEventListener("input",e=>{e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,150)+"px";});
$("promptInput").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey&&$("enterSend").checked){e.preventDefault();sendMessage();}});
$("newChat").onclick=newChat;$("homeButton").onclick=newChat;
$("clearHistory").onclick=()=>{if(confirm("Delete all conversations stored in this browser?")){chats=[];activeId=null;saveChats();renderHistory();renderMessages();}};
$("attachButton").onclick=()=>$("fileInput").click();
$("fileInput").onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try{
    if(file.type.startsWith("image/")){
      if(!["image/png","image/jpeg","image/webp","image/gif"].includes(file.type))throw new Error("Use PNG, JPG, WEBP or GIF images.");
      if(file.size>3*1024*1024)throw new Error("Please use an image smaller than 3 MB.");
      pendingImage={mimeType:file.type,data:await fileToBase64(file),preview:URL.createObjectURL(file)};
    }else{
      if(file.size>200*1024)throw new Error("Text files must be smaller than 200 KB.");
      pendingText=await file.text();
    }
    renderAttachment();
  }catch(err){toast(err.message);}
  e.target.value="";
};
$("voiceButton").onclick=()=>{
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SpeechRecognition){toast("Voice input is not supported in this browser.");return;}
  if(recognition){recognition.stop();recognition=null;return;}
  recognition=new SpeechRecognition();recognition.lang="en-IN";recognition.interimResults=false;
  recognition.onresult=e=>{$("promptInput").value+=($("promptInput").value?" ":"")+e.results[0][0].transcript;};
  recognition.onerror=()=>toast("Voice input could not start.");
  recognition.onend=()=>{recognition=null;$("voiceButton").classList.remove("recording");};
  recognition.start();$("voiceButton").classList.add("recording");toast("Listening… speak now");
};
function speakText(text){if(!("speechSynthesis"in window)){toast("Text-to-speech is not supported.");return;}speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang="en-IN";speechSynthesis.speak(utterance);}
$("searchToggle").onclick=()=>{const q=prompt("Search your saved chats:");if(!q)return;const found=chats.find(c=>c.title.toLowerCase().includes(q.toLowerCase())||c.messages.some(m=>(m.text||"").toLowerCase().includes(q.toLowerCase())));if(found)openChat(found.id);else toast("No matching chat found.");};
$("settingsButton").onclick=()=>$("settingsModal").classList.add("show");
$("closeSettings").onclick=()=>$("settingsModal").classList.remove("show");
$("settingsModal").onclick=e=>{if(e.target===$("settingsModal"))$("settingsModal").classList.remove("show");};
$("styleSelect").value=responseStyle;$("styleSelect").onchange=e=>{responseStyle=e.target.value;localStorage.setItem("nova_style",responseStyle);toast("Response style updated");};
$("enterSend").checked=localStorage.getItem("nova_enter_send")!=="false";$("enterSend").onchange=e=>localStorage.setItem("nova_enter_send",e.target.checked);
$("themeButton").onclick=()=>{document.body.classList.toggle("light");localStorage.setItem("nova_theme",document.body.classList.contains("light")?"light":"dark");};
if(localStorage.getItem("nova_theme")==="light")document.body.classList.add("light");
$("openSidebar").onclick=()=>$("sidebar").classList.add("open");$("closeSidebar").onclick=closeSidebar;
document.querySelectorAll(".suggestion").forEach(b=>b.onclick=()=>sendMessage(b.dataset.prompt));
renderHistory();renderMessages();
fetch("/api/status").then(r=>r.json()).then(d=>{if(!d.configured)toast("Add your Gemini API key in the .env file to start chatting.");}).catch(()=>{});

let kokoroPromise;

async function getKokoro() {
  if (!kokoroPromise) {
    kokoroPromise = (async () => {
      const { KokoroTTS } = await import('kokoro-js');
      return KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
        dtype: 'q8', device: 'wasm'
      });
    })().catch((error) => { kokoroPromise = null; throw error; });
  }
  return kokoroPromise;
}
function splitText(text, limit=1000) {
  const parts=[]; let rest=text;
  while (rest.length>limit) {
    let cut=rest.lastIndexOf(' ',limit);
    const sentence=Math.max(rest.lastIndexOf('. ',limit),rest.lastIndexOf('! ',limit),rest.lastIndexOf('? ',limit),rest.lastIndexOf('\n',limit));
    if(sentence>limit*.55) cut=sentence+1;
    if(cut<limit*.5) cut=limit;
    parts.push(rest.slice(0,cut)); rest=rest.slice(cut);
  }
  if(rest) parts.push(rest); return parts;
}
function cleanCues(text) {
  return text.replace(/\[(?:silence|pause):\s*\d+(?:\.\d+)?s\]/gi,' ')
    .replace(/\[\[p\d+\]\]/gi,' ').replace(/\[(?:whisper|shout|slow|fast|normal|stop)\]/gi,' ')
    .replace(/\s+/g,' ').trim();
}
function joinAudio(parts,sampleRate) {
  const gap=new Float32Array(Math.round(sampleRate*.12));
  const output=new Float32Array(parts.reduce((n,p)=>n+p.length,0)+Math.max(0,parts.length-1)*gap.length);
  let offset=0;
  parts.forEach((p,i)=>{output.set(p,offset);offset+=p.length;if(i<parts.length-1){output.set(gap,offset);offset+=gap.length;}});
  return output;
}
export async function generateKokoro(script,voiceId,speed=1,onProgress=()=>{}) {
  const tts=await getKokoro();
  const parts=splitText(cleanCues(script),1000);
  const audioParts=[]; let sampleRate=24000;
  for(let i=0;i<parts.length;i++){
    onProgress(`Generating audio ${i+1} of ${parts.length}…`);
    const result=await tts.generate(parts[i],{voice:voiceId,speed});
    const samples=result?.audio;
    sampleRate=result?.sampling_rate||result?.samplingRate||sampleRate;
    if(!samples || typeof samples.length!=='number') throw new Error('Kokoro returned an unsupported audio format.');
    audioParts.push(Float32Array.from(samples));
  }
  return {samples:joinAudio(audioParts,sampleRate),sampleRate};
}
export async function generateServerVoice(script,voice,speed=1,onProgress=()=>{}) {
  const engine=voice.engine, parts=splitText(cleanCues(script),4300), audioParts=[];
  let sampleRate=24000;
  for(let i=0;i<parts.length;i++){
    onProgress(`Generating audio ${i+1} of ${parts.length}…`);
    const payload=engine==='melo'
      ? {text:parts[i],language:voice.id.split(':')[1],speed}
      : {text:parts[i],model:'tts_models/en/ljspeech/vits',speed};
    const response=await fetch(engine==='melo'?'/api/melo':'/api/coqui',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
    });
    if(!response.ok){let msg=`${engine} returned ${response.status}`;try{msg=(await response.json()).detail||msg;}catch{}throw new Error(msg);}
    const ctx=new AudioContext();
    const decoded=await ctx.decodeAudioData(await (await response.blob()).arrayBuffer());
    sampleRate=decoded.sampleRate; audioParts.push(Float32Array.from(decoded.getChannelData(0)));
    await ctx.close();
  }
  return {samples:joinAudio(audioParts,sampleRate),sampleRate};
}
function makeWav(samples,sampleRate){
  const buffer=new ArrayBuffer(44+samples.length*2),view=new DataView(buffer);
  const write=(o,s)=>[...s].forEach((c,i)=>view.setUint8(o+i,c.charCodeAt(0)));
  write(0,'RIFF');view.setUint32(4,36+samples.length*2,true);write(8,'WAVE');write(12,'fmt ');
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
  view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*2,true);
  view.setUint16(32,2,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,samples.length*2,true);
  for(let i=0,o=44;i<samples.length;i++,o+=2){const v=Math.max(-1,Math.min(1,samples[i]));view.setInt16(o,v<0?v*32768:v*32767,true);}
  return new Blob([buffer],{type:'audio/wav'});
}
async function makeMp3(samples,sampleRate){
  const mod=await import('@breezystack/lamejs'),Encoder=mod.Mp3Encoder||mod.default?.Mp3Encoder;
  if(!Encoder) throw new Error('MP3 encoder could not be loaded.');
  const encoder=new Encoder(1,sampleRate,128),pcm=new Int16Array(samples.length),chunks=[];
  for(let i=0;i<samples.length;i++){const v=Math.max(-1,Math.min(1,samples[i]));pcm[i]=v<0?v*32768:v*32767;}
  for(let i=0;i<pcm.length;i+=1152){const block=encoder.encodeBuffer(pcm.subarray(i,i+1152));if(block.length)chunks.push(new Int8Array(block));}
  const tail=encoder.flush();if(tail.length)chunks.push(new Int8Array(tail));
  return new Blob(chunks,{type:'audio/mpeg'});
}
export async function exportAudioFiles(samples,sampleRate,format='both'){
  const files=[];
  if(format==='wav'||format==='both')files.push({name:'roz-voice.wav',blob:makeWav(samples,sampleRate)});
  if(format==='mp3'||format==='both')files.push({name:'roz-voice.mp3',blob:await makeMp3(samples,sampleRate)});
  return files;
}
export function downloadAudioFiles(files){
  files.forEach((file,index)=>{const url=URL.createObjectURL(file.blob),a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);setTimeout(()=>{a.click();a.remove();URL.revokeObjectURL(url);},index*400);});
}

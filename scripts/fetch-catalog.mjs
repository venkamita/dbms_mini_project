// Fetch public Steam store facts and artwork; never connects to either database.
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import sharp from 'sharp';

const candidates = [
  [1245620,'Elden Ring'],[413150,'Stardew Valley'],[1145360,'Hades'],[504230,'Celeste'],
  [367520,'Hollow Knight'],[105600,'Terraria'],[620,'Portal 2'],[400,'Portal'],
  [1086940,"Baldur's Gate 3"],[1091500,'Cyberpunk 2077'],[292030,'The Witcher 3'],
  [1174180,'Red Dead Redemption 2'],[1593500,'God of War'],[814380,'Sekiro'],
  [374320,'Dark Souls III'],[570940,'Dark Souls Remastered'],[268910,'Cuphead'],
  [588650,'Dead Cells'],[646570,'Slay the Spire'],[1794680,'Vampire Survivors'],
  [250900,'The Binding of Isaac'],[632360,'Risk of Rain 2'],[548430,'Deep Rock Galactic'],
  [275850,"No Man's Sky"],[264710,'Subnautica'],[892970,'Valheim'],[648800,'Raft'],
  [108600,'Project Zomboid'],[294100,'RimWorld'],[427520,'Factorio'],[526870,'Satisfactory'],
  [255710,'Cities: Skylines'],[289070,'Civilization VI'],[8930,'Civilization V'],
  [236850,'Europa Universalis IV'],[281990,'Stellaris'],[394360,'Hearts of Iron IV'],
  [1158310,'Crusader Kings III'],[322330,"Don't Starve Together"],
  [1057090,'Ori and the Will of the Wisps'],[261570,'Ori and the Blind Forest'],
  [391540,'Undertale'],[460950,'Katana ZERO'],[1151340,'Fallout 76'],
  [22380,'Fallout: New Vegas'],[377160,'Fallout 4'],[489830,'Skyrim Special Edition'],
  [638970,'Yakuza 0'],[582010,'Monster Hunter: World'],[1446780,'Monster Hunter Rise'],
  [990080,'Hogwarts Legacy'],[1817070,'Spider-Man Remastered'],[205100,'Dishonored'],
  [403640,'Dishonored 2'],[480490,'Prey'],[200510,'XCOM: Enemy Unknown'],[268500,'XCOM 2'],
  [379720,'DOOM'],[782330,'DOOM Eternal'],[550,'Left 4 Dead 2'],[4000,"Garry's Mod"],
  [70,'Half-Life'],[220,'Half-Life 2'],[244850,'Space Engineers'],[242760,'The Forest'],
  [1326470,'Sons of the Forest'],[552520,'Far Cry 5'],[8870,'BioShock Infinite'],
  [570,'Dota 2'],[730,'Counter-Strike 2'],[440,'Team Fortress 2'],
  [1222670,'The Sims 4'],[1172470,'Apex Legends'],[238960,'Path of Exile'],[230410,'Warframe'],
];
const descriptions = {
  1245620:'Explore the Lands Between, build a character around weapons and magic, and challenge formidable bosses in an open-world action RPG.',
  413150:'Restore a farm, grow seasonal crops, explore mines and build relationships with the residents of a rural valley.',
  1145360:'Battle through the Greek underworld in repeatable action runs, combining weapons and divine powers while uncovering a family story.',
  504230:'Climb a mountain through precise platforming challenges, learning movement techniques across compact stages and a personal story.',
};
const decode = text => String(text || '').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/li>|<\/p>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\n{3,}/g,'\n\n').trim();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
await mkdir('output/steam-cache', { recursive: true });
await mkdir('data', { recursive: true });
async function fetchChecked(url) {
  for (let attempt=0; attempt<3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: {'User-Agent':'GameMatch academic catalog importer'} });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch(error) { if(attempt===2) throw error; await delay(2000*(attempt+1)); }
  }
}
async function imageAsset(appId, url, name) {
  const directory=`public/images/games/${appId}`;
  const file=`${directory}/${name}.webp`;
  try { await access(file); return file.replace('public',''); } catch {}
  const parsed=new URL(url);
  if(parsed.protocol!=='https:' || !/(^|\.)(steamstatic\.com|steamusercontent\.com|akamaihd\.net)$/.test(parsed.hostname)) throw new Error('Unexpected artwork host');
  const response=await fetchChecked(url);
  if(!response.headers.get('content-type')?.startsWith('image/')) throw new Error('Artwork response is not an image');
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length>12000000) throw new Error('Artwork exceeds size limit');
  await mkdir(directory,{recursive:true});
  await sharp(bytes).resize({width:name==='cover'?920:1200,withoutEnlargement:true}).webp({quality:80}).toFile(file);
  return file.replace('public','');
}
const games=[], skipped=[];
for(const [appId, seedTitle] of candidates) {
  if(games.length===64) break;
  try {
    const cache=`output/steam-cache/${appId}.json`;
    let data;
    try { data=JSON.parse(await readFile(cache,'utf8')); }
    catch { const json=await (await fetchChecked(`https://store.steampowered.com/api/appdetails?appids=${appId}&cc=us&l=english`)).json(); if(!json[appId]?.success) throw new Error('Store data unavailable'); data=json[appId].data; await writeFile(cache,JSON.stringify(data)); }
    if(data.type!=='game' || data.release_date?.coming_soon) throw new Error('Not a released game');
    const price=data.is_free?0:data.price_overview?.currency==='USD'?data.price_overview.initial/100:null;
    if(price===null) throw new Error('No published USD base price');
    const released=new Date(`${data.release_date.date} UTC`);
    if(Number.isNaN(released.getTime())) throw new Error('No parseable release date');
    const cover=await imageAsset(appId,data.header_image,'cover');
    const shots=[];
    for(const [index,shot] of (data.screenshots||[]).slice(0,2).entries()) shots.push(await imageAsset(appId,shot.path_full,`screenshot-${index+1}`));
    if(!shots.length) throw new Error('No published screenshots');
    const genres=[...new Set((data.genres||[]).map(g=>decode(g.description)).filter(g=>g!=='Free To Play'))];
    if(!genres.length) throw new Error('No genres published');
    const requirements={};
    for(const [platform,field] of [['windows','pc_requirements'],['mac','mac_requirements'],['linux','linux_requirements']]) {
      const minimum=decode(data[field]?.minimum),recommended=decode(data[field]?.recommended);
      if(minimum || recommended) requirements[platform]={...(minimum?{minimum}:{}),...(recommended?{recommended}:{})};
    }
    const title=decode(data.name), publisher=decode(data.publishers?.[0]);
    if(!publisher || publisher.length>100 || title.length>150) throw new Error('Unsupported title/publisher length');
    const description=descriptions[appId] || decode(data.short_description).split(/\s+/).slice(0,90).join(' ');
    if(description.length<10) throw new Error('Missing description');
    games.push({steam_app_id:appId,seed_title:games.length<4?seedTitle:null,title,publisher,base_price:price,release_date:released.toISOString().slice(0,10),genres,platforms:['PC'],metadata:{description,tags:[...new Set([title,...genres,...(data.categories||[]).filter(c=>/single-player|co-op|multi-player/i.test(c.description)).map(c=>decode(c.description))])],screenshots:[cover,...shots],system_requirements:requirements,dlc:[]},source:{provider:'Steam',url:`https://store.steampowered.com/app/${appId}/`,retrieved_at:new Date().toISOString(),currency:'USD',price_basis:'Published US base price at retrieval; existing game prices are preserved',artwork:[data.header_image,...data.screenshots.slice(0,2).map(s=>s.path_full)],dlc_note:'Expansion catalog not imported; existing DLC entries are preserved'}});
    console.log(`${games.length}/64 ${title}`);
    await delay(1100);
  } catch(error) { skipped.push({steam_app_id:appId,reason:error.message}); console.log(`Skipped ${appId}: ${error.message}`); if(games.length<4) throw error; }
}
if(games.length<64) throw new Error(`Only ${games.length} complete records fetched`);
await writeFile('data/catalog.json',JSON.stringify({version:1,games},null,2)+'\n');
await writeFile('output/steam-cache/fetch-report.json',JSON.stringify({importable:games.length,skipped},null,2));
console.log('Saved 64 catalog records and local WebP artwork. No database changes made.');

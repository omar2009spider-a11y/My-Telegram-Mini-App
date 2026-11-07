(() => {
  const $ = (id) => document.getElementById(id);
  const tg = window.Telegram?.WebApp;
  const storageKey = 'neon-nibbler-v1';
  const dayKey = () => new Date().toLocaleDateString('en-CA');
  const defaults = {
    best: 0, coins: 120, fruit: 0, runs: 0, totalScore: 0, xp: 0, streak: 3,
    music: true, sfx: true, haptics: true, reducedMotion: false, leftHanded: false,
    difficulty: 'normal', mode: 'classic', playerName: '', skin: 'mint', lastDailyClaim: '',
    skins: ['mint'], upgrades: { magnet: 0, shield: 0, multiplier: 0 },
    daily: { day: '', claimed: false, lastClaim: '', play: 0, fruit: 0, score: 0, claimedQuests: [] },
    achievements: []
  };
  let saved;
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey) || '{}');
    saved = { ...defaults, ...raw, upgrades: { ...defaults.upgrades, ...(raw.upgrades || {}) }, daily: { ...defaults.daily, ...(raw.daily || {}) } };
  } catch { saved = structuredClone(defaults); }
  const modes = {
    classic: { title: 'CLASSIC RUN', seconds: 30, spawn: 610, comet: true, reward: 1, description: 'A balanced 30-second snack run.' },
    zen: { title: 'ZEN GARDEN', seconds: 60, spawn: 680, comet: false, reward: .8, description: 'A calm 60-second run with no comets.' },
    rush: { title: 'STAR RUSH', seconds: 25, spawn: 430, comet: true, reward: 1.5, description: 'Fast, spicy and extra rewarding.' }
  };
  const skins = [
    { id: 'mint', name: 'Mint Pop', emoji: '👾', cost: 0, color: '#85ffc0', description: 'Your trusty cosmic buddy.' },
    { id: 'berry', name: 'Berry Blast', emoji: '🍓', cost: 120, color: '#ff799b', description: 'Sweet with a little sparkle.' },
    { id: 'moon', name: 'Moon Jelly', emoji: '🪼', cost: 220, color: '#a6b9ff', description: 'A cool glow from deep space.' },
    { id: 'sun', name: 'Solar Puff', emoji: '☀️', cost: 360, color: '#ffd86b', description: 'Brighter than a supernova.' },
    { id: 'cosmic', name: 'Cosmic Crown', emoji: '🌌', cost: 600, color: '#c79cff', description: 'For legendary snack chasers.' }
  ];
  const upgradeInfo = {
    magnet: { icon: '🧲', name: 'Star Magnet', description: 'Wider catch zone for falling treats.', base: 70, max: 5 },
    shield: { icon: '🛡️', name: 'Comet Shield', description: 'Block one comet hit per level each run.', base: 90, max: 3 },
    multiplier: { icon: '✖️', name: 'Combo Core', description: 'Earn extra points from every catch.', base: 110, max: 5 }
  };
  const questInfo = [
    { id: 'play', icon: '🎮', title: 'Show up, star stuff', description: 'Finish one run today.', target: 1, reward: 35 },
    { id: 'fruit', icon: '🍓', title: 'Fruitful little orbit', description: 'Catch 20 treats today.', target: 20, reward: 50 },
    { id: 'score', icon: '🏁', title: 'Make it count', description: 'Score 350 points in one run.', target: 350, reward: 60 }
  ];
  const achievementInfo = [
    { id: 'first-run', icon: '🚀', name: 'Liftoff', note: 'Finish your first run', test: () => saved.runs >= 1 },
    { id: 'fruit-25', icon: '🍓', name: 'Berry collector', note: 'Catch 25 treats total', test: () => saved.fruit >= 25 },
    { id: 'score-500', icon: '🌟', name: 'Star material', note: 'Score 500 in one run', test: () => saved.best >= 500 },
    { id: 'score-1500', icon: '💫', name: 'Supernova', note: 'Score 1,500 in one run', test: () => saved.best >= 1500 },
    { id: 'runs-10', icon: '🪐', name: 'Regular orbit', note: 'Finish 10 runs', test: () => saved.runs >= 10 },
    { id: 'level-5', icon: '👑', name: 'Space royalty', note: 'Reach level 5', test: () => levelData().level >= 5 }
  ];
  let playing = false, score = 0, caught = 0, combo = 1, lastCatch = 0, seconds = 30, totalSeconds = 30;
  let playerX = 50, spawnTimer, clockTimer, toastTimer, musicTimer, musicStep = 0;
  let boosted = false, boostCharges = 1, shieldCharges = 0, audioContext = null, screen = 'home';
  const melody = [440, 523.25, 659.25, 523.25, 587.33, 698.46, 880, 698.46, 659.25, 523.25, 440, 523.25, 587.33, 523.25, 392, 440];

  function ensureDaily() {
    const today = dayKey();
    if (saved.daily.day !== today) saved.daily = { ...defaults.daily, day: today };
  }
  function levelData() {
    let level = 1, remaining = Math.max(0, saved.xp);
    while (remaining >= level * 100) { remaining -= level * 100; level++; }
    return { level, inLevel: remaining, next: level * 100 };
  }
  function esc(value) { return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(saved)); } catch { /* local storage may be disabled */ }
    text('coin-count', saved.coins.toLocaleString()); text('best-score-hero', saved.best.toLocaleString());
    text('your-rank-score', `${saved.best.toLocaleString()} ✦`); text('streak-count', saved.streak);
    text('mission-count', `${Math.min(saved.daily.fruit, 20)} / 20 TODAY`);
    const progress = $('mission-progress'); if (progress) progress.style.width = `${Math.min(saved.daily.fruit / 20 * 100, 100)}%`;
    const nick = $('welcome-name'); if (nick) nick.textContent = displayName();
    document.querySelectorAll('[data-coins]').forEach(node => node.textContent = saved.coins.toLocaleString());
    updateAudioButtons();
  }
  function text(id, value) { const node = $(id); if (node) node.textContent = value; }
  function displayName() { return saved.playerName || tg?.initDataUnsafe?.user?.first_name || 'Space Cadet'; }
  function haptic(style = 'light') {
    if (!saved.haptics) return;
    try { tg?.HapticFeedback?.impactOccurred(style); } catch { /* not inside Telegram */ }
  }
  function toast(message) {
    const node = $('toast'); node.textContent = message; node.classList.remove('hidden');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.add('hidden'), 2400);
  }
  function ensureAudio() {
    if (!audioContext) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) audioContext = new AC(); }
    if (audioContext?.state === 'suspended') audioContext.resume().catch(() => {});
  }
  function tone(frequency, duration, type = 'sine', volume = .06, delay = 0) {
    if (!audioContext) return;
    const start = audioContext.currentTime + delay, oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, start); gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + .018); gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.start(start); oscillator.stop(start + duration + .03);
  }
  function startMusic() {
    if (!saved.music || musicTimer) return; ensureAudio(); if (!audioContext) return; musicStep = 0;
    const step = () => {
      if (!saved.music || !audioContext) return;
      const note = melody[musicStep % melody.length]; tone(note, .25, 'triangle', .023); tone(note / 2, .34, 'sine', .017);
      if (musicStep % 4 === 0) tone(melody[(musicStep + 4) % melody.length] / 4, .48, 'sine', .03);
      musicStep++;
    };
    step(); musicTimer = setInterval(step, 310);
  }
  function stopMusic() { clearInterval(musicTimer); musicTimer = null; }
  function sfx(kind) {
    if (!saved.sfx) return; ensureAudio(); if (!audioContext) return;
    if (kind === 'fruit') { tone(740, .09, 'sine', .07); tone(1110, .16, 'triangle', .045, .055); }
    else if (kind === 'meteor') { tone(190, .18, 'sawtooth', .055); tone(120, .24, 'triangle', .05, .07); }
    else if (kind === 'boost') [523,659,784,1046].forEach((n,i)=>tone(n,.22,'triangle',.045,i*.065));
    else if (kind === 'start') { tone(392,.12,'triangle',.04); tone(587,.18,'triangle',.04,.1); }
    else if (kind === 'finish') [523,659,784,1046].forEach((n,i)=>tone(n,.28,'triangle',.04,i*.09));
    else if (kind === 'purchase') [660,880].forEach((n,i)=>tone(n,.12,'sine',.05,i*.08));
  }
  function updateAudioButtons() {
    const music = $('music-setting'), effects = $('sfx-setting'), haptics = $('haptics-setting');
    if (music) music.checked = !!saved.music; if (effects) effects.checked = !!saved.sfx; if (haptics) haptics.checked = !!saved.haptics;
    const sound = $('sound-btn'); if (sound) { sound.textContent = saved.sfx ? '♫' : '♩'; sound.setAttribute('aria-label', `Sound effects ${saved.sfx ? 'on' : 'off'}`); }
  }

  function openGame() {
    if (playing) return;
    const mode = modes[saved.mode] || modes.classic;
    score = 0; caught = 0; combo = 1; seconds = mode.seconds; totalSeconds = seconds; lastCatch = 0; playerX = 50; boosted = false;
    boostCharges = 1 + saved.upgrades.multiplier; shieldCharges = saved.upgrades.shield; text('shield-count',shieldCharges);
    text('score','0'); text('combo','×1'); text('timer',seconds); text('mode-run-label',mode.title);
    $('timer').parentElement.style.setProperty('--time-progress','100%'); $('items').replaceChildren(); $('floaters').replaceChildren();
    $('player-blob').style.left = '50%'; $('player-blob').style.setProperty('--blob-color', currentSkin().color);
    $('tap-hint').classList.remove('hidden'); $('game').classList.remove('hidden'); $('game').setAttribute('aria-hidden','false');
    const boost = $('boost-btn'); boost.disabled = false; boost.innerHTML = `BOOST <span>${boostCharges}</span>`;
    playing = true; haptic(); ensureAudio(); startMusic(); sfx('start');
    setTimeout(() => $('tap-hint').classList.add('hidden'), 2200);
    spawnTimer = setInterval(spawnItem, spawnDelay()); clockTimer = setInterval(tick, 1000); spawnItem();
  }
  function spawnDelay() {
    const factor = saved.difficulty === 'easy' ? 1.25 : saved.difficulty === 'hard' ? .78 : 1;
    return Math.max(300, Math.round(modes[saved.mode].spawn * factor));
  }
  function spawnItem() {
    if (!playing) return;
    const kind = modes[saved.mode].comet && Math.random() < (saved.difficulty === 'hard' ? .34 : saved.difficulty === 'easy' ? .14 : .25) ? 'meteor' : 'fruit';
    const item = document.createElement('span'); item.className = `falling-item${kind === 'meteor' ? ' meteor' : ''}`;
    item.textContent = kind === 'meteor' ? '☄️' : (Math.random() < .8 ? '✦' : '🍓');
    const x = 8 + Math.random() * 84; item.style.left = `${x}%`;
    item.style.animationDuration = `${(boosted ? 1.65 : saved.mode === 'rush' ? 1.95 : 2.55) + Math.random() * .95}s`;
    item.dataset.kind = kind; item.dataset.x = x; $('items').append(item);
    setTimeout(() => {
      if (!item.isConnected || !playing) return;
      if (Math.abs(Number(item.dataset.x) - playerX) < catchRange()) item.dataset.kind === 'fruit' ? collect(item) : hitMeteor(item);
      else item.remove();
    }, parseFloat(item.style.animationDuration) * 1000 * .77);
    setTimeout(() => item.remove(), 4300);
  }
  function catchRange() { return 9 + saved.upgrades.magnet * 2; }
  function collect(item, factor = 1) {
    if (!item.isConnected || !playing) return;
    combo = Date.now() - lastCatch < 1000 ? Math.min(combo + 1, 12) : 1; lastCatch = Date.now();
    const mult = 1 + saved.upgrades.multiplier * .15;
    const points = Math.round(10 * combo * mult * factor * (saved.mode === 'rush' ? 1.15 : 1));
    score += points; caught++; text('score',score.toLocaleString()); text('combo',`×${combo}`); haptic(combo >= 4 ? 'medium' : 'light'); sfx('fruit');
    floatText(item,`+${points}${combo > 1 ? ` ×${combo}` : ''}`); item.remove();
  }
  function hitMeteor(item) {
    if (!item.isConnected || !playing) return;
    if (shieldCharges > 0) { shieldCharges--; text('shield-count',`${shieldCharges} left`); floatText(item,'BLOCKED!',false); sfx('boost'); item.remove(); return; }
    score = Math.max(0,score-15); combo = 1; text('score',score.toLocaleString()); text('combo','×1'); haptic('heavy'); sfx('meteor'); floatText(item,'−15',true); item.remove();
  }
  function floatText(item,label,danger=false) {
    const node=document.createElement('span'); node.className='float-score'; node.textContent=label; node.style.color=danger?'var(--coral)':'var(--gold)';
    node.style.left=item.style.left; node.style.top=`${item.offsetTop}px`; $('floaters').append(node); setTimeout(()=>node.remove(),850);
  }
  function tick() {
    seconds--; text('timer',seconds); $('timer').parentElement.style.setProperty('--time-progress',`${Math.max(seconds/totalSeconds*100,0)}%`);
    if (seconds<=0) finish();
  }
  function unlockAchievements() {
    const newly=[];
    achievementInfo.forEach(a=>{if(a.test()&&!saved.achievements.includes(a.id)){saved.achievements.push(a.id);newly.push(a.name);}});
    if(newly.length)saved.coins+=newly.length*25;
    newly.forEach(name=>setTimeout(()=>toast(`Achievement unlocked: ${name} · +25 stars ✨`),700));
  }
  function finish() {
    playing=false; clearInterval(spawnTimer); clearInterval(clockTimer); saved.runs++; saved.fruit+=caught; saved.totalScore+=score;
    saved.daily.play=Math.min(1,saved.daily.play+1); saved.daily.fruit+=caught; saved.daily.score=Math.max(saved.daily.score,score);
    const prior=saved.best; saved.best=Math.max(saved.best,score);
    const earned=Math.max(5,Math.floor((score/14+caught)*modes[saved.mode].reward)); saved.coins+=earned;
    const gainedXp=Math.max(8,Math.floor(score/9)+caught*2); saved.xp+=gainedXp;
    unlockAchievements(); save(); sfx('finish');
    text('final-score',score.toLocaleString()); text('final-fruit',caught); text('final-best',saved.best.toLocaleString()); text('final-coins',`+${earned}`);
    text('result-title',score>prior&&score>0?'New personal best!':score>200?'Star material!':'Nice little run!'); text('final-xp',`+${gainedXp} XP`);
    $('game').classList.add('hidden'); $('game').setAttribute('aria-hidden','true'); $('result').classList.remove('hidden'); $('result').setAttribute('aria-hidden','false'); haptic('medium');
  }
  function closeGame() { playing=false; clearInterval(spawnTimer); clearInterval(clockTimer); $('game').classList.add('hidden'); $('game').setAttribute('aria-hidden','true'); }
  function moveFromPointer(event) {
    if (!playing) return;
    const rect=$('game-stage').getBoundingClientRect(); playerX=Math.max(5,Math.min(95,(event.clientX-rect.left)/rect.width*100));
    $('player-blob').style.left=`${playerX}%`; if(event.type==='pointerdown')haptic();
    const blob=$('player-blob').getBoundingClientRect();
    document.querySelectorAll('.falling-item').forEach(item=>{const r=item.getBoundingClientRect();if(r.bottom>=blob.top-4&&r.top<=blob.bottom+6&&Math.abs((r.left+r.width/2)-(blob.left+blob.width/2))<36+saved.upgrades.magnet*4)item.dataset.kind==='fruit'?collect(item):hitMeteor(item);});
  }
  function boost() {
    if (!playing) return; if(boostCharges<=0){toast('Your Star Burst is all used up this run ✨');return;}
    boosted=true;boostCharges--;haptic('medium');sfx('boost');$('boost-btn').innerHTML=boostCharges?`BURST <span>${boostCharges}</span>`:'BURST USED';
    document.querySelectorAll('.falling-item:not(.meteor)').forEach(item=>collect(item,2));toast('Star Burst! Double points for 5 seconds');
    setTimeout(()=>{boosted=false;if(playing)$('boost-btn').innerHTML=boostCharges?`BOOST <span>${boostCharges}</span>`:'BOOST USED';},5000);
  }
  function currentSkin(){return skins.find(s=>s.id===saved.skin)||skins[0];}
  function shareText(text) {
    if(tg?.switchInlineQuery){tg.switchInlineQuery(text,['users','groups','channels']);return;}
    if(navigator.share)navigator.share({title:'Neon Nibbler',text}).catch(()=>{});
    else if(navigator.clipboard)navigator.clipboard.writeText(text).then(()=>toast('Copied! Send it to your group chat ✨')).catch(()=>toast(text));else toast(text);
  }
  function openRoute(route) {
    screen=route; $('home-screen').classList.toggle('hidden',route!=='home'); $('subscreen').classList.toggle('hidden',route==='home');
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.tab===route));
    if(route==='home'){window.scrollTo({top:0,behavior:'smooth'});return;}
    renderRoute(route); window.scrollTo({top:0,behavior:'smooth'});
  }
  function title(eyebrow,heading,sub='') { return `<div class="screen-title-row"><div><p class="screen-eyebrow">${eyebrow}</p><h2>${heading}</h2><p>${sub}</p></div></div>`; }
  function questCard(q) {
    const val=saved.daily[q.id]||0,done=val>=q.target,claimed=saved.daily.claimedQuests.includes(q.id);
    return `<article class="quest-card"><div class="quest-glyph">${q.icon}</div><div class="quest-copy"><b>${q.title}</b><p>${q.description}</p><div class="progress-line"><i style="width:${Math.min(100,val/q.target*100)}%"></i></div><small>${Math.min(val,q.target).toLocaleString()} / ${q.target.toLocaleString()}</small></div><span class="quest-reward">+${q.reward} ✦</span><button class="small-action" data-action="${done?'claim-quest':'quest-go'}" data-id="${q.id}" ${claimed?'disabled':''}>${claimed?'DONE':done?'CLAIM':'GO'}</button></article>`;
  }
  function renderMissions() {
    const today=dayKey(),claimed=saved.lastDailyClaim===today;
    return `${title('TODAY IN THE GARDEN','Missions','Little goals make every run count.')}
      <article class="daily-banner"><span class="daily-icon">🎁</span><div><b>Daily star chest</b><p>${claimed?'Your daily chest is already open. Come back tomorrow!':`Claim ${50+saved.streak*5} stars and keep your ${saved.streak}-day streak alive.`}</p></div><button class="small-action" data-action="daily-claim" ${claimed?'disabled':''}>${claimed?'CLAIMED':`CLAIM +${50+saved.streak*5}`}</button></article>
      <div class="section-heading"><div><p class="eyebrow">RESETS EVERY DAY</p><h3>Daily missions</h3></div><span class="quest-reward">${saved.daily.claimedQuests.length}/3 CLAIMED</span></div>
      <div class="mission-list">${questInfo.map(questCard).join('')}</div>
      <div class="screen-panel"><h3>How rewards work</h3><p>Finish missions and runs to earn star coins and XP. These rewards are game points stored on this device; they are not cash or transferable tokens.</p></div>`;
  }
  function renderShop() {
    const upgrades=Object.entries(upgradeInfo).map(([id,u])=>{const level=saved.upgrades[id],price=Math.round(u.base*(1+level*.75));return `<article class="upgrade-card"><span class="upgrade-icon">${u.icon}</span><h3>${u.name}</h3><p>${u.description}</p><div class="upgrade-level">LEVEL ${level} / ${u.max}</div><button class="small-action" data-action="upgrade" data-id="${id}" ${level>=u.max?'disabled':''}>${level>=u.max?'MAX LEVEL':`UPGRADE · ${price} ✦`}</button></article>`;}).join('');
    const outfits=skins.map(s=>{const owned=saved.skins.includes(s.id),selected=saved.skin===s.id;return `<article class="skin-card ${selected?'selected':''} ${owned?'':'locked'}"><div class="skin-art" style="--skin:${s.color}"><span>${s.emoji}</span></div><h3>${s.name}</h3><p>${s.description}</p><button class="small-action ${selected?'equipped':''}" data-action="skin" data-id="${s.id}">${selected?'EQUIPPED':owned?'EQUIP':`UNLOCK · ${s.cost} ✦`}</button></article>`;}).join('');
    return `${title('YOUR COSMIC STASH','Stash & upgrades','Use stars from runs to power up and personalize Nibbler.')}
      <div class="screen-panel"><p class="screen-eyebrow">YOUR STAR BALANCE</p><h3 style="font-size:20px;color:var(--gold)">✦ ${saved.coins.toLocaleString()} <span style="font-size:9px;color:#aaa1c0">game stars</span></h3></div>
      <div class="section-heading"><div><p class="eyebrow">GET STRONGER</p><h3>Permanent upgrades</h3></div></div><div class="upgrade-grid">${upgrades}</div>
      <div class="section-heading"><div><p class="eyebrow">LOOK GOOD OUT THERE</p><h3>Mascot collection</h3></div></div><div class="skin-grid">${outfits}</div>`;
  }
  function renderLeaderboard() {
    const data=[{n:displayName(),i:'👾',s:saved.best,own:true},{n:'LunaLoops',i:'🍑',s:8420},{n:'orbit.boi',i:'🪐',s:7960},{n:'little.meteor',i:'🐙',s:7115},{n:'nebula_nap',i:'🦋',s:6040}].sort((a,b)=>b.s-a.s);
    const rows=data.map((p,i)=>`<div class="leaderboard-full-row"><span class="rank ${i===0?'rank-gold':''}">${String(i+1).padStart(2,'0')}</span><div class="leader-avatar ${i%2?'avatar-blue':'avatar-violet'}">${p.i}</div><div class="leader-name"><b>${esc(p.n)} ${p.own?'<small>(you)</small>':''}</b><small>${p.own?'Personal best':'Illustrative demo score'}</small></div><div class="leader-points">${p.s.toLocaleString()} <span>✦</span></div></div>`).join('');
    return `${title('CHASING THE CONSTELLATION','Leaderboard','Set a personal best and challenge your crew.')}
      <div class="screen-panel"><p class="screen-eyebrow">YOUR PERSONAL BEST</p><h3 style="font-size:22px;color:var(--mint)">${saved.best.toLocaleString()} <small style="font-size:9px;color:#aaa1c0">points</small></h3><p>Top scores shown here are demo names until a Telegram-connected leaderboard server is added.</p></div>
      <div class="screen-panel"><h3>Garden legends <span style="color:var(--gold)">✦</span></h3>${rows}</div>
      <button class="play-button" data-action="challenge">✉ &nbsp; CHALLENGE A FRIEND <span class="button-arrow">↗</span></button>`;
  }
  function renderFriends() {
    return `${title('BETTER WITH YOUR CREW','Friends & invites','Bring your group chat into the Star Garden.')}
      <article class="friend-card"><span class="friend-icon">👯</span><div><b>Send a snack-run challenge</b><p>Share your best score and dare a friend to beat it.</p></div><button class="small-action" data-action="challenge">SHARE</button></article>
      <article class="friend-card"><span class="friend-icon">💌</span><div><b>Invite your Telegram crew</b><p>Open a Telegram chat and send them the game link.</p></div><button class="small-action" data-action="invite">INVITE</button></article>
      <div class="screen-panel"><h3>Play together, fairly</h3><p>Friend leaderboards and invite rewards need a connected bot and server. This offline version never invents referrals or pays out coins for fake invites.</p></div>
      <div class="section-heading"><div><p class="eyebrow">YOUR FLIGHT LOG</p><h3>Recent runs</h3></div></div>
      <div class="screen-panel"><div class="stat-grid"><div class="stat-box"><b>${saved.runs}</b><small>RUNS</small></div><div class="stat-box"><b>${saved.fruit}</b><small>TREATS</small></div><div class="stat-box"><b>${saved.streak}</b><small>DAY STREAK</small></div></div></div>`;
  }
  function renderProfile() {
    const xp=levelData(),unlocked=achievementInfo.filter(a=>saved.achievements.includes(a.id));
    const badges=achievementInfo.map(a=>`<div class="badge-card ${saved.achievements.includes(a.id)?'unlocked':''}"><span>${a.icon}</span><b>${a.name}</b><small>${a.note}</small></div>`).join('');
    return `${title('YOUR COSMIC ID','Space cadet profile','Every run takes you a little further.')}
      <div class="screen-panel"><div class="achievement-callout"><span>${currentSkin().emoji}</span><div><b>${esc(displayName())}</b><p>Level ${xp.level} · ${unlocked.length} of ${achievementInfo.length} badges</p></div><span style="color:var(--gold)">✦ ${saved.coins}</span></div><div class="profile-xp"><i style="width:${xp.inLevel/xp.next*100}%"></i></div><p>${xp.inLevel} / ${xp.next} XP to level ${xp.level+1}</p></div>
      <div class="screen-panel"><h3>Flight stats</h3><div class="stat-grid"><div class="stat-box"><b>${saved.runs}</b><small>RUNS</small></div><div class="stat-box"><b>${saved.fruit}</b><small>TREATS</small></div><div class="stat-box"><b>${saved.best.toLocaleString()}</b><small>BEST</small></div></div><p>Total points earned: ${saved.totalScore.toLocaleString()}</p></div>
      <div class="section-heading"><div><p class="eyebrow">COLLECT THEM ALL</p><h3>Achievements</h3></div></div><div class="badge-grid">${badges}</div>`;
  }
  function renderSettings() {
    const modesHtml=Object.entries(modes).map(([id,m])=>`<option value="${id}" ${saved.mode===id?'selected':''}>${id[0].toUpperCase()+id.slice(1)} · ${m.description}</option>`).join('');
    const setting=(icon,label,detail,id,checked)=>`<label class="setting-row"><span>${icon}</span><span class="setting-row-copy"><b>${label}</b><small>${detail}</small></span><input class="setting-check" id="${id}" type="checkbox" ${checked?'checked':''}></label>`;
    return `${title('TUNE YOUR FLIGHT','Settings','Make the Star Garden feel like yours.')}
      <div class="screen-panel settings-group"><p class="settings-group-title">SOUND & FEEL</p>
      ${setting('♫','Background music','Original looping arcade tune','music-setting',saved.music)}
      ${setting('✦','Sound effects','Fruit, comet, boost and score sounds','sfx-setting',saved.sfx)}
      ${setting('〰','Haptic feedback','Vibration taps in Telegram','haptics-setting',saved.haptics)}
      ${setting('☾','Reduce motion','Calmer transitions and animations','motion-setting',saved.reducedMotion)}</div>
      <div class="screen-panel settings-group"><p class="settings-group-title">GAMEPLAY</p>
      <label class="setting-row"><span>🎮</span><span class="setting-row-copy"><b>Default game mode</b><small>Pick what starts when you tap Play</small></span><select id="mode-setting" class="setting-select">${modesHtml}</select></label>
      <label class="setting-row"><span>☄</span><span class="setting-row-copy"><b>Difficulty</b><small>Changes spawn pace and comet frequency</small></span><select id="difficulty-setting" class="setting-select"><option value="easy" ${saved.difficulty==='easy'?'selected':''}>Chill</option><option value="normal" ${saved.difficulty==='normal'?'selected':''}>Normal</option><option value="hard" ${saved.difficulty==='hard'?'selected':''}>Spicy</option></select></label>
      ${setting('⇄','Left-handed controls','Flip the boost button position','left-setting',saved.leftHanded)}</div>
      <div class="screen-panel settings-group"><p class="settings-group-title">PLAYER</p><label class="setting-row"><span>✎</span><span class="setting-row-copy"><b>Display name</b><small>Shown on this device only</small></span><input class="setting-select" id="name-setting" maxlength="18" value="${esc(saved.playerName)}" placeholder="Space Cadet"></label></div>
      <div class="screen-panel settings-group"><p class="settings-group-title">ABOUT</p><p>Neon Nibbler is an arcade game prototype. Your progress saves in this browser. No real money, prizes or cash purchases are offered.</p><button class="small-action" data-action="reset">RESET LOCAL PROGRESS</button></div>`;
  }
  function renderRoute(route) {
    const content={missions:renderMissions,shop:renderShop,leaderboard:renderLeaderboard,friends:renderFriends,profile:renderProfile,settings:renderSettings};
    $('subscreen').innerHTML=(content[route]||renderMissions)();
    if(route==='settings') bindSettings();
  }
  function bindSettings() {
    $('music-setting').addEventListener('change',e=>{saved.music=e.target.checked;save();if(saved.music){ensureAudio();startMusic();}else stopMusic();});
    $('sfx-setting').addEventListener('change',e=>{saved.sfx=e.target.checked;save();if(saved.sfx){ensureAudio();sfx('fruit');}});
    $('haptics-setting').addEventListener('change',e=>{saved.haptics=e.target.checked;save();haptic();});
    $('motion-setting').addEventListener('change',e=>{saved.reducedMotion=e.target.checked;document.documentElement.classList.toggle('reduce-motion',saved.reducedMotion);save();});
    $('left-setting').addEventListener('change',e=>{saved.leftHanded=e.target.checked;document.body.classList.toggle('left-handed',saved.leftHanded);save();});
    $('mode-setting').addEventListener('change',e=>{saved.mode=e.target.value;save();document.querySelectorAll('.mode-card').forEach(b=>b.classList.toggle('active',b.dataset.mode===saved.mode));});
    $('difficulty-setting').addEventListener('change',e=>{saved.difficulty=e.target.value;save();});
    $('name-setting').addEventListener('change',e=>{saved.playerName=e.target.value.trim().slice(0,18);save();renderRoute('settings');toast('Cadet name saved ✨');});
  }
  function claimDaily() {
    const today=dayKey();if(saved.lastDailyClaim===today){toast('Your star chest is already open today ✨');return;}
    const y=new Date();y.setDate(y.getDate()-1);const yesterday=y.toLocaleDateString('en-CA');
    saved.streak=saved.lastDailyClaim===yesterday?saved.streak+1:1;saved.lastDailyClaim=today;
    const reward=50+saved.streak*5;saved.coins+=reward;save();sfx('purchase');toast(`Daily chest opened: +${reward} stars! 🎁`);renderRoute('missions');
  }
  function handleAction(action,id) {
    if(action==='claim-quest'){
      const q=questInfo.find(x=>x.id===id);if(!q||saved.daily.claimedQuests.includes(id)||(saved.daily[id]||0)<q.target)return;
      saved.daily.claimedQuests.push(id);saved.coins+=q.reward;saved.xp+=20;save();sfx('purchase');toast(`Mission complete: +${q.reward} stars and 20 XP!`);renderRoute('missions');
    } else if(action==='daily-claim') claimDaily();
    else if(action==='quest-go') openGame();
    else if(action==='upgrade'){
      const u=upgradeInfo[id],level=saved.upgrades[id];if(!u||level>=u.max)return;const price=Math.round(u.base*(1+level*.75));
      if(saved.coins<price){toast(`You need ${price} stars for that upgrade.`);return;}saved.coins-=price;saved.upgrades[id]++;save();sfx('purchase');renderRoute('shop');toast(`${u.name} upgraded to level ${level+1}!`);
    } else if(action==='skin'){
      const skin=skins.find(s=>s.id===id);if(!skin)return;
      if(!saved.skins.includes(id)){if(saved.coins<skin.cost){toast(`You need ${skin.cost} stars to unlock this look.`);return;}saved.coins-=skin.cost;saved.skins.push(id);}
      saved.skin=id;save();sfx('purchase');renderRoute('shop');toast(`${skin.name} is ready for takeoff!`);
    } else if(action==='challenge') shareText(`I scored ${saved.best.toLocaleString()} points in Neon Nibbler! Can you beat me?`);
    else if(action==='invite') shareText(`Come play Neon Nibbler with me! ${location.href}`);
    else if(action==='reset') { if(window.confirm('Reset all Neon Nibbler progress saved in this browser? This cannot be undone.')){localStorage.removeItem(storageKey);saved=structuredClone(defaults);save();openRoute('home');toast('Fresh orbit. Your local progress was reset.');} }
  }

  $('play-btn').addEventListener('click',openGame); $('mission-go').addEventListener('click',openGame);
  $('close-game').addEventListener('click',closeGame); $('again-btn').addEventListener('click',()=>{$('result').classList.add('hidden');openGame();});
  $('result-close').addEventListener('click',()=>$('result').classList.add('hidden'));
  $('share-btn').addEventListener('click',()=>shareText(`I scored ${score.toLocaleString()} points in Neon Nibbler! Think you can beat me?`));
  $('profile-btn').addEventListener('click',()=>openRoute('profile')); $('settings-open').addEventListener('click',()=>openRoute('settings'));
  $('earn-btn').addEventListener('click',()=>openRoute('shop'));
  $('leaderboard-btn').addEventListener('click',()=>openRoute('leaderboard')); $('all-missions').addEventListener('click',()=>openRoute('missions'));
  $('modes-link').addEventListener('click',()=>openRoute('settings'));
  document.querySelectorAll('.mode-card').forEach(button=>button.addEventListener('click',()=>{saved.mode=button.dataset.mode;save();document.querySelectorAll('.mode-card').forEach(b=>b.classList.toggle('active',b===button));toast(`${button.dataset.mode[0].toUpperCase()+button.dataset.mode.slice(1)} mode selected`);}));
  document.querySelectorAll('.nav-item').forEach(button=>button.addEventListener('click',()=>openRoute(button.dataset.tab)));
  $('subscreen').addEventListener('click',event=>{const button=event.target.closest('[data-action]');if(button&&!button.disabled)handleAction(button.dataset.action,button.dataset.id);});
  $('game-stage').addEventListener('pointerdown',moveFromPointer); $('game-stage').addEventListener('pointermove',event=>{if(event.buttons||event.pointerType==='touch')moveFromPointer(event);});
  $('boost-btn').addEventListener('click',boost);
  $('sound-btn').addEventListener('click',()=>{saved.sfx=!saved.sfx;save();if(saved.sfx){ensureAudio();sfx('fruit');}toast(`Sound effects ${saved.sfx?'on':'off'} 🔊`);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){if(playing)closeGame();else{$('result').classList.add('hidden');openRoute('home');}}});

  ensureDaily(); save();
  if(saved.reducedMotion)document.documentElement.classList.add('reduce-motion');if(saved.leftHanded)document.body.classList.add('left-handed');
  if(tg){try{tg.ready();tg.expand();tg.setHeaderColor('#100c25');tg.setBackgroundColor('#100c25');}catch{}}
  setTimeout(()=>{$('boot').classList.add('hidden');$('app').classList.remove('hidden');},1900);
})();

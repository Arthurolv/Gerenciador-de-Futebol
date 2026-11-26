const express = require('express');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const port = Number(process.env.PORT || 3000);
const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(process.env.DATABASE_PATH || path.join(dataDir, 'aurora.sqlite'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
db.transaction = (fn) => (...args) => {
  db.exec('BEGIN IMMEDIATE');
  try { const result = fn(...args); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
};
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '40kb' }));
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('Configure JWT_SECRET antes de iniciar em produção.');
}
const authAttempts = new Map();
app.use('/api/auth', (req, res, next) => {
  if (req.method !== 'POST' || !['/login', '/register'].includes(req.path)) return next();
  const key = req.ip || 'unknown';
  const now = Date.now();
  const entry = authAttempts.get(key);
  if (!entry || now - entry.startedAt > 10 * 60_000) authAttempts.set(key, { startedAt: now, count: 1 });
  else if (entry.count >= 8) return res.status(429).json({ error: 'Muitas tentativas. Tente novamente em alguns minutos.' });
  else entry.count += 1;
  next();
});

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY, user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, coach TEXT NOT NULL, formation TEXT NOT NULL DEFAULT '4-3-3',
  style TEXT NOT NULL DEFAULT 'Equilibrado', season INTEGER NOT NULL DEFAULT 2026,
  credits INTEGER NOT NULL DEFAULT 12500000, fans INTEGER NOT NULL DEFAULT 18420,
  played INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0,
  goals_for INTEGER NOT NULL DEFAULT 0, goals_against INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY, team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL, position TEXT NOT NULL, age INTEGER NOT NULL, nationality TEXT NOT NULL,
  rating INTEGER NOT NULL, potential INTEGER NOT NULL, morale INTEGER NOT NULL DEFAULT 78,
  stamina INTEGER NOT NULL DEFAULT 94, goals INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0, training TEXT NOT NULL DEFAULT 'Descanso',
  is_starter INTEGER NOT NULL DEFAULT 0, value INTEGER NOT NULL DEFAULT 0,
  training_xp INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY, team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  opponent TEXT NOT NULL, competition TEXT NOT NULL, home INTEGER NOT NULL,
  match_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'upcoming',
  goals_for INTEGER, goals_against INTEGER, round INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS transfers (
  id INTEGER PRIMARY KEY, team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL, position TEXT NOT NULL, age INTEGER NOT NULL,
  rating INTEGER NOT NULL, fee INTEGER NOT NULL, direction TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);
const playerColumns = db.prepare('PRAGMA table_info(players)').all();
if (!playerColumns.some((column) => column.name === 'training_xp')) {
  db.exec('ALTER TABLE players ADD COLUMN training_xp INTEGER NOT NULL DEFAULT 0');
}

const seedPlayers = [
  ['Lucas Ferreira','GK',27,'🇧🇷',82,86,91,96,0,0,'Reflexos',1,7800000],
  ['Gabriel Monteiro','RB',24,'🇧🇷',78,88,84,93,0,2,'Velocidade',1,6100000],
  ['Matías Rivero','CB',28,'🇺🇾',82,84,89,95,1,1,'Marcação',1,9200000],
  ['Henrique Santos','CB',23,'🇧🇷',79,89,82,93,0,1,'Físico',1,7200000],
  ['Tomás Silva','LB',25,'🇵🇹',77,85,86,91,0,2,'Cruzamento',1,5900000],
  ['Rafael Costa','CM',26,'🇧🇷',84,87,93,96,1,2,'Passe',1,11200000],
  ['Enzo Barros','CM',22,'🇦🇷',81,92,88,94,1,2,'Técnica',1,9800000],
  ['Pedro Almeida','CAM',24,'🇧🇷',86,91,96,93,2,3,'Finalização',1,15400000],
  ['Santiago López','RW',21,'🇨🇴',83,94,90,97,1,2,'Velocidade',1,13600000],
  ['André Rodrigues','ST',25,'🇧🇷',88,91,95,98,4,2,'Finalização',1,18200000],
  ['Nicolás Vega','LW',23,'🇦🇷',84,90,92,96,2,3,'Drible',1,14300000],
  ['Bruno Oliveira','GK',20,'🇧🇷',71,87,75,91,0,0,'Reflexos',0,2800000],
  ['Diego Martins','CB',29,'🇧🇷',74,76,80,94,1,0,'Marcação',0,3200000],
  ['Miguel Torres','CM',20,'🇪🇸',73,91,78,88,2,4,'Passe',0,4100000],
  ['Caio Mendes','RW',21,'🇧🇷',75,90,86,92,4,3,'Drible',0,4700000],
  ['Julián Herrera','ST',27,'🇨🇱',77,79,84,90,0,1,'Finalização',0,5300000],
  ['Thiago Nunes','LB',19,'🇧🇷',69,91,79,89,0,2,'Cruzamento',0,1900000],
  ['Léo Carvalho','CM',30,'🇧🇷',76,76,88,92,3,7,'Passe',0,3700000],
];
const seedSchedule = [
  ['Atlético Mineiro','Campeonato Brasileiro',0,'2026-12-01T22:00:00Z','upcoming',null,null,9],
  ['Flamengo','Campeonato Brasileiro',1,'2026-12-05T22:30:00Z','upcoming',null,null,10],
  ['Palmeiras','Copa Nacional',0,'2026-12-10T23:00:00Z','upcoming',null,null,4],
  ['São Paulo','Campeonato Brasileiro',1,'2026-12-15T22:00:00Z','upcoming',null,null,11],
  ['Grêmio','Campeonato Brasileiro',0,'2026-12-20T20:00:00Z','upcoming',null,null,12],
  ['Bahia','Campeonato Brasileiro',1,'2026-12-25T22:30:00Z','upcoming',null,null,13],
  ['Internacional','Copa Nacional',1,'2027-01-02T23:00:00Z','upcoming',null,null,5],
  ['Corinthians','Campeonato Brasileiro',0,'2027-01-07T22:00:00Z','upcoming',null,null,14],
];
const setup = db.transaction(({ userId, clubName, coach }) => {
  const team = db.prepare('INSERT INTO teams (user_id,name,coach,played,wins,draws,losses,goals_for,goals_against) VALUES (?,?,?,8,3,2,3,12,11)').run(userId, clubName, coach);
  const insertPlayer = db.prepare('INSERT INTO players (team_id,name,position,age,nationality,rating,potential,morale,stamina,goals,assists,training,is_starter,value) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  for (const player of seedPlayers) insertPlayer.run(team.lastInsertRowid, ...player);
  const insertMatch = db.prepare('INSERT INTO matches (team_id,opponent,competition,home,match_date,status,goals_for,goals_against,round) VALUES (?,?,?,?,?,?,?,?,?)');
  const matchHistory = [
    ['Palmeiras','Campeonato Brasileiro',0,'2026-10-18T19:00:00Z','played',1,2,1],
    ['Fluminense','Campeonato Brasileiro',1,'2026-10-22T22:00:00Z','played',2,0,2],
    ['Botafogo','Campeonato Brasileiro',0,'2026-10-27T23:00:00Z','played',1,1,3],
    ['Santos','Campeonato Brasileiro',1,'2026-10-31T22:30:00Z','played',2,1,4],
    ['Bahia','Campeonato Brasileiro',0,'2026-11-05T23:00:00Z','played',0,1,5],
    ['Vasco da Gama','Campeonato Brasileiro',1,'2026-11-10T22:00:00Z','played',1,1,6],
    ['Corinthians','Campeonato Brasileiro',0,'2026-11-15T21:00:00Z','played',3,2,7],
    ['Red Bull Bragantino','Campeonato Brasileiro',1,'2026-11-22T19:00:00Z','played',2,3,8],
  ];
  for (const match of matchHistory) insertMatch.run(team.lastInsertRowid, ...match);
  for (const match of seedSchedule) insertMatch.run(team.lastInsertRowid, ...match);
  return team.lastInsertRowid;
});

function issueSession(userId) {
  const token = jwt.sign({ sub: userId, jti: crypto.randomUUID() }, process.env.JWT_SECRET || 'development-secret-change-with-JWT_SECRET-aurora-fc', { expiresIn: '7d' });
  db.prepare('INSERT INTO sessions (user_id,token_hash,expires_at) VALUES (?,?,?)').run(userId, crypto.createHash('sha256').update(token).digest('hex'), new Date(Date.now() + 7 * 86400000).toISOString());
  return token;
}
function auth(req, res, next) {
  try {
    const raw = req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
    if (!raw) return res.status(401).json({ error: 'Sessão necessária. Entre para continuar.' });
    const payload = jwt.verify(raw, process.env.JWT_SECRET || 'development-secret-change-with-JWT_SECRET-aurora-fc');
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    const session = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(hash);
    if (!session || Date.parse(session.expires_at) <= Date.now() || Number(session.user_id) !== Number(payload.sub)) return res.status(401).json({ error: 'Sua sessão expirou. Entre novamente.' });
    req.userId = Number(payload.sub); req.tokenHash = hash; next();
  } catch { return res.status(401).json({ error: 'Sessão inválida. Entre novamente.' }); }
}
const getTeam = (userId) => db.prepare('SELECT * FROM teams WHERE user_id = ?').get(userId);
const getPlayers = (teamId) => db.prepare('SELECT * FROM players WHERE team_id = ? ORDER BY is_starter DESC, CASE position WHEN \'GK\' THEN 0 WHEN \'CB\' THEN 1 WHEN \'RB\' THEN 2 WHEN \'LB\' THEN 3 WHEN \'CM\' THEN 4 WHEN \'CAM\' THEN 5 WHEN \'RW\' THEN 6 WHEN \'LW\' THEN 7 ELSE 8 END, rating DESC').all(teamId);
const total = (teamId, status) => db.prepare('SELECT COUNT(*) AS count, COALESCE(SUM(goals_for),0) AS gf, COALESCE(SUM(goals_against),0) AS ga FROM matches WHERE team_id = ? AND status = ?').get(teamId, status);
const safeTeam = (teamId) => {
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId);
  const players = getPlayers(teamId);
  const played = db.prepare('SELECT * FROM matches WHERE team_id = ? AND status = \'played\' ORDER BY match_date, id').all(teamId);
  const progress = [];
  let runningPoints = 0;
  for (const match of played) {
    runningPoints += match.goals_for > match.goals_against ? 3 : match.goals_for === match.goals_against ? 1 : 0;
    progress.push({ date: match.match_date, round: match.round, points: runningPoints });
  }
  const pts = team.wins * 3 + team.draws;
  return {
    club: { id:team.id, name:team.name, coach:team.coach, formation:team.formation, style:team.style, season:team.season, credits:team.credits, fans:team.fans },
    squad: { total:players.length, starters:players.filter(p=>p.is_starter).length, averageRating:Math.round(players.filter(p=>p.is_starter).reduce((a,p)=>a+p.rating,0)/Math.max(1,players.filter(p=>p.is_starter).length)), players },
    stats: { played:team.played, wins:team.wins, draws:team.draws, losses:team.losses, points:pts, goalsFor:team.goals_for, goalsAgainst:team.goals_against, goalDifference:team.goals_for-team.goals_against, winRate:team.played?Math.round(100*team.wins/team.played):0, cleanSheets:played.filter(m=>m.goals_against===0).length, topScorer:[...players].sort((a,b)=>b.goals-a.goals)[0], form:played.slice(-6).map(m=>({ result:m.goals_for>m.goals_against?'W':m.goals_for===m.goals_against?'D':'L', goalsFor:m.goals_for, goalsAgainst:m.goals_against, opponent:m.opponent })) },
    progress,
    recentMatches:db.prepare("SELECT * FROM matches WHERE team_id=? AND status='played' ORDER BY match_date DESC, id DESC LIMIT 5").all(teamId),
    upcomingMatches:db.prepare("SELECT * FROM matches WHERE team_id=? AND status='upcoming' ORDER BY match_date, id LIMIT 6").all(teamId),
    leaderboard:[team,{name:'Flamengo',points:17,played:8,wins:5,draws:2,losses:1,gf:16,ga:8,accent:'#de3948'}, {name:'Palmeiras',points:16,played:8,wins:5,draws:1,losses:2,gf:13,ga:7,accent:'#31a376'}, {name:'Atlético Mineiro',points:14,played:8,wins:4,draws:2,losses:2,gf:14,ga:10,accent:'#8290a7'}, {name:'São Paulo',points:13,played:8,wins:4,draws:1,losses:3,gf:12,ga:9,accent:'#dd4050'}, {name:'Grêmio',points:11,played:8,wins:3,draws:2,losses:3,gf:11,ga:11,accent:'#57aadb'}].map((r)=> ({ name:r.name,points:r.points ?? r.wins*3+r.draws,played:r.played,wins:r.wins,draws:r.draws,losses:r.losses,gf:r.gf ?? r.goals_for,ga:r.ga ?? r.goals_against,isUser:r.id===teamId,accent:r.accent || '#ccff38' })).sort((a,b)=>b.points-a.points||b.gf-a.gf).map((r,i)=>({...r,position:i+1})),
    development:db.prepare("SELECT name,rating,potential,position,training FROM players WHERE team_id=? AND is_starter=1 ORDER BY rating DESC LIMIT 7").all(teamId),
    transferTargets:[{name:'Davi Andrade',position:'LW',age:20,rating:78,potential:90,value:6800000,flag:'🇧🇷'},{name:'Félix Moreau',position:'CB',age:24,rating:81,potential:87,value:9400000,flag:'🇫🇷'},{name:'Matteo Ricci',position:'CM',age:22,rating:80,potential:91,value:8700000,flag:'🇮🇹'},{name:'Rafael Blanco',position:'ST',age:23,rating:82,potential:88,value:11200000,flag:'🇨🇴'}].filter(target=>!players.some(player=>player.name===target.name)),
    transfersHistory:db.prepare('SELECT * FROM transfers WHERE team_id=? ORDER BY created_at DESC LIMIT 5').all(teamId),
  };
};

app.get('/api/health', (req,res)=>res.json({status:'ok',service:'Aurora FC Manager API',version:'1.0.0'}));
app.get('/api', (req,res)=>res.json({name:'Aurora FC Manager API',version:'1.0.0',endpoints:['POST /api/auth/register','POST /api/auth/login','POST /api/auth/logout','GET /api/dashboard','GET /api/players','PATCH /api/players/:id/lineup','PATCH /api/players/:id/training','PATCH /api/team/tactics','PATCH /api/team/profile','GET /api/matches','POST /api/matches/:id/play','GET /api/tournaments','GET /api/transfers','POST /api/transfers','GET /api/stats','GET /api/health']}));
app.post('/api/auth/register',(req,res)=>{
  const email=String(req.body.email||'').trim().toLowerCase(); const password=String(req.body.password||''); const clubName=String(req.body.clubName||'Aurora FC').trim().slice(0,32); const coach=String(req.body.coach||'Técnico').trim().slice(0,40);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({error:'Informe um e-mail válido.'});
  if(password.length<10||password.length>128) return res.status(400).json({error:'Sua senha precisa ter pelo menos 10 caracteres.'});
  if(db.prepare('SELECT id FROM users WHERE email=?').get(email)) return res.status(409).json({error:'Este e-mail já possui uma conta.'});
  const user=db.prepare('INSERT INTO users (email,password_hash) VALUES (?,?)').run(email,bcrypt.hashSync(password,12));
  const teamId=setup({userId:user.lastInsertRowid,clubName:clubName||'Aurora FC',coach:coach||'Técnico'});
  const token=issueSession(user.lastInsertRowid); return res.status(201).json({token,dashboard:safeTeam(teamId)});
});
app.post('/api/auth/login',(req,res)=>{const email=String(req.body.email||'').trim().toLowerCase();const user=db.prepare('SELECT * FROM users WHERE email=?').get(email);if(!user||!bcrypt.compareSync(String(req.body.password||''),user.password_hash))return res.status(401).json({error:'E-mail ou senha incorretos.'});return res.json({token:issueSession(user.id),dashboard:safeTeam(getTeam(user.id).id)});});
app.post('/api/auth/logout',auth,(req,res)=>{db.prepare('DELETE FROM sessions WHERE token_hash=?').run(req.tokenHash);res.json({ok:true});});
app.get('/api/dashboard',auth,(req,res)=>{const team=getTeam(req.userId);if(!team)return res.status(404).json({error:'Time não encontrado.'});res.json(safeTeam(team.id));});
app.get('/api/players',auth,(req,res)=>res.json({players:getPlayers(getTeam(req.userId).id)}));
app.patch('/api/players/:id/lineup',auth,(req,res)=>{const t=getTeam(req.userId);const p=db.prepare('SELECT * FROM players WHERE id=? AND team_id=?').get(Number(req.params.id),t.id);if(!p)return res.status(404).json({error:'Jogador não encontrado.'});if(Boolean(req.body.starter)&&!p.is_starter&&db.prepare('SELECT COUNT(*) AS c FROM players WHERE team_id=? AND is_starter=1').get(t.id).c>=11)return res.status(400).json({error:'A escalação já está completa. Tire um jogador antes de adicionar outro.'});db.prepare('UPDATE players SET is_starter=? WHERE id=?').run(req.body.starter?1:0,p.id);res.json({players:getPlayers(t.id)});});
app.patch('/api/players/:id/training',auth,(req,res)=>{const valid=['Finalização','Passe','Velocidade','Físico','Marcação','Técnica','Drible','Cruzamento','Reflexos','Descanso'];if(!valid.includes(req.body.training))return res.status(400).json({error:'Treino inválido.'});const t=getTeam(req.userId);const p=db.prepare('SELECT * FROM players WHERE id=? AND team_id=?').get(Number(req.params.id),t.id);if(!p)return res.status(404).json({error:'Jogador não encontrado.'});if(req.body.training==='Descanso')db.prepare('UPDATE players SET training=?,morale=MIN(100,morale+3),stamina=MIN(100,stamina+10) WHERE id=?').run(req.body.training,p.id);else db.prepare('UPDATE players SET training=?,training_xp=training_xp+1,rating=MIN(potential,rating+CASE WHEN training_xp%3=2 THEN 1 ELSE 0 END),morale=MIN(100,morale+2) WHERE id=?').run(req.body.training,p.id);res.json({player:db.prepare('SELECT * FROM players WHERE id=?').get(p.id)});});
app.patch('/api/team/tactics',auth,(req,res)=>{const formations=['4-3-3','4-2-3-1','4-4-2','3-5-2'];const styles=['Equilibrado','Posse de bola','Pressão alta','Contra-ataque'];if(!formations.includes(req.body.formation)||!styles.includes(req.body.style))return res.status(400).json({error:'Formação ou estilo tático inválido.'});db.prepare('UPDATE teams SET formation=?,style=? WHERE user_id=?').run(req.body.formation,req.body.style,req.userId);res.json({formation:req.body.formation,style:req.body.style});});
app.get('/api/matches',auth,(req,res)=>{const id=getTeam(req.userId).id;res.json({matches:db.prepare('SELECT * FROM matches WHERE team_id=? ORDER BY match_date DESC').all(id)});});
app.post('/api/matches/:id/play',auth,(req,res)=>{const team=getTeam(req.userId);const match=db.prepare('SELECT * FROM matches WHERE id=? AND team_id=?').get(Number(req.params.id),team.id);if(!match)return res.status(404).json({error:'Partida não encontrada.'});if(match.status!=='upcoming')return res.status(409).json({error:'Essa partida já foi realizada.'});const starters=db.prepare('SELECT * FROM players WHERE team_id=? AND is_starter=1').all(team.id);let strength=starters.reduce((a,p)=>a+p.rating,0)/Math.max(starters.length,1);let morale=starters.reduce((a,p)=>a+p.morale,0)/Math.max(starters.length,1);strength+=({Equilibrado:0,'Posse de bola':.6,'Pressão alta':.4,'Contra-ataque':.2})[team.style]||0;const roll=Math.random();const performance=(strength-74)*.065+((morale-75)*.008)+(match.home?.15:0);const resultScore=roll+performance;let gf=Math.max(0,Math.min(5,Math.floor(Math.random()*3)+(resultScore>1?.2:0)));let ga=Math.max(0,Math.min(5,Math.floor(Math.random()*3)+(resultScore<1?.3:0)));if(resultScore>1.25&&gf<=ga)gf=ga+1;if(resultScore<.65&&ga<=gf)ga=gf+1;if(resultScore>=.65&&resultScore<=1.25&&gf!==ga){const mid=Math.max(gf,ga);gf=mid;ga=mid;}const goalscorers=[...starters.filter(p=>['ST','LW','RW','CAM'].includes(p.position))].sort((a,b)=>(b.rating+b.morale*.08)-(a.rating+a.morale*.08));const scorerChanges=[];for(let i=0;i<gf;i++){if(goalscorers.length){const p=goalscorers[i%goalscorers.length];db.prepare('UPDATE players SET goals=goals+1,morale=MIN(100,morale+2),stamina=MAX(55,stamina-7) WHERE id=?').run(p.id);scorerChanges.push(p.id);}}const success=db.transaction(()=>{db.prepare("UPDATE matches SET status='played',goals_for=?,goals_against=? WHERE id=?").run(gf,ga,match.id);db.prepare('UPDATE teams SET played=played+1,wins=wins+?,draws=draws+?,losses=losses+?,goals_for=goals_for+?,goals_against=goals_against+?,credits=credits+? WHERE id=?').run(gf>ga?1:0,gf===ga?1:0,gf<ga?1:0,gf,ga,gf>ga?480000:gf===ga?210000:80000,team.id);for(const p of starters)if(!scorerChanges.includes(p.id))db.prepare('UPDATE players SET stamina=MAX(55,stamina-7) WHERE id=?').run(p.id);db.prepare("UPDATE players SET stamina=MIN(100,stamina+5), morale=MIN(100,morale+1) WHERE team_id=? AND is_starter=0").run(team.id);});success();res.json({match:db.prepare('SELECT * FROM matches WHERE id=?').get(match.id),dashboard:safeTeam(team.id)});});
app.get('/api/transfers',auth,(req,res)=>res.json({available:safeTeam(getTeam(req.userId).id).transferTargets,history:db.prepare('SELECT * FROM transfers WHERE team_id=? ORDER BY created_at DESC').all(getTeam(req.userId).id)}));
app.post('/api/transfers',auth,(req,res)=>{const team=getTeam(req.userId);const target=safeTeam(team.id).transferTargets.find(t=>t.name===req.body.playerName);if(!target)return res.status(404).json({error:'Esse atleta não está mais disponível.'});if(team.credits<target.value)return res.status(400).json({error:'Saldo insuficiente para fechar essa transferência.'});const id=db.prepare('INSERT INTO players (team_id,name,position,age,nationality,rating,potential,morale,stamina,training,is_starter,value) VALUES (?,?,?,?,?,?,?,76,90,\'Descanso\',0,?)').run(team.id,target.name,target.position,target.age,target.flag,target.rating,target.potential,target.value);db.prepare('UPDATE teams SET credits=credits-? WHERE id=?').run(target.value,team.id);db.prepare('INSERT INTO transfers (team_id,player_name,position,age,rating,fee,direction) VALUES (?,?,?,?,?,? ,\'in\')').run(team.id,target.name,target.position,target.age,target.rating,target.value);res.status(201).json({player:db.prepare('SELECT * FROM players WHERE id=?').get(id.lastInsertRowid),dashboard:safeTeam(team.id)});});
app.patch('/api/team/profile',auth,(req,res)=>{const name=String(req.body.name||'').trim().slice(0,32);const coach=String(req.body.coach||'').trim().slice(0,40);if(!name||!coach)return res.status(400).json({error:'Nome do clube e do técnico são obrigatórios.'});db.prepare('UPDATE teams SET name=?,coach=? WHERE user_id=?').run(name,coach,req.userId);res.json({dashboard:safeTeam(getTeam(req.userId).id)});});
app.get('/api/stats',auth,(req,res)=>{const d=safeTeam(getTeam(req.userId).id);res.json(d.stats);});
app.get('/api/tournaments',auth,(req,res)=>{const id=getTeam(req.userId).id;const matches=db.prepare('SELECT * FROM matches WHERE team_id=? ORDER BY match_date').all(id);res.json({competitions:[...new Set(matches.map(m=>m.competition))].map(name=>({name,matches:matches.filter(m=>m.competition===name)})),leaderboard:safeTeam(id).leaderboard});});
app.use('/api',(_req,res)=>res.status(404).json({error:'Rota não encontrada.'}));
app.use(express.static(path.join(__dirname,'public'),{setHeaders(res,filePath){if(/\.(?:html|js|css)$/i.test(filePath))res.setHeader('Cache-Control','no-cache');}}));
app.get('*path',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({error:'Algo deu errado. Tente novamente.'});});

app.listen(port,()=>console.log(`Aurora FC Manager disponível em http://localhost:${port}`));

// Digital Chen ER and boxed-row relational diagrams, derived from the base DDL.
// Run from the repository root: node scripts/generate-diagrams.mjs
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import sharp from 'sharp';

const sql = await readFile('database/mysql/01_schema.sql', 'utf8');
const tables = {};
for (const match of sql.matchAll(/CREATE TABLE (\w+) \(([\s\S]*?)\n\);/g)) {
  const [, name, ddl] = match;
  const columns = [...ddl.matchAll(/^\s{2}(\w+)\s+(INT|VARCHAR|ENUM|DECIMAL|TIMESTAMP|DATE|BOOLEAN|TINYINT|TEXT)\b([^\n]*)/gm)]
    .map(([, name, type, rest]) => ({ name, type, unique: /\bUNIQUE\b/.test(rest), inlinePK: /PRIMARY KEY/.test(rest) }));
  const pk = ddl.match(/PRIMARY KEY \(([^)]+)\)/)?.[1].split(',').map(x => x.trim()) || columns.filter(c => c.inlinePK).map(c => c.name);
  const fks = [...ddl.matchAll(/FOREIGN KEY \((\w+)\)\s+REFERENCES (\w+)\((\w+)\)\s+ON DELETE (CASCADE)/g)]
    .map(([, column, table, target, onDelete]) => ({ column, table, target, onDelete }));
  tables[name] = { columns, pk, fks };
}
assert.equal(Object.keys(tables).length, 10);
assert.equal(Object.values(tables).reduce((n, t) => n + t.fks.length, 0), 12);
assert.equal(Object.values(tables).reduce((n, t) => n + t.columns.length, 0), 41);
for (const table of Object.values(tables)) {
  for (const key of table.pk) assert.ok(table.columns.some(c => c.name === key));
  for (const fk of table.fks) {
    assert.ok(table.columns.some(c => c.name === fk.column));
    assert.ok(tables[fk.table].pk.includes(fk.target));
  }
}

const ink = '#172b4d';
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
let parts;
function start(width, height, title, description) {
  parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img"><title>${esc(title)}</title><desc>${esc(description)}</desc>`,
    `<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${ink}"/></marker></defs>`,
    `<rect width="100%" height="100%" fill="white"/>`,
    `<g fill="${ink}" font-family="Arial, Helvetica, sans-serif">`];
}
function text(x, y, value, { size = 27, bold = false, anchor = 'middle', underline = false } = {}) {
  parts.push(`<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle" font-size="${size}"${bold ? ' font-weight="700"' : ''}${underline ? ' text-decoration="underline"' : ''}>${esc(value)}</text>`);
}
function path(points, arrow = false) {
  parts.push(`<polyline points="${points.map(p => p.join(',')).join(' ')}" fill="none" stroke="${ink}" stroke-width="2.5"${arrow ? ' marker-end="url(#arrow)"' : ''}/>`);
}
function box(x, y, w, h) { parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="white" stroke="${ink}" stroke-width="3"/>`); }
function oval(x, y, value, pk = false) {
  parts.push(`<ellipse cx="${x}" cy="${y}" rx="140" ry="37" fill="white" stroke="${ink}" stroke-width="2.5"/>`);
  text(x, y, value, { size: 25, underline: pk });
}
function entity(x, y, name) { box(x - 130, y - 40, 260, 80); text(x, y, name, { size: 33, bold: true }); }
function diamond(x, y, name) {
  parts.push(`<polygon points="${x},${y - 65} ${x + 180},${y} ${x},${y + 65} ${x - 180},${y}" fill="white" stroke="${ink}" stroke-width="3"/>`);
  text(x, y, name, { size: 29 });
}
function heading(width, title, subtitle) {
  text(width / 2, 65, title, { size: 43, bold: true });
  text(width / 2, 115, subtitle, { size: 24 });
}
async function finish(stem) {
  const svg = parts.join('\n') + '</g></svg>\n';
  await writeFile(`docs/${stem}.svg`, svg);
  await sharp(Buffer.from(svg)).png().toFile(`docs/${stem}.png`);
}

// ER: same entity / oval / diamond notation and vertical relationship stack
// as the supplied drawing. Shared vertical lines are entity connector trunks.
start(3200, 3650, 'GameMatch — Entity–Relationship Diagram', 'Final base-schema model in Chen notation, including stored relationship attributes.');
heading(3200, 'GameMatch — ER Diagram', 'DBMS Level 3 Project · Section H · Team 15');
const attributes = {
  User: [[220,250],[880,250],[220,420],[220,590],[880,420],[880,590]],
  Game: [[2320,250],[2650,250],[2320,420],[2320,590],[2980,590],[2980,250],[2980,420]],
};
for (const [name, x] of [['User',550], ['Game',2650]]) {
  tables[name].columns.forEach((column, i) => path([[x,650], attributes[name][i]]));
  tables[name].columns.forEach((column, i) => oval(...attributes[name][i], column.name, tables[name].pk.includes(column.name)));
  entity(x,650,name);
}
path([[550,690],[550,2200]]);
path([[2650,690],[2650,3050]]);
const relationships = [
  ['Rates',1000,[[1270,850],[1600,850],[1930,850]]],
  ['Adds',1350,[[1600,1200]]],
  ['Owns',1700,[[1435,1550],[1765,1550]]],
  ['Recommends',2200,[[1100,2000],[1430,2000],[1760,2000],[2090,2000],[1435,2400],[1765,2400]]],
];
for (const [name, y, positions] of relationships) {
  path([[550,y],[1420,y]]); path([[1780,y],[2650,y]]);
  text(675,y-25,'M (0..*)',{size:23}); text(2520,y-25,'N (0..*)',{size:23});
  const columns = tables[name].columns.filter(c => !tables[name].pk.includes(c.name));
  assert.equal(columns.length, positions.length);
  columns.forEach((c,i) => path([[1600,y],positions[i]]));
  columns.forEach((c,i) => oval(...positions[i],c.name));
  diamond(1600,y,name);
}
for (const [name, relationship, y] of [['Genre','HasGenre',2700],['Platform','OnPlatform',3050]]) {
  const columns=tables[name].columns;
  const positions=[[220,y-110],[550,y-190]];
  columns.forEach((c,i)=>path([[550,y],positions[i]]));
  columns.forEach((c,i)=>oval(...positions[i],c.name,tables[name].pk.includes(c.name)));
  entity(550,y,name); diamond(1600,y,relationship);
  path([[680,y],[1420,y]]);path([[1780,y],[2650,y]]);
  text(810,y-25,'M (0..*)',{size:23});text(2520,y-25,'N (0..*)',{size:23});
}
box(170,3220,2860,360);
text(220,3270,'NOTATION AND IMPLEMENTATION NOTES',{anchor:'start',size:27,bold:true});
[
  'Rectangle = entity · Oval = attribute · Diamond = relationship · Underline = entity primary key.',
  'M:N relationships have optional participation (0..*) at both entity ends; trunks only route connectors.',
  'Each relationship occurrence identifies exactly one existing entity on each side; SQL junction keys enforce uniqueness.',
  'Username / email and Genre.name / Platform.name are UNIQUE, not the selected entity primary keys.',
  'No mongo_metadata_id exists in Game. MongoDB links use shared IDs, not cross-database SQL foreign keys.',
  'All base-schema timestamps are shown. See DATABASE_MODEL.md for SQL constraints and the separate MongoDB model.',
  'Game.avg_rating is a stored derived value maintained by the insert, update and delete triggers on Rates.',
].forEach((line,i)=>text(220,3320+i*37,line,{anchor:'start',size:23}));
await finish('er-diagram');

// Relational: horizontal attribute cells, underlined keys, explicit FK arrows.
start(3600,2540,'GameMatch — Relational Schema','All ten SQL tables, exact columns, composite primary keys, and twelve foreign-key mappings.');
heading(3600,'GameMatch — Relational Schema','Base schema: database/mysql/01_schema.sql · Underlined columns collectively form each table’s PK');
const layouts={User:[140,260,245],Game:[1850,260,225],Rates:[1000,620,300],Adds:[1000,870,300],Owns:[1000,1120,300],Recommends:[680,1450,280],Genre:[250,1820,310],Platform:[2560,1820,310],HasGenre:[920,2070,310],OnPlatform:[2070,2070,310]};
assert.deepEqual(Object.keys(layouts).sort(),Object.keys(tables).sort());
// Each FK starts at its actual attribute cell and terminates at a parent PK.
// Shared outside rails avoid running lines through the table bodies.
const userPK=140+245/2, gamePK=1850+225/2;
path([[70,1395],[70,185],[userPK,185],[userPK,260]],true);
path([[3530,1920],[3530,185],[gamePK,185],[gamePK,260]],true);
for(const name of ['Rates','Adds','Owns','Recommends']){
  const [x,y,w]=layouts[name];
  path([[x+w/2,y],[x+w/2,y-55],[70,y-55]]);
  path([[x+1.5*w,y],[x+1.5*w,y-95],[3530,y-95]]);
}
const [hx,hy,hw]=layouts.HasGenre;
path([[hx+hw/2,hy],[hx+hw/2,hy-150],[3530,hy-150]]);
path([[hx+1.5*hw,hy],[hx+1.5*hw,hy-65],[405,hy-65],[405,1900]],true);
const [ox,oy,ow]=layouts.OnPlatform;
path([[ox+ow/2,oy],[ox+ow/2,oy-300],[3530,oy-300]]);
path([[ox+1.5*ow,oy],[ox+1.5*ow,oy-65],[2715,oy-65],[2715,1900]],true);
for(const [name,[x,y,w]] of Object.entries(layouts)){
  const t=tables[name];
  text(x,y-(name==='Recommends'?135:25),name,{anchor:'start',bold:true,size:31});
  t.columns.forEach((column,i)=>{
    const cx=x+i*w;
    box(cx,y,w,80);
    text(cx+w/2,y+26,column.name,{size:25,underline:t.pk.includes(column.name)});
    const tags=[];
    if(t.pk.includes(column.name))tags.push('PK');
    if(t.fks.some(f=>f.column===column.name))tags.push('FK');
    if(column.unique)tags.push('UQ');
    text(cx+w/2,y+59,tags.join(' + ')||'attribute',{size:18});
  });
  if(t.fks.length){
    text(x,y+112,t.fks.map(f=>`${f.column} → ${f.table}.${f.target}`).join('  |  '),{anchor:'start',size:22});
    text(x,y+145,'Both FKs: NOT NULL · ON DELETE CASCADE',{anchor:'start',size:20});
  }
}
text(140,410,'UQ = UNIQUE. Username and email are separate unique keys.',{anchor:'start',size:22});
text(1850,410,'avg_rating is stored and maintained by triggers.',{anchor:'start',size:22});
box(140,2300,3320,170);
[
 'Each junction-table PK is the combination of BOTH underlined ID columns; neither ID alone is unique.',
 'Every junction row has exactly one parent on each side; a parent may have zero or many junction rows.',
 'All 12 FK mappings are stated beneath their tables. Arrows point to parent PKs; shared outside rails bundle references.',
 'Constraints / defaults / indexes / MongoDB associations: DATABASE_MODEL.md. Optional last_login ALTER demo is excluded.',
].forEach((line,i)=>text(180,2335+i*35,line,{anchor:'start',size:23}));
await finish('relational-schema');
await writeFile('docs/schema-model.json',JSON.stringify(tables,null,2)+'\n');
console.log('Generated two SVGs and two PNGs: 10 tables, 41 columns, 12 foreign keys.');


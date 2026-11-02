// Non-destructive, repeatable import of data/catalog.json into both databases.
import { readFile, mkdir, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { Int32 } from 'mongodb';
import { pool, getPool } from '../lib/mysql.js';
import { getDb } from '../lib/mongo.js';
import { computeForAll } from '../lib/recommend.js';

const { games }=JSON.parse(await readFile('data/catalog.json','utf8'));
assert.ok(games.length>=64);
assert.equal(new Set(games.map(g=>g.steam_app_id)).size,games.length);
// Validate everything before the first database write, including every image.
for(const game of games){
  assert.ok(game.title && game.publisher && Number.isFinite(game.base_price) && game.base_price>=0);
  assert.match(game.release_date,/^\d{4}-\d{2}-\d{2}$/);
  assert.ok(game.genres.length && game.platforms.length && game.metadata.description.length>=10);
  assert.ok(game.metadata.screenshots.length>=2);
  for(const image of game.metadata.screenshots){assert.match(image,/^\/images\/games\/\d+\/[\w-]+\.webp$/);await access('public'+image);}
}
const db=await getDb(),collection=db.collection('game_metadata');
const connection=await pool.getConnection();
const report={created:0,updatedArtwork:0,processed:0};
async function fingerprint(){
  const state=[];
  for(const query of ['SELECT user_id,username,email,role FROM User ORDER BY user_id','SELECT * FROM Rates ORDER BY user_id,game_id','SELECT * FROM Owns ORDER BY user_id,game_id','SELECT * FROM Adds ORDER BY user_id,game_id']){
    const[rows]=await connection.execute(query);state.push(rows);
  }
  return createHash('sha256').update(JSON.stringify(state)).digest('hex');
}
try{
  const[lock]=await connection.execute("SELECT GET_LOCK('gamematch_catalog_import',10) AS acquired");
  assert.equal(lock[0].acquired,1,'Another catalog import is running');
  const before=await fingerprint();
  for(const game of games){
    let oldMetadata,gameId,mongoWritten=false;
    try{
      await connection.beginTransaction();
      const sourced=await collection.findOne({'catalog_source.steam_app_id':game.steam_app_id});
      const[existing]=sourced
        ? await connection.execute('SELECT game_id FROM Game WHERE game_id=? FOR UPDATE',[Number(sourced.game_id)])
        : await connection.execute('SELECT game_id FROM Game WHERE title=? FOR UPDATE',[game.seed_title||game.title]);
      assert.ok(existing.length<=1,`Ambiguous game title: ${game.title}`);
      const created=existing.length===0;
      if(created){
        const[result]=await connection.execute('INSERT INTO Game (title,publisher,base_price,release_date) VALUES (?,?,?,?)',[game.title,game.publisher,game.base_price,game.release_date]);gameId=result.insertId;
        for(const [names,lookup,insert] of [
          [game.genres,'SELECT genre_id AS id FROM Genre WHERE name=?','INSERT INTO Genre (name) VALUES (?)'],
          [game.platforms,'SELECT platform_id AS id FROM Platform WHERE name=?','INSERT INTO Platform (name) VALUES (?)']
        ]){
          for(const name of names){
            let[rows]=await connection.execute(lookup,[name]);
            if(!rows.length){const[result]=await connection.execute(insert,[name]);rows=[{id:result.insertId}];}
            if(names===game.genres)await connection.execute('INSERT INTO HasGenre (game_id,genre_id) VALUES (?,?)',[gameId,rows[0].id]);
            else await connection.execute('INSERT INTO OnPlatform (game_id,platform_id) VALUES (?,?)',[gameId,rows[0].id]);
          }
        }
      }else gameId=existing[0].game_id;
      oldMetadata=await collection.findOne({game_id:gameId});
      // Existing descriptions, DLC, requirements, SQL prices/links and inactive
      // flags remain intact. This importer refreshes their artwork/provenance.
      const document={...game.metadata,...(oldMetadata||{}),game_id:new Int32(gameId),screenshots:game.metadata.screenshots,catalog_source:{...game.source,steam_app_id:game.steam_app_id}};
      await collection.replaceOne({game_id:gameId},document,{upsert:true});mongoWritten=true;
      await connection.commit();
      if(created)report.created++;else report.updatedArtwork++;
      report.processed++;
    }catch(error){
      if(mongoWritten){if(oldMetadata)await collection.replaceOne({game_id:gameId},oldMetadata,{upsert:true});else await collection.deleteOne({game_id:gameId});}
      await connection.rollback();throw error;
    }
  }
  assert.equal(await fingerprint(),before,'User, rating, purchase or wishlist data changed during the import');
  report.existingUserDataPreserved=true;
  report.recommendations=await computeForAll();
  const[counts]=await connection.execute('SELECT (SELECT COUNT(*) FROM Game) games,(SELECT COUNT(*) FROM Genre) genres,(SELECT COUNT(*) FROM Platform) platforms');
  report.database=counts[0];report.metadata=await collection.countDocuments();
  await mkdir('output',{recursive:true});await writeFile('output/catalog-import-results.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}catch(error){console.error('Catalog import failed:',{name:error.name,code:error.code,message:error.code?'Database operation failed':error.message});process.exitCode=1;}
finally{
  await connection.execute("SELECT RELEASE_LOCK('gamematch_catalog_import')");connection.release();await getPool().end();
  if(globalThis.gameMatchMongo)await(await globalThis.gameMatchMongo).close();
}

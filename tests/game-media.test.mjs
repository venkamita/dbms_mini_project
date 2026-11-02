import test from 'node:test';
import assert from 'node:assert/strict';
import { attachGameMedia } from '../lib/game-media.js';

test('media enrichment batches only selected game IDs and preserves ranking', async () => {
  let queries=0;
  globalThis.gameMatchMongo=Promise.resolve({db:()=>({collection:name=>{
    assert.equal(name,'game_metadata');
    return {find:(filter,options)=>{
      queries++;
      assert.deepEqual(filter,{game_id:{$in:[4,2,9]}});
      assert.equal(options.projection._id,0);
      return {toArray:async()=>[{game_id:2,screenshots:['/images/games/413150/cover.webp','/other.webp']},{game_id:4,screenshots:[]}]};
    }};
  }})});
  const result=await attachGameMedia([{game_id:4,title:'Celeste'},{game_id:2,title:'Stardew Valley'},{game_id:9,title:'Custom game'}]);
  assert.equal(queries,1);
  assert.deepEqual(result.map(row=>row.game_id),[4,2,9]);
  assert.deepEqual(result.map(row=>row.cover_image),[null,'/images/games/413150/cover.webp',null]);
});

test('empty catalog/media results need no MongoDB connection', async () => {
  delete globalThis.gameMatchMongo;
  assert.deepEqual(await attachGameMedia([]),[]);
});

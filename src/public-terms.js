import {TERMS,TERMS_HASH} from './terms.js';

export const PUBLIC_TERMS_KEY='spinout_public_terms_v1';
export function parsePublicAcceptance(raw){
 try{
  const value=JSON.parse(raw);
  return value?.version===TERMS.version&&value?.contentHash===TERMS_HASH&&
   value?.scope==='public-features'&&value?.agreed===true&&
   typeof value.acceptedAt==='string'&&Number.isFinite(Date.parse(value.acceptedAt))?value:null;
 }catch{return null;}
}
export function readPublicAcceptance(storage){
 try{return parsePublicAcceptance(storage.getItem(PUBLIC_TERMS_KEY));}catch{return null;}
}
export function savePublicAcceptance(storage,now=new Date()){
 const receipt={version:TERMS.version,contentHash:TERMS_HASH,scope:'public-features',agreed:true,acceptedAt:now.toISOString()};
 try{storage.setItem(PUBLIC_TERMS_KEY,JSON.stringify(receipt));return {receipt,persisted:true};}
 catch{return {receipt,persisted:false};}
}

import { load } from 'cheerio/slim';
const tidy=v=>String(v||'').replace(/\s+/g,' ').trim();
const offerPattern=/\b(?:discount|coupon|promo(?:tion)?|early[- ]bird|sale|special (?:price|offer|rate)|save\s*(?:\$|\d))|\d+\s*%\s*off|\$\s*\d+(?:\.\d+)?\s*off/i;
const excludedPrice=/gate fee|spectator|camping|transponder|rental|shipping|administration fee|insurance|passenger/i;
export function offerExpiry(text) {
 const date=text.match(/(?:until|ends?|expires?|through|before|by)\s*:?[ ]*(\d{4}-\d{2}-\d{2}|[A-Za-z]+\s+\d{1,2},?\s+20\d{2}|\d{1,2}\/\d{1,2}\/20\d{2})/i)?.[1];
 if(!date)return null;
 const parsed=new Date(date+' 12:00:00 UTC');
 return Number.isNaN(+parsed)?null:parsed.toISOString().slice(0,10);
}
export function extractOffers(html,{url,sourceId,today,checkedAt=new Date().toISOString()}={}) {
 const $=load(html||'');$('script,style,nav,footer,header,.navbar,input,button,select').remove();
 const main=$('main,article,#event-description,.event-description').first();const root=main.length?main:$.root();
 root.find('br').replaceWith('\n');root.find('p,li,h1,h2,h3,h4,tr,div,section').append('\n');
 const lines=root.text().split(/[\r\n]+/).map(tidy).filter(s=>s.length>2&&s.length<1800);
 const promotions=[],prices=[];
 for(const line of lines){
  const entry={text:line.slice(0,180),sourceUrl:url,sourceId,checkedAt};
  if(offerPattern.test(line)&&!excludedPrice.test(line)&&!/\bno (?:discount|coupon|promo)|discounts? (?:are )?(?:not|unavailable)|enter (?:a )?(?:coupon|promo)(?:tion)? code\s*$/i.test(line)){
   const expiresOn=offerExpiry(line);if(!expiresOn||!today||expiresOn>=today)promotions.push({...entry,...(expiresOn?{expiresOn}:{})});
  }
  if(/\$\s*\d/.test(line)&&/^(?:price|entry|registration|hpde|track.?day|early[- ]bird|from\s*\$)|(?:registration|entry|hpde)\s*(?:fee|price|cost|rate)/i.test(line)&&!excludedPrice.test(line))prices.push(entry);
 }
 const unique=a=>[...new Map(a.map(x=>[x.text.toLowerCase(),x])).values()].slice(0,3);
 return {promotions:unique(promotions),prices:unique(prices)};
}
export function activeOffers(offers,today){return (offers||[]).filter(x=>!x.expiresOn||x.expiresOn>=today);}
export function combineOffers(a=[],b=[]){return [...new Map([...a,...b].map(x=>[x.sourceUrl+'|'+x.text.toLowerCase(),x])).values()].slice(0,5);}

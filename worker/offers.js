import { load } from 'cheerio/slim';
const tidy=v=>String(v||'').replace(/\s+/g,' ').trim();
const offerPattern=/\b(?:discount|coupon|promo(?:tion)?|early[- ]bird|sale (?:price|pricing)|sale\s*:\s*\$|special (?:price|offer|rate)|save\s*(?:\$|\d))|\d+\s*%\s*off|\$\s*\d+(?:\.\d+)?\s*off/i;
const excludedPrice=/gate fee|spectator|camping|transponder|rental|shipping|administration fee|insurance|passenger/i;
const isOffer=text=>offerPattern.test(text)&&!excludedPrice.test(text)&&!/^(?:discounts? available|sale (?:price|pricing))\s*[!:.]*$/i.test(text)&&!/\bno (?:discount|coupon|promo)|discounts? (?:are )?(?:not|unavailable)|enter (?:a )?(?:coupon|promo)(?:tion)? code\s*$/i.test(text);
export function offerExpiry(text) {
 let date=text.match(/(?:until|ends?|expires?|through|before|by)\s*:?[ ]*(\d{4}-\d{2}-\d{2}|[A-Za-z]+\s+\d{1,2},?\s+20\d{2}|\d{1,2}\/\d{1,2}\/(?:20\d{2}|\d{2})\b)/i)?.[1];
 if(!date)return null;
 date=date.replace(/^(\d{1,2}\/\d{1,2}\/)\s*(\d{2})$/,'$120$2');
 const parsed=new Date(date+' 12:00:00 UTC');
 return Number.isNaN(+parsed)?null:parsed.toISOString().slice(0,10);
}
export function extractOffers(html,{url,sourceId,today,checkedAt=new Date().toISOString()}={}) {
 const $=load(html||'');$('script,style,nav,footer,header,.navbar,input,button,select').remove();
 const main=$('main,article,#event-description,.event-description').first();const root=main.length?main:$.root();
 root.find('br').replaceWith('\n');root.find('td,th').append(' ');root.find('p,li,h1,h2,h3,h4,tr,div,section').append('\n');
 const lines=root.text().split(/[\r\n]+/).map(tidy).filter(s=>s.length>2&&s.length<1800);
 const promotions=[],prices=[];
 for(const line of lines){
  const entry={text:line.slice(0,180),sourceUrl:url,sourceId,checkedAt};
  const expiresOn=offerExpiry(line);if(expiresOn&&today&&expiresOn<today)continue;
  if(isOffer(line)){
   promotions.push({...entry,...(expiresOn?{expiresOn}:{})});
  }
  if(/\$\s*\d/.test(line)&&/^(?:price|entry|registration|hpde|track.?day|early[- ]bird|from\s*\$)|(?:registration|entry|hpde)\s*(?:fee|price|cost|rate)/i.test(line)&&!excludedPrice.test(line))prices.push({...entry,...(expiresOn?{expiresOn}:{})});
 }
 const unique=a=>[...new Map(a.map(x=>[x.text.toLowerCase(),x])).values()].slice(0,3);
 return {promotions:unique(promotions),prices:unique(prices)};
}
export function activeOffers(offers,today){return (offers||[]).filter(x=>!x.expiresOn||x.expiresOn>=today);}
export function publishedOffers(offers,today){return activeOffers(offers,today).filter(x=>isOffer(x.text));}
export function combineOffers(a=[],b=[]){return [...new Map([...a,...b].map(x=>[x.sourceUrl+'|'+x.text.toLowerCase(),x])).values()].slice(0,5);}

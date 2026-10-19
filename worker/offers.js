import { load } from 'cheerio/slim';
const tidy=v=>String(v||'').replace(/\s+/g,' ').trim();
const offerPattern=/\b(?:discount|coupon|promo(?:tion)?|early[- ]bird|sale (?:price|pricing)|sale\s*:\s*\$|special (?:price|offer|rate)|save\s*(?:\$|\d))|\d+\s*%\s*off|\$\s*\d+(?:\.\d+)?\s*off/i;
const excludedPrice=/gate fee|spectator|camping|transponder|rental|shipping|administration fee|insurance|passenger/i;
const isOffer=text=>offerPattern.test(text)&&!excludedPrice.test(text)&&!/^(?:discounts? available|(?:discount|coupon|promo(?:tion)?) code|sale (?:price|pricing))\s*[!:.]*$/i.test(text)&&!/\bno (?:discount|coupon|promo)|discounts? (?:are )?(?:not|unavailable)|enter (?:a )?(?:coupon|promo)(?:tion)? code\s*$/i.test(text)&&!/membership program|join (?:our|the) membership|gear store|driver and .*gear|merchandise|newsletter/i.test(text);
export function offerDeadline(text,eventDate) {
 const raw=text.match(/(?:until|ends?|expires?|through|before|by)\s*:?[ ]*(\d{4}-\d{2}-\d{2}|[A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+20\d{2})?|\d{1,2}\/\d{1,2}\/(?:20\d{2}|\d{2})\b)/i)?.[1];
 if(!raw){
  const relative=text.match(/(?:more than|at least)\s+(\d+)\s+days?\s+(?:ahead|before)/i)||text.match(/ends?\s+(\d+|one|two|three)\s+(days?|weeks?)\s+before (?:the )?event/i);
  if(eventDate&&relative){const days=(Number(relative[1])||({one:1,two:2,three:3}[relative[1].toLowerCase()]))*(/weeks?/i.test(relative[2]||'')?7:1);return {date:new Date(Date.parse(eventDate+'T12:00:00Z')-days*86400000).toISOString().slice(0,10),invalid:false};}
  return {date:null,invalid:false};
 }
 let year,month,day,explicit=true,m;
 if((m=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/))) [year,month,day]=m.slice(1).map(Number);
 else if((m=raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/))) {month=+m[1];day=+m[2];year=+m[3]+(m[3].length===2?2000:0);}
 else if((m=raw.match(/^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(20\d{2}))?$/))) {month=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[1].slice(0,3).toLowerCase())+1;day=+m[2];explicit=!!m[3];year=+(m[3]||eventDate?.slice(0,4)||2000);}
 else return {date:null,invalid:true};
 let d=new Date(Date.UTC(year,month-1,day));
 if(!month||d.getUTCFullYear()!==year||d.getUTCMonth()!==month-1||d.getUTCDate()!==day)return {date:null,invalid:true};
 if(!explicit&&eventDate&&d.toISOString().slice(0,10)>eventDate){year--;d=new Date(Date.UTC(year,month-1,day));if(d.getUTCMonth()!==month-1||d.getUTCDate()!==day)return {date:null,invalid:true};}
 return {date:explicit||eventDate?d.toISOString().slice(0,10):null,invalid:false};
}
export function offerExpiry(text,eventDate) {return offerDeadline(text,eventDate).date;}
export function extractOffers(html,{url,sourceId,today,eventDate,checkedAt=new Date().toISOString()}={}) {
 const $=load(html||'');$('script,style,nav,footer,header,.navbar,input,button,select').remove();
 const main=$('main,article,#event-description,.event-description').first();const root=main.length?main:$.root();
 root.find('br').replaceWith('\n');root.find('td,th').append(' ');root.find('p,li,h1,h2,h3,h4,tr,div,section').append('\n');
 const lines=root.text().split(/[\r\n]+/).map(tidy).filter(s=>s.length>2&&s.length<1800);
 const promotions=[],prices=[];
 for(const line of lines){
  const entry={text:line.slice(0,180),sourceUrl:url,sourceId,checkedAt};
  const deadline=offerDeadline(line,eventDate),expiresOn=deadline.date;if(deadline.invalid||(expiresOn&&today&&expiresOn<today))continue;
  if(isOffer(line)){
   promotions.push({...entry,...(expiresOn?{expiresOn}:{})});
  }
  if(/\$\s*\d/.test(line)&&/^(?:price|entry|registration|hpde|track.?day|early[- ]bird|from\s*\$)|(?:registration|entry|hpde)\s*(?:fee|price|cost|rate)/i.test(line)&&!excludedPrice.test(line))prices.push({...entry,...(expiresOn?{expiresOn}:{})});
 }
 const unique=a=>[...new Map(a.map(x=>[x.text.toLowerCase(),x])).values()].slice(0,3);
 return {promotions:unique(promotions),prices:unique(prices)};
}
export function activeOffers(offers,today,eventDate){return (offers||[]).filter(x=>{const d=offerDeadline(x.text,eventDate);return (!x.expiresOn||x.expiresOn>=today)&&!d.invalid&&(!d.date||d.date>=today);});}
export function publishedOffers(offers,today,eventDate){return activeOffers(offers,today,eventDate).filter(x=>isOffer(x.text));}
export function combineOffers(a=[],b=[]){return [...new Map([...a,...b].map(x=>[x.sourceUrl+'|'+x.text.toLowerCase(),x])).values()].slice(0,5);}

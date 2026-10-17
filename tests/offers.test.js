import test from 'node:test';
import assert from 'node:assert/strict';
import {extractOffers,offerExpiry} from '../worker/offers.js';
import {enrichEvents,parseSpeedSF,parseSpeedVentures} from '../worker/events.js';
const options={url:'https://www.speedventures.com/events/Detail.aspx?id=1',sourceId:'speedventures',today:'2026-10-17',checkedAt:'2026-10-17T12:00:00Z'};
test('published discounts preserve conditions and deadlines; fees are not entry prices',()=>{
 const result=extractOffers('<main><p>Early bird registration $250; use code GRID50 until October 20, 2026.</p><p>Price: $300</p><p>Gate fee: $10 per person</p><p>Camping $25</p><p>Save $10 on camping</p></main>',options);
 assert.equal(result.promotions.length,1);assert.equal(result.promotions[0].expiresOn,'2026-10-20');assert.match(result.promotions[0].text,/GRID50/);assert.equal(result.promotions[0].sourceUrl,options.url);
 assert.ok(result.prices.some(p=>p.text==='Price: $300'));assert.ok(result.prices.every(p=>!/gate|camping/i.test(p.text)));
 assert.equal(offerExpiry('Save $50 through 2026-10-20'),'2026-10-20');
});
test('expired offers, generic coupon inputs and global footer ads are excluded',()=>{
 const r=extractOffers('<main><p>Discount $20 expires October 10, 2026</p><p>Enter a promo code</p><p>No discounts available.</p></main><footer>Save $100 with OURCODE</footer>',options);assert.equal(r.promotions.length,0);
});
test('listing prices and dated special components stay attached to the correct event day',()=>{
 const sv=parseSpeedVentures('<section id="getonthetrack"><div><h4>Buttonwillow Classic</h4><span>October 24 - 25, 2026</span><span>$275</span><a class="absolutelink" href="Detail.aspx?id=1"></a></div></section>');assert.equal(sv[0].prices[0].text,'Listed $275');
 const sf=parseSpeedSF('<div class="ssf-card"><div class="ssf-card-title">Laguna Seca</div><div class="ssf-card-date">Nov 28–29</div><div class="ssf-comp-row"><span class="ssf-comp-name">S2000 Meet — Nov 28, 2026</span><span class="ssf-badge">Special</span></div><a class="ssf-reg-btn" href="https://www.motorsportreg.com/events/test">Register</a></div>',2026);
 assert.equal(sf.length,2);assert.equal(sf[0].specials.length,1);assert.equal(sf[1].specials.length,0);
});
test('successful detail refresh clears removed discounts; failures label retained evidence stale',async()=>{
 const original=globalThis.fetch;const url=options.url;
 const e={url,date:'2099-01-01',sources:[{id:'speedventures'}]};const previous={[url]:{checkedAt:'2020-01-01T00:00:00Z',status:'ok',promotions:[{text:'Save $50 with OLD',sourceUrl:url,checkedAt:'2020-01-01T00:00:00Z'}]}};
 try{
  globalThis.fetch=async()=>new Response('<main><p>Price: $300</p></main>');
  const cleared=await enrichEvents([e],previous,'2026-10-17');assert.equal(cleared.events[0].promotions.length,0);
  globalThis.fetch=async()=>new Response('unavailable',{status:503});
  const failed=await enrichEvents([e],previous,'2026-10-17');assert.equal(failed.events[0].promotions[0].stale,true);assert.equal(failed.events[0].promotions[0].checkedAt,'2020-01-01T00:00:00Z');
 }finally{globalThis.fetch=original;}
});
test('detail checks are bounded, rotate unchecked URLs first and reject untrusted hosts',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{globalThis.fetch=async()=>{calls++;return new Response('<main>No offer published</main>');};
  const events=Array.from({length:26},(_,i)=>({url:`https://www.speedventures.com/events/Detail.aspx?id=${i}`,date:'2099-01-01',sources:[{id:'speedventures'}]}));
  events.push({url:'https://untrusted.test/discount',sources:[],date:'2099-01-01'});
  const first=await enrichEvents(events,{},'2026-10-17');assert.equal(calls,24);assert.equal(first.offerCoverage.total,26);
  const second=await enrichEvents(events,first.detailCache,'2026-10-17');assert.equal(calls,26);assert.equal(second.offerCoverage.checked,26);
 }finally{globalThis.fetch=original;}
});

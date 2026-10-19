// Public organizer links from the club compilation, checked against current sites.
// Historical dates and private club material are deliberately excluded.
export const ORGANIZERS = [
  {id:'nasa',name:'NASA',url:'https://members.drivenasa.com/events',adapter:'nasa'},
  {id:'speedventures',name:'Speed Ventures',url:'https://www.speedventures.com/events/Default.aspx',adapter:'speedventures'},
  {id:'extremespeed',name:'Extreme Speed',url:'https://www.extremespeedtrackevents.com/event-registration',adapter:'extremespeed'},
  {id:'ongrid',name:'OnGrid',url:'https://www.ongridtrack.com/',adapter:'squarespace'},
  {id:'hookedondriving',name:'Hooked on Driving',url:'https://www.hookedondriving.com/track-days-schedule/',feedUrl:'https://www.motorsportreg.com/orgs/hooked-on-driving/california',adapter:'msr'},
  {id:'speeddistrict',name:'Speed District',url:'https://speeddistrict.com/events/',adapter:'speeddistrict'},
  {id:'speedsf',name:'SpeedSF',url:'https://www.speedsf.com/events-registration/',adapter:'speedsf'},
  {id:'viptrackdays',name:'VIP Track Days',url:'https://www.instagram.com/viptrackdays/',note:'Instagram announcements'},
  {id:'tracked',name:'TRACKED.llc',url:'https://www.tracked.llc/',note:'Schedule unavailable'},
  {id:'slipangle',name:'Slip Angle Track Events',url:'https://www.motorsportreg.com/orgs/slip-angle-track-events',adapter:'msr'},
  {id:'fastlane',name:'FastLane Racing School',url:'https://www.raceschool.com/experiences/track-days/',note:'Standalone track days not offered'},
  {id:'turn8',name:'Turn8',url:'https://www.turn8racing.com/',adapter:'wix'},
  {id:'touge2track',name:'Touge2Track',url:'https://touge2track.com/',note:'Schedule unavailable'},
  {id:'socaldriversclub',name:'SoCal Drivers Club',url:'https://www.socaldriversclub.com/event-registration',adapter:'sdc'},
  {id:'fasttoys',name:'Fast Toys Club',url:'https://www.fasttoysclub.com/fast-toys-track-days/',feedUrl:'https://www.motorsportreg.com/orgs/fast-toys-club',adapter:'msr'},
  {id:'westcoast',name:'West Coast Racing',url:'https://www.westcoastracinginc.com/events',adapter:'squarespace'}
];
export const CALENDAR_TRACKS = [
  {name:'Big Willow',region:'SoCal'}, {name:'Streets of Willow',region:'SoCal'},
  {name:'Buttonwillow',region:'SoCal'}, {name:'Buttonwillow · Classic',region:'SoCal'}, {name:'Buttonwillow · Circuit',region:'SoCal'},
  {name:'Chuckwalla',region:'SoCal'}, {name:'Laguna Seca',region:'NorCal'}, {name:'Sonoma',region:'NorCal'},
  {name:'Thunderhill',region:'NorCal'}, {name:'Thunderhill · East',region:'NorCal'}, {name:'Thunderhill · West',region:'NorCal'},
  {name:'Thunderhill · East & West',region:'NorCal'}, {name:'Thunderhill · 5 mile',region:'NorCal'}, {name:'Thunderhill · 3 & 5 mile',region:'NorCal'},
  {name:'Spring Mountain',region:'Nevada'}, {name:'Las Vegas Motor Speedway',region:'Nevada'}
];
export function canonicalOrganizer(value) {
  const key=String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  // Buttonwillow's Canyon Run Racing listing links to canyonrunsundays.com.
  if (['canyonrun','canyonrunracing','canyonrunsunday','canyonrunsundays'].includes(key)) return 'Canyon Run Sundays';
  const aliases={speedventuresoperationsllc:'Speed Ventures',speedventure:'Speed Ventures',speedventures:'Speed Ventures',speedsfcom:'SpeedSF',speedsf:'SpeedSF',extremespeedtrackevents:'Extreme Speed',extremespeed:'Extreme Speed',ongridtrack:'OnGrid',ongrid:'OnGrid',sdc:'SoCal Drivers Club',southerncaldriversclub:'SoCal Drivers Club',socaldriverclub:'SoCal Drivers Club',socaldriversclub:'SoCal Drivers Club',westcoastracinginc:'West Coast Racing',westcoastracing:'West Coast Racing',hookedondrivingcalifornia:'Hooked on Driving',hookedondriving:'Hooked on Driving',turn8trackdays:'Turn8',turn8racing:'Turn8',turn8:'Turn8',trackedllc:'TRACKED.llc'};
  return aliases[key]||String(value||'').trim();
}

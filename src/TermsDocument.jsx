import React from 'react';
import {TERMS} from './terms.js';

function emphasize(text,phrases=[]){
 const matches=phrases.flatMap(phrase=>{const start=text.indexOf(phrase);return start<0?[]:[{start,end:start+phrase.length,phrase}];}).sort((a,b)=>a.start-b.start);
 let cursor=0;const parts=[];
 for(const match of matches){if(match.start<cursor)continue;parts.push(text.slice(cursor,match.start));parts.push(<strong className="terms-important" key={match.start}>{match.phrase}</strong>);cursor=match.end;}
 parts.push(text.slice(cursor));return parts;
}
export default function TermsDocument({document:documentTerms=TERMS}){
 return <article className="terms-document"><p className="terms-meta">Version {documentTerms.version} · Published {documentTerms.effectiveDate}</p>{documentTerms.sections.map(section=><section key={section.title}><h2>{section.title}</h2>{section.paragraphs.map((p,i)=><p key={i}>{emphasize(p,section.emphasis)}</p>)}</section>)}<p><a href="/contact">Report or contact the operator</a></p><p className="terms-end">End of Terms of Use</p></article>;
}

import React from 'react';
import './club-graphics.css';

// Outline and visor traced in manufacturer-photo coordinates, not a generic
// invented helmet. Source: Bell GP3 Sport, see GRAPHICS.md. No brand marks.
export default function ClubArtwork({kind,className=''}) {
 if(kind!=='helmet')return null;
 return <div className={`club-artwork club-artwork-helmet ${className}`} aria-hidden="true">
  <svg viewBox="110 115 810 810" fill="none" focusable="false">
   <path className="helmet-shell" d="M218 378C239 318 259 265 278 239Q331 193 401 163L419 149 447 144 452 134 477 137 482 145C592 128 731 169 817 265C873 330 902 414 898 493Q898 576 867 648L836 690 818 711 488 851C345 914 206 902 164 870Q144 854 157 819L174 795 153 750 145 696Q138 675 148 650L145 630Q146 611 159 592L163 572Z"/>
   <path className="helmet-seal" d="M173 794Q152 826 163 851C196 902 348 896 485 840L817 700 837 682"/>
   <path className="helmet-visor" d="M216 378C355 380 508 397 635 413L698 403Q721 398 738 415L745 442Q741 463 715 476L682 498 655 541 641 575 624 593C482 623 271 633 173 607Q150 594 161 569Z"/>
   <path className="helmet-window" d="M202 454L600 476Q618 480 607 504L595 547Q585 575 566 582C413 608 250 613 179 587Q172 581 182 562L200 522Z"/>
   <path className="helmet-detail" d="M164 590C258 624 485 616 625 584M150 616C250 648 477 633 622 604M200 446C336 459 494 468 613 473M279 241 306 226M419 148 444 149M524 243 547 211 557 204 545 244 527 273 509 273Z"/>
   <path className="helmet-vent" d="M267 634L327 634 330 642 262 653 258 649ZM353 761 438 742Q448 740 449 751L441 758 355 778Q345 776 348 768ZM163 607 174 611 168 632 158 620Z"/>
   <circle className="helmet-hardware" cx="714" cy="431" r="23"/><circle className="helmet-hardware" cx="664" cy="446" r="15"/><circle className="helmet-hardware" cx="623" cy="558" r="14"/>
   <circle className="helmet-detail" cx="653" cy="509" r="10"/><circle className="helmet-detail" cx="709" cy="581" r="7"/>
  </svg>
 </div>;
}

export function ClubHero({eyebrow,title,description,kind,aside,children}) {
 return <div className="club-hero">
  <div className="club-hero-copy"><p className="club-hero-eyebrow">{eyebrow}</p><h1>{title}<span>.</span></h1>{description&&<p className="club-hero-description">{description}</p>}{children}</div>
  {aside?<div className="club-hero-aside">{aside}</div>:kind==='helmet'?<ClubArtwork kind="helmet"/>:null}
 </div>;
}

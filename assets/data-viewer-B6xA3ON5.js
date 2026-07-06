import{j as c,f as tt,O as et,r as l,C as nt,L as at,P as j,Q as Y,R as q,i as z,S as rt,o as N,n as F,p as ot}from"./index-DNPLd-Qj.js";import{C as Q,f as it}from"./comment-section-zPFPDmZh.js";import{I as ct}from"./ImageLightbox-DMqVSRGA.js";import"./Button-BCQavCPd.js";import"./Select-CZ8KZhWW.js";import"./createSvgIcon-Cnq6ga-b.js";function K(p){if(!p||p.length===0)return"00000000";let t=2166136261;for(let n=0;n<p.length;n++)t^=p.charCodeAt(n),t=t*16777619>>>0;return Math.abs(t).toString(36).padStart(8,"0").slice(-8).toUpperCase()}function st(p){return K(p.content)}function pt(p,t){const n=t>0?p[t-1].content:"",m=t<p.length-1?p[t+1].content:"";return{prev:K(n),next:K(m)}}function lt(p,t,n,m){const y=n[m];if(!y)throw new Error("Cannot create paragraph location for missing paragraph.");return{bookId:p,chapterId:t,paragraphIndex:m,secondaryKey:st(y),tertiaryKey:pt(n,m)}}const dt=`const paragraphCommentButtonHitArea = document.createElement('div');
paragraphCommentButtonHitArea.className = 'paragraph-comment-button-hit-area';

const paragraphCommentButton = document.createElement('button');
paragraphCommentButton.type = 'button';
paragraphCommentButton.className = 'paragraph-comment-button';
paragraphCommentButton.setAttribute('aria-label', 'Add paragraph comment');
paragraphCommentButton.textContent = 'Comment';
paragraphCommentButtonHitArea.appendChild(paragraphCommentButton);
document.body.appendChild(paragraphCommentButtonHitArea);

let paragraphCommentTimer = null;
let activeParagraph = null;

function getParagraphFromEvent(event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return null;
  }

  return target.closest('p[data-paragraph-index]');
}

function hideParagraphCommentButton() {
  if (paragraphCommentTimer !== null) {
    window.clearTimeout(paragraphCommentTimer);
    paragraphCommentTimer = null;
  }

  if (activeParagraph) {
    activeParagraph.classList.remove('paragraph-comment-target');
  }

  activeParagraph = null;
  paragraphCommentButtonHitArea.classList.remove('is-visible');
}

function showParagraphCommentButton(paragraph) {
  activeParagraph = paragraph;
  activeParagraph.classList.add('paragraph-comment-target');

  const paragraphRect = paragraph.getBoundingClientRect();
  paragraphCommentButtonHitArea.classList.add('is-visible');
  const hitAreaWidth = paragraphCommentButtonHitArea.offsetWidth || 260;
  const centeredLeft = paragraphRect.left + paragraphRect.width / 2 - hitAreaWidth / 2 + window.scrollX;
  const maxLeft = Math.max(8, document.documentElement.clientWidth - hitAreaWidth - 8 + window.scrollX);
  const left = Math.min(Math.max(8 + window.scrollX, centeredLeft), maxLeft);
  const top = Math.max(8, paragraphRect.top - 52 + window.scrollY);

  paragraphCommentButtonHitArea.style.left = left + 'px';
  paragraphCommentButtonHitArea.style.top = top + 'px';
}

function scheduleParagraphCommentButton(paragraph) {
  if (activeParagraph === paragraph && paragraphCommentButtonHitArea.classList.contains('is-visible')) {
    return;
  }

  hideParagraphCommentButton();
  activeParagraph = paragraph;
  paragraphCommentTimer = window.setTimeout(function () {
    paragraphCommentTimer = null;
    showParagraphCommentButton(paragraph);
  }, 1000);
}

Array.from(document.querySelectorAll('p')).forEach(function (paragraph, index) {
  paragraph.setAttribute('data-paragraph-index', String(index));
});

function renderParagraphCommentCounts(countsByParagraphIndex) {
  Array.from(document.querySelectorAll('.paragraph-comment-count')).forEach(function (marker) {
    marker.remove();
  });

  if (!countsByParagraphIndex || typeof countsByParagraphIndex !== 'object') {
    return;
  }

  for (const [paragraphIndex, rawCount] of Object.entries(countsByParagraphIndex)) {
    const count = Number(rawCount);
    if (!Number.isFinite(count) || count <= 0) {
      continue;
    }

    const paragraph = document.querySelector('p[data-paragraph-index="' + paragraphIndex + '"]');
    if (!paragraph) {
      continue;
    }

    const marker = document.createElement('i');
    marker.className = 'paragraph-comment-count';
    marker.textContent = String(count);
    marker.setAttribute('aria-label', count === 1 ? '1 paragraph comment' : count + ' paragraph comments');
    paragraph.appendChild(marker);
  }
}

window.addEventListener('message', function (event) {
  if (event.data?.type !== 'paragraph-comment-counts-updated') {
    return;
  }

  renderParagraphCommentCounts(event.data.countsByParagraphIndex);
});

document.addEventListener('pointerover', function (event) {
  if (event.pointerType === 'touch') {
    return;
  }

  const paragraph = getParagraphFromEvent(event);
  if (!paragraph) {
    return;
  }

  scheduleParagraphCommentButton(paragraph);
});

document.addEventListener('pointerdown', function (event) {
  if (event.pointerType !== 'touch') {
    return;
  }

  const paragraph = getParagraphFromEvent(event);
  if (!paragraph) {
    return;
  }

  scheduleParagraphCommentButton(paragraph);
});

document.addEventListener('pointerout', function (event) {
  const relatedTarget = event.relatedTarget instanceof Node ? event.relatedTarget : null;
  if (
    !activeParagraph ||
    relatedTarget === paragraphCommentButtonHitArea ||
    paragraphCommentButtonHitArea.contains(relatedTarget)
  ) {
    return;
  }

  if (activeParagraph.contains(relatedTarget)) {
    return;
  }

  hideParagraphCommentButton();
});

document.addEventListener('pointerup', function (event) {
  if (event.pointerType === 'touch' && paragraphCommentTimer !== null) {
    hideParagraphCommentButton();
  }
});

document.addEventListener('scroll', hideParagraphCommentButton, { passive: true });

paragraphCommentButton.addEventListener('pointerdown', function (event) {
  event.stopPropagation();
});

paragraphCommentButtonHitArea.addEventListener('pointerover', function (event) {
  event.stopPropagation();
});

paragraphCommentButton.addEventListener('click', function (event) {
  event.preventDefault();
  event.stopPropagation();

  if (!activeParagraph) {
    return;
  }

  const paragraphIndex = Number(activeParagraph.getAttribute('data-paragraph-index'));
  if (!Number.isFinite(paragraphIndex)) {
    return;
  }

  window.parent.postMessage({ type: 'paragraph-comment-requested', paragraphIndex: paragraphIndex }, '*');
});

document.addEventListener('click', function (event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const trigger = target.closest('.chapter-image-trigger');
  if (!trigger) {
    return;
  }

  event.preventDefault();
  const imageId = trigger.getAttribute('data-image-id');
  if (!imageId) {
    return;
  }

  window.parent.postMessage({ type: 'chapter-image-clicked', imageId: imageId }, '*');
});
`,mt=()=>c.jsxs("div",{className:"mx-auto my-8 max-w-2xl rounded-2xl border border-slate-300/70 bg-white/80 p-6 font-sans shadow-sm dark:border-slate-700 dark:bg-slate-900/60",children:[c.jsx("h1",{className:"text-2xl mb-2",children:"Access Restricted"}),c.jsx("p",{className:"text-lg leading-relaxed m-0",children:"You need to log in to view this content. Please log in or create an account to continue."})]}),ht=()=>c.jsxs("div",{className:"mx-auto my-8 max-w-2xl rounded-2xl border border-slate-300/70 bg-white/80 p-6 font-sans shadow-sm dark:border-slate-700 dark:bg-slate-900/60",children:[c.jsx("h1",{className:"text-2xl mb-2",children:"Support me on Patreon"}),c.jsxs("p",{className:"text-lg leading-relaxed m-0",children:["To access the full content, please consider subscribing to me on"," ",c.jsx("a",{href:"https://www.patreon.com/BenisBoy16",target:"_blank",rel:"noopener noreferrer",className:"bg-[#872341] font-bold no-underline hover:underline",children:"Patreon"}),"."]})]}),vt=({scrollerRef:p})=>{const t=tt(),n=et(),{isDarkMode:m,selectedFont:y,fontSize:C}=l.useContext(nt),B=l.useContext(at),h=l.useRef(null),[L,M]=l.useState({}),[P,G]=l.useState(null),[O,$]=l.useState(null),[T,R]=l.useState({}),{libraryData:{content:I,selectedBook:f,selectedChapter:u,accessDeniedReason:v}={content:"",selectedBook:void 0,selectedChapter:void 0,accessDeniedReason:null},setSelectedBook:H,setSelectedChapter:A}=B||{},S="/library/";l.useEffect(()=>{let e=!1;return(async()=>{if(!H||!A)return;const a=Y(n.bookId);if(!a){t("/",{replace:!0});return}const r=j(n.bookId,n.chapter);if(!r){const d=(f===a?q(u):void 0)||z(a);if(d){const x=window.location.hash.replace(/^#/,"")||"/",b=await F(a,d).catch(()=>N(a,d));!e&&x!==b&&t(b,{replace:!0})}else{const x=await H(a,!0);if(e||!x)return;const b=z(a);if(!b)return;const k=window.location.hash.replace(/^#/,"")||"/",E=await F(a,b).catch(()=>N(a,b));!e&&k!==E&&t(E,{replace:!0})}return}const s=window.location.hash.replace(/^#/,"")||"/",o=await F(r.book,r.chapter).catch(()=>N(r.book,r.chapter));if(!e&&s!==o){t(o,{replace:!0});return}if((f===r.book?q(u):void 0)===r.chapter&&(I||v))return;const w=await A(r.book,r.chapter)})(),()=>{e=!0}},[v,I,t,n.bookId,n.chapter,f,u,H,A]),l.useEffect(()=>{const e=()=>{var r;if(h.current){const s=h.current,o=(s==null?void 0:s.contentDocument)||((r=s==null?void 0:s.contentWindow)==null?void 0:r.document);if(o){const g=o.body.getBoundingClientRect().height+"px";s.style.height=g,o.body.parentElement.style.height=g}}},i=h.current;function a(){e(),setTimeout(()=>{e()},300)}return i&&i.addEventListener("load",a),()=>{i&&i.removeEventListener("load",a)}},[I,h]),l.useEffect(()=>{p.current&&p.current.scrollTo({top:0,behavior:"smooth"})},[n.bookId,n.chapter,p]),l.useEffect(()=>{var e;h.current&&((e=h.current.contentWindow)==null||e.location.reload())},[m,y,C]),l.useEffect(()=>{let e=!1;return(async()=>{try{const a=await fetch(ot(S));if(!a.ok)return;const r=await a.json();if(!Array.isArray(r.images))return;const s={};for(const o of r.images)typeof(o==null?void 0:o.id)!="string"||typeof(o==null?void 0:o.fullSrc)!="string"||(s[o.id]={fullSrc:o.fullSrc});e||M(s)}catch{e||M({})}})(),()=>{e=!0}},[S]),l.useEffect(()=>{const e=j(n.bookId,n.chapter),i=e?{bookId:e.book,chapterId:e.chapter}:u?{bookId:f,chapterId:u}:null;let a=!1;return(async()=>{if(!i||v){R({});return}try{const s=await it(i);if(a)return;const o={};for(const g of s.lineThreadKeys){const w=g.match(/:paragraph:(\d+):[^:]+$/);if(!w)continue;const d=Number(w[1]);Number.isInteger(d)&&(o[d]=(o[d]??0)+(s.commentCountsByThreadKey[g]??0))}R(o)}catch{a||R({})}})(),()=>{a=!0}},[v,n.bookId,n.chapter,f,u]),l.useEffect(()=>{var e,i;(i=(e=h.current)==null?void 0:e.contentWindow)==null||i.postMessage({type:"paragraph-comment-counts-updated",countsByParagraphIndex:T},"*")},[I,T]),l.useEffect(()=>{const e=i=>{var r,s,o,g,w;if(i.origin.startsWith("https://benis-boy.github.io")||i.origin.startsWith("http://localhost:")||i.origin.startsWith("http://127.0.0.1:")){if(((r=i.data)==null?void 0:r.type)==="chapter-image-clicked"){const d=(s=i.data)==null?void 0:s.imageId;if(typeof d!="string"||!L[d])return;G(d);return}if(((o=i.data)==null?void 0:o.type)==="paragraph-comment-requested"){const d=(g=i.data)==null?void 0:g.paragraphIndex,x=j(n.bookId,n.chapter),b=(x==null?void 0:x.book)||f,k=(x==null?void 0:x.chapter)||u;if(typeof d!="number"||!b||!k||!((w=h.current)!=null&&w.contentDocument))return;const E=Array.from(h.current.contentDocument.querySelectorAll("p[data-paragraph-index]")).map(D=>{var V;return{content:((V=D.textContent)==null?void 0:V.trim())??""}});if(d<0||d>=E.length)return;const U=lt(b,k,E,d);console.log("ParagraphLocation",U),$({bookId:b,chapterId:k,paragraphLocation:U})}}};return window.addEventListener("message",e),()=>{window.removeEventListener("message",e)}},[L,n.bookId,n.chapter,f,u]);const X=l.useMemo(()=>{if(!P)return"";const e=L[P];return e?`${S}${e.fullSrc.replace(/^\/+/,"")}`:""},[S,L,P]);if(!B)return c.jsx(l.Fragment,{});const W=j(n.bookId,n.chapter),_=W?{bookId:W.book,chapterId:W.chapter}:u?{bookId:f,chapterId:u}:null,J=v?v==="login_required"?c.jsx(mt,{}):c.jsx(ht,{}):c.jsx("div",{className:"w-full flex",children:c.jsx("iframe",{ref:h,onLoad:()=>{var e,i;ut(h,{isDarkMode:m,selectedFont:y,fontSize:C}),(i=(e=h.current)==null?void 0:e.contentWindow)==null||i.postMessage({type:"paragraph-comment-counts-updated",countsByParagraphIndex:T},"*")},srcDoc:`<html><body style="margin: 0;margin-top: -16px;margin-bottom: -16px;"><div style="height:100%">${I}</div></html></body>`,className:"flex-grow",title:"Embedded Content"})}),Z=!v;return c.jsxs(c.Fragment,{children:[c.jsxs("div",{className:"w-full px-2 lg:pl-4 lg:pr-0 pb-8",children:[J,Z?c.jsx("div",{className:"flex justify-center mt-4 pb-4",children:c.jsx("button",{className:"px-6 py-2 bg-[#872341] hover:scale-105 text-white font-semibold rounded-lg shadow-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50",style:{maxWidth:"200px"},onClick:async e=>{if(e.currentTarget.blur(),!A)return;const i=Y(n.bookId),a=j(n.bookId,n.chapter),r=(a==null?void 0:a.book)||i||f,s=(a==null?void 0:a.chapter)||(r&&f===r?q(u):void 0)||(r?z(r):void 0);if(!r||!s)return;const o=await rt(r,s);if(!o){t("/reader/end");return}const g=o.chapterId||o.chapter;t(N(r,g))},children:"Next Chapter"})}):null,_?c.jsx(Q,{locationId:_,className:"mt-8 mb-4"}):null]}),c.jsx(ct,{open:!!(P&&X),imageSrc:X,imageAlt:P?`Chapter image ${P}`:"Chapter image",onClose:()=>G(null)}),O?c.jsx("div",{className:"fixed inset-0 z-[2100] flex items-center justify-center bg-slate-950/60 px-3 py-6",onClick:()=>$(null),children:c.jsxs("div",{className:`max-h-full w-full max-w-3xl overflow-y-auto rounded-2xl p-5 shadow-2xl ${m?"bg-slate-900":"bg-white"}`,onClick:e=>e.stopPropagation(),children:[c.jsxs("div",{className:"mb-4 flex items-center justify-between gap-3",children:[c.jsx("h2",{className:`text-lg font-bold ${m?"text-slate-100":"text-slate-950"}`,children:"Paragraph Comments"}),c.jsx("button",{type:"button",className:`rounded-full px-3 py-1 text-sm font-semibold ${m?"bg-slate-800 text-slate-100 hover:bg-slate-700":"bg-slate-100 text-slate-700 hover:bg-slate-200"}`,onClick:()=>$(null),children:"Close"})]}),c.jsx(Q,{locationId:O})]})}):null]})},ut=(p,{isDarkMode:t,selectedFont:n,fontSize:m})=>{const y=p.current;if(y){const C=y.contentDocument;if(C){const B=C.createElement("style");B.innerHTML=`
        html, body { 
          margin: 0; 
          padding: 0;
          overflow: hidden;
        }
        body { 
          margin: 0; 
          margin-top: -16px;
          margin-bottom: -16px;
          padding: 0; 
          padding-top: 32px; 
          padding-bottom: 16px; 
          width: 100%;
        }

        p {
          position: relative;
          color: ${t?"#ddd":"black"};
          font-family: ${n};
          font-size: ${m}px;
          line-height: 1.6;
          text-align: justify;
          padding: 0.5em 10px;
        }

        p.paragraph-comment-target {
          border-radius: 10px;
          background: ${t?"rgba(148, 163, 184, 0.12)":"rgba(241, 245, 249, 0.92)"};
          box-shadow: inset 0 0 0 1px ${t?"rgba(148, 163, 184, 0.28)":"rgba(148, 163, 184, 0.45)"};
        }

        .paragraph-comment-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 1.6em;
          height: 1.35em;
          margin-left: 0.45em;
          padding: 0 0.45em;
          border-radius: 999px;
          background: ${t?"#334155":"#e2e8f0"};
          color: ${t?"#e2e8f0":"#334155"};
          font-family: ${n};
          font-size: ${Math.max(11,m-5)}px;
          font-style: normal;
          font-weight: 700;
          line-height: 1;
          vertical-align: 0.12em;
        }

        .paragraph-comment-button-hit-area {
          position: absolute;
          z-index: 10;
          display: none;
          align-items: center;
          justify-content: center;
          width: min(260px, calc(100% - 16px));
          height: 58px;
        }

        .paragraph-comment-button-hit-area.is-visible {
          display: flex;
        }

        .paragraph-comment-button {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 34px;
          padding: 0 14px;
          border: 1px solid ${t?"#64748b":"#94a3b8"};
          border-radius: 999px;
          background: ${t?"#1e293b":"#ffffff"};
          color: ${t?"#e2e8f0":"#334155"};
          font-family: ${n};
          font-size: 13px;
          font-weight: 700;
          line-height: 1;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.22);
          cursor: pointer;
        }

        .paragraph-comment-button::after {
          content: '';
          position: absolute;
          left: 50%;
          bottom: -6px;
          width: 10px;
          height: 10px;
          border-right: 1px solid ${t?"#64748b":"#94a3b8"};
          border-bottom: 1px solid ${t?"#64748b":"#94a3b8"};
          background: ${t?"#1e293b":"#ffffff"};
          transform: translateX(-50%) rotate(45deg);
        }

        .paragraph-comment-button:hover {
          background: ${t?"#334155":"#f8fafc"};
        }

        .paragraph-comment-button:focus {
          outline: 2px solid ${t?"#93c5fd":"#1d4ed8"};
          outline-offset: 2px;
        }

        .chapter-image-trigger {
          display: flex;
          justify-content: center;
          align-items: center;
          width: fit-content;
          max-width: calc(100% - 20px);
          margin: 16px auto;
          min-height: 44px;
          padding: 8px;
          border: 1px solid ${t?"#4a596f":"#a5b4c5"};
          border-radius: 10px;
          background: ${t?"#1b2a41":"#eef2f7"};
          color: ${t?"#f5f7fa":"#1f2937"};
          font-family: ${n};
          font-size: ${Math.max(14,m-1)}px;
          text-align: left;
          cursor: pointer;
          overflow: hidden;
        }

        .chapter-image-trigger img {
          display: block;
          width: auto;
          max-width: min(100%, 320px);
          max-height: 320px;
          height: auto;
          object-fit: contain;
        }

        .chapter-image-trigger:hover {
          filter: brightness(1.05);
        }

        .chapter-image-trigger:focus {
          outline: 2px solid ${t?"#93c5fd":"#1d4ed8"};
          outline-offset: 2px;
        }
      `,C.head.appendChild(B);const h=C.createElement("script");h.textContent=dt,C.head.appendChild(h)}}};export{vt as DataViewer};

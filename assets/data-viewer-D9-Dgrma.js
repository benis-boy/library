import{j as u,k as jt,a6 as Nt,a7 as Ht,r as c,y as Mt,L as Kt,a8 as pt,a9 as Ot,aa as Pt,ab as lt,n as ut,ac as qt,t as tt,ad as St,I as Ft,ae as _t,af as Ut,q as dt,w as Dt,ag as Wt}from"./index-UaafBLDY.js";function mt(n){if(!n||n.length===0)return"00000000";let e=2166136261;for(let l=0;l<n.length;l++)e^=n.charCodeAt(l),e=e*16777619>>>0;return Math.abs(e).toString(36).padStart(8,"0").slice(-8).toUpperCase()}function _(n){return mt(n.content)}function U(n,e){const l=e>0?n[e-1].content:"",i=e<n.length-1?n[e+1].content:"";return{prev:mt(l),next:mt(i)}}function Xt(n,e,l,i){const d=l[i];if(!d)throw new Error("Cannot create paragraph location for missing paragraph.");return{bookId:n,chapterId:e,paragraphIndex:i,secondaryKey:_(d),tertiaryKey:U(l,i)}}function zt(n,e){if(!e||e.length===0)return null;const l=n.paragraphIndex;if(l>=0&&l<e.length){const i=e[l],d=_(i),b=U(e,l);if(d===n.secondaryKey&&b.prev===n.tertiaryKey.prev&&b.next===n.tertiaryKey.next)return i}return null}function Yt(n,e){const l=zt(n,e);if(l)return l;const i=n.paragraphIndex;if(i>=0&&i<e.length){const m=e[i];if(_(m)===n.secondaryKey){const g=U(e,i);return n.tertiaryKey.prev=g.prev,n.tertiaryKey.next=g.next,m}}const d=Math.max(0,i-10),b=Math.min(e.length-1,i+10);for(let m=d;m<=b;m++){if(m===i)continue;const y=e[m];if(_(y)===n.secondaryKey){const k=U(e,m);return n.paragraphIndex=m,n.tertiaryKey.prev=k.prev,n.tertiaryKey.next=k.next,y}}for(let m=d;m<=b;m++){const y=U(e,m),g=e[m],k=y.prev===n.tertiaryKey.prev&&y.next===n.tertiaryKey.next,D=y.prev===n.tertiaryKey.prev,M=y.next===n.tertiaryKey.next;if(k||D||M){const W=_(g);return n.paragraphIndex=m,n.secondaryKey=W,n.tertiaryKey.prev=y.prev,n.tertiaryKey.next=y.next,g}}return null}const Vt=`const paragraphCommentButtonHitArea = document.createElement('div');
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
let pointerInteraction = null;
const TOUCH_TAP_MOVE_THRESHOLD = 25;
const TOUCH_TAP_MAX_DURATION_MS = 500;

function hasActiveTextSelection() {
  const selection = window.getSelection();
  return Boolean(selection && !selection.isCollapsed && String(selection).trim());
}

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

function isParagraphCommentButtonTarget(target) {
  return target instanceof Element && Boolean(target.closest('.paragraph-comment-button-hit-area'));
}

function isParagraphCommentCountTarget(target) {
  return target instanceof Element && Boolean(target.closest('.paragraph-comment-count'));
}

function showParagraphCommentButton(paragraph) {
  if (activeParagraph && activeParagraph !== paragraph) {
    activeParagraph.classList.remove('paragraph-comment-target');
  }

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
    marker.tabIndex = 0;
    marker.setAttribute('role', 'button');
    marker.setAttribute('data-paragraph-comment-index', paragraphIndex);
    marker.setAttribute('aria-label', count === 1 ? '1 paragraph comment' : count + ' paragraph comments');
    paragraph.appendChild(marker);
  }
}

function requestParagraphComments(paragraphIndex) {
  const numericParagraphIndex = Number(paragraphIndex);
  if (!Number.isFinite(numericParagraphIndex)) {
    return;
  }

  window.parent.postMessage({ type: 'paragraph-comment-requested', paragraphIndex: numericParagraphIndex }, '*');
}

window.addEventListener('message', function (event) {
  if (event.data?.type !== 'paragraph-comment-counts-updated') {
    return;
  }

  renderParagraphCommentCounts(event.data.countsByParagraphIndex);
});

document.addEventListener('pointerdown', function (event) {
  if (event.pointerType === 'mouse' && event.button !== 0) {
    return;
  }

  if (isParagraphCommentButtonTarget(event.target) || isParagraphCommentCountTarget(event.target)) {
    return;
  }

  const paragraph = getParagraphFromEvent(event);
  if (!paragraph) {
    pointerInteraction = null;
    hideParagraphCommentButton();
    return;
  }

  pointerInteraction = {
    paragraph,
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    startX: event.clientX,
    startY: event.clientY,
    startTime: Date.now(),
    moved: false,
  };
});

document.addEventListener('pointermove', function (event) {
  if (!pointerInteraction || pointerInteraction.pointerId !== event.pointerId) {
    return;
  }

  if (
    Math.abs(event.clientX - pointerInteraction.startX) > TOUCH_TAP_MOVE_THRESHOLD ||
    Math.abs(event.clientY - pointerInteraction.startY) > TOUCH_TAP_MOVE_THRESHOLD
  ) {
    pointerInteraction.moved = true;
  }
});

document.addEventListener('pointerup', function (event) {
  if (!pointerInteraction || pointerInteraction.pointerId !== event.pointerId) {
    return;
  }

  const paragraph = getParagraphFromEvent(event);
  const pressDurationMs = Date.now() - pointerInteraction.startTime;
  const selectionActive = hasActiveTextSelection();
  const shouldShowButton =
    paragraph &&
    paragraph === pointerInteraction.paragraph &&
    !pointerInteraction.moved &&
    pressDurationMs <= TOUCH_TAP_MAX_DURATION_MS &&
    !selectionActive;
  const shouldToggleOff =
    shouldShowButton &&
    activeParagraph === paragraph &&
    paragraphCommentButtonHitArea.classList.contains('is-visible');

  pointerInteraction = null;

  if (shouldToggleOff) {
    hideParagraphCommentButton();
    return;
  }

  if (shouldShowButton) {
    showParagraphCommentButton(paragraph);
    return;
  }

  hideParagraphCommentButton();
});

document.addEventListener('pointercancel', function (event) {
  if (!pointerInteraction || pointerInteraction.pointerId !== event.pointerId) {
    return;
  }

  pointerInteraction = null;
  hideParagraphCommentButton();
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
  requestParagraphComments(paragraphIndex);
});

document.addEventListener('click', function (event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const paragraphCommentCount = target.closest('.paragraph-comment-count');
  if (paragraphCommentCount) {
    event.preventDefault();
    requestParagraphComments(paragraphCommentCount.getAttribute('data-paragraph-comment-index'));
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

document.addEventListener('keydown', function (event) {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const paragraphCommentCount = target.closest('.paragraph-comment-count');
  if (!paragraphCommentCount) {
    return;
  }

  event.preventDefault();
  requestParagraphComments(paragraphCommentCount.getAttribute('data-paragraph-comment-index'));
});
`,Gt=()=>u.jsxs("div",{className:"mx-auto my-8 max-w-2xl rounded-2xl border border-slate-300/70 bg-white/80 p-6 font-sans shadow-sm dark:border-slate-700 dark:bg-slate-900/60",children:[u.jsx("h1",{className:"text-2xl mb-2",children:"Access Restricted"}),u.jsx("p",{className:"text-lg leading-relaxed m-0",children:"You need to log in to view this content. Please log in or create an account to continue."})]}),Jt=()=>u.jsxs("div",{className:"mx-auto my-8 max-w-2xl rounded-2xl border border-slate-300/70 bg-white/80 p-6 font-sans shadow-sm dark:border-slate-700 dark:bg-slate-900/60",children:[u.jsx("h1",{className:"text-2xl mb-2",children:"Support me on Patreon"}),u.jsxs("p",{className:"text-lg leading-relaxed m-0",children:["To access the full content, please consider subscribing to me on"," ",u.jsx("a",{href:"https://www.patreon.com/BenisBoy16",target:"_blank",rel:"noopener noreferrer",className:"bg-[#872341] font-bold no-underline hover:underline",children:"Patreon"}),"."]})]}),re=({scrollerRef:n})=>{const e=jt(),l=Nt(),i=Ht(),{isDarkMode:d,selectedFont:b,fontSize:m}=c.useContext(Mt),y=c.useContext(Kt),g=c.useRef(null),k=c.useRef(null),D=c.useRef(null),[M,W]=c.useState({}),[K,ht]=c.useState(null),[N,X]=c.useState(null),[H,z]=c.useState({}),[gt,et]=c.useState(0),[O,ft]=c.useState(!1),[nt,Y]=c.useState(!1),[q,rt]=c.useState(null),F=c.useRef(null),Tt=c.useRef(1),at=c.useRef(null),ot=c.useRef(null),{libraryData:{content:A,selectedBook:B,selectedChapter:P,accessDeniedReason:C}={content:"",selectedBook:void 0,selectedChapter:void 0,accessDeniedReason:null},setSelectedBook:it,setSelectedChapter:V}=y||{},G="/library/",$=c.useMemo(()=>{const t=new URLSearchParams(l.search),a=t.get("commentId"),o=t.get("paragraphLocation");let r=null;if(o)try{r=JSON.parse(o)}catch{r=null}return a?{commentId:a,paragraphLocation:r}:null},[l.search]),[h,xt]=c.useState(null),f=c.useMemo(()=>pt(i.bookId,i.chapter),[i.bookId,i.chapter]),J=c.useCallback(t=>({...t,requestId:Tt.current++}),[]);c.useEffect(()=>{if(!$)return;xt(J($));const t=new URLSearchParams(l.search);t.delete("commentId"),t.delete("paragraphLocation");const a=t.toString();e({pathname:l.pathname,search:a?`?${a}`:""},{replace:!0})},[J,l.pathname,l.search,e,$]),c.useEffect(()=>{const t=`${i.bookId??""}:${i.chapter??""}`;if(F.current===null){F.current=t;return}if(F.current!==t){F.current=t,xt($?J($):null);return}F.current=t},[J,i.bookId,i.chapter,$]),c.useEffect(()=>{ft(C!==null)},[C,A,i.bookId,i.chapter]),c.useEffect(()=>{let t=!1;return(async()=>{if(!it||!V)return;const o=Pt(i.bookId);if(!o){e("/",{replace:!0});return}const r=pt(i.bookId,i.chapter);if(!r){const v=(B===o?lt(P):void 0)||ut(o);if(v){const E=(window.location.hash.replace(/^#/,"")||"/").split("?")[0],T=await dt(o,v).catch(()=>tt(o,v));!t&&E!==T&&e(T,{replace:!0})}else{const E=await it(o,!0);if(t||!E)return;const T=ut(o);if(!T)return;const j=(window.location.hash.replace(/^#/,"")||"/").split("?")[0],L=await dt(o,T).catch(()=>tt(o,T));!t&&j!==L&&e(L,{replace:!0})}return}const s=(window.location.hash.replace(/^#/,"")||"/").split("?")[0],p=await dt(r.book,r.chapter).catch(()=>tt(r.book,r.chapter));if(!t&&s!==p){e(`${p}${l.search}`,{replace:!0});return}if((B===r.book?lt(P):void 0)===r.chapter&&(A||C))return;const w=await V(r.book,r.chapter)})(),()=>{t=!0}},[C,A,l.search,e,i.bookId,i.chapter,B,P,it,V]),c.useEffect(()=>{const t=()=>{var r;if(g.current){const s=g.current,p=(s==null?void 0:s.contentDocument)||((r=s==null?void 0:s.contentWindow)==null?void 0:r.document);if(p){const x=p.body.getBoundingClientRect().height+"px";s.style.height=x,p.body.parentElement.style.height=x}}},a=g.current;function o(){t(),setTimeout(()=>{t()},300)}return a&&a.addEventListener("load",o),()=>{a&&a.removeEventListener("load",o)}},[A,g]),c.useEffect(()=>{var Q;const t=n.current;if(!f||!t||!A&&!C||$)return;const a=`${f.book}:${f.chapter}:${A?"content":C}:${b}:${m}:${d}`;if(D.current===a)return;const o=Ot(f.book);let r=!1,s,p,x,w=null;const v=()=>{var It;if(r)return;const I=n.current;if(!I)return;const $t=((It=g.current)==null?void 0:It.getBoundingClientRect().height)??0;if(!C&&$t<=0)return;const vt=Math.max(0,I.scrollHeight-I.clientHeight);let Ct=0;if((o==null?void 0:o.chapter)===f.chapter){const Z=Math.max(1,o.scrollHeight-o.clientHeight);Ct=Math.abs(I.scrollHeight-o.scrollHeight)>8?o.scrollTop/Z*vt:o.scrollTop}const wt=Math.min(Math.max(0,Ct),vt);I.dataset.readerRestoreUntil=String(Date.now()+200),x!==void 0&&window.clearTimeout(x),x=window.setTimeout(()=>{var Z;((Z=n.current)==null?void 0:Z.dataset.readerRestoreUntil)===I.dataset.readerRestoreUntil&&delete I.dataset.readerRestoreUntil,x=void 0},220),I.scrollTo({top:wt,behavior:"auto"}),w=wt,D.current=a},E=()=>{r||(s!==void 0&&window.cancelAnimationFrame(s),s=window.requestAnimationFrame(()=>{s=void 0,v()}))},T=()=>{r||(p!==void 0&&window.clearTimeout(p),p=window.setTimeout(()=>{p=void 0;const I=n.current;!I||w===null||Math.abs(I.scrollTop-w)>2||E()},350))},j=()=>{E(),T()},L=g.current;return C?E():L&&(L.addEventListener("load",j),((Q=L.contentDocument)==null?void 0:Q.readyState)==="complete"&&j()),()=>{r=!0,L&&L.removeEventListener("load",j),s!==void 0&&window.cancelAnimationFrame(s),p!==void 0&&window.clearTimeout(p),x!==void 0&&window.clearTimeout(x),t&&delete t.dataset.readerRestoreUntil}},[C,A,m,d,$,f,n,b]),c.useEffect(()=>{var t;g.current&&((t=g.current.contentWindow)==null||t.location.reload())},[d,b,m]),c.useEffect(()=>{let t=!1;return(async()=>{try{const o=await fetch(Dt(G));if(!o.ok)return;const r=await o.json();if(!Array.isArray(r.images))return;const s={};for(const p of r.images)typeof(p==null?void 0:p.id)!="string"||typeof(p==null?void 0:p.fullSrc)!="string"||(s[p.id]={fullSrc:p.fullSrc});t||W(s)}catch{t||W({})}})(),()=>{t=!0}},[G]),c.useEffect(()=>{const t=f?{bookId:f.book,chapterId:f.chapter}:P?{bookId:B,chapterId:P}:null;let a=!1;return(async()=>{if(!t||C){z({});return}try{const r=await Wt(t);if(a)return;const s={};for(const p of r.lineThreadKeys){const x=p.match(/:paragraph:(\d+):[^:]+$/);if(!x)continue;const w=Number(x[1]);Number.isInteger(w)&&(s[w]=(s[w]??0)+(r.commentCountsByThreadKey[p]??0))}z(s)}catch{a||z({})}})(),()=>{a=!0}},[C,f,B,P]),c.useEffect(()=>{var t,a;(a=(t=g.current)==null?void 0:t.contentWindow)==null||a.postMessage({type:"paragraph-comment-counts-updated",countsByParagraphIndex:H},"*")},[A,H]),c.useEffect(()=>{const t=a=>{var r,s,p,x,w;if(a.origin.startsWith("https://benis-boy.github.io")||a.origin.startsWith("http://localhost:")||a.origin.startsWith("http://127.0.0.1:")){if(((r=a.data)==null?void 0:r.type)==="chapter-image-clicked"){const v=(s=a.data)==null?void 0:s.imageId;if(typeof v!="string"||!M[v])return;ht(v);return}if(((p=a.data)==null?void 0:p.type)==="paragraph-comment-requested"){const v=(x=a.data)==null?void 0:x.paragraphIndex,E=(f==null?void 0:f.book)||B,T=(f==null?void 0:f.chapter)||P;if(typeof v!="number"||!E||!T||!((w=g.current)!=null&&w.contentDocument))return;const j=Array.from(g.current.contentDocument.querySelectorAll("p[data-paragraph-index]")).map(Q=>{var I;return{content:((I=Q.textContent)==null?void 0:I.trim())??""}});if(v<0||v>=j.length)return;const L=Xt(E,T,j,v);et(H[v]??0),X({bookId:E,chapterId:T,paragraphLocation:L})}}};return window.addEventListener("message",t),()=>{window.removeEventListener("message",t)}},[M,H,f,B,P]);const bt=c.useMemo(()=>{if(!K)return"";const t=M[K];return t?`${G}${t.fullSrc.replace(/^\/+/,"")}`:""},[G,M,K]),Bt=c.useCallback(t=>{var o;et(t);const a=(o=N==null?void 0:N.paragraphLocation)==null?void 0:o.paragraphIndex;a!==void 0&&z(r=>{if((r[a]??0)===t)return r;if(t<=0){const s={...r};return delete s[a],s}return{...r,[a]:t}})},[N]),S=c.useMemo(()=>f?{bookId:f.book,chapterId:f.chapter}:P?{bookId:B,chapterId:P}:null,[f,B,P]),Et=S!==null&&C===null,ct=S?`${S.bookId}:${S.chapterId}`:null,R=c.useMemo(()=>!h||!S?null:`${S.bookId}:${S.chapterId}:${h.commentId}:${h.paragraphLocation?JSON.stringify(h.paragraphLocation):"chapter"}:${h.requestId}`,[h,S]),Lt=h&&!h.paragraphLocation?h.commentId:void 0,At=h!=null&&h.paragraphLocation?h.commentId:void 0,yt=c.useCallback((t,a)=>{const o=Array.from(t.querySelectorAll("p[data-paragraph-index]")),r=o.map(w=>{var v;return{content:((v=w.textContent)==null?void 0:v.trim())??""}}),s={...a,tertiaryKey:{...a.tertiaryKey}},p=Yt(s,r);if(!p)return null;const x=r.indexOf(p);return x<0?null:o[x]??null},[]),st=c.useCallback(()=>{if(!(h!=null&&h.paragraphLocation)||!R||q!==R)return!1;const t=g.current,a=n.current,o=t==null?void 0:t.contentDocument;if(!t||!a||!o)return!1;const r=yt(o,h.paragraphLocation);return r?(ot.current=R,o.querySelectorAll("p.paragraph-comment-target").forEach(s=>{s!==r&&s.classList.remove("paragraph-comment-target")}),r.classList.add("paragraph-comment-target"),Zt(a,t,r),rt(null),!0):!1},[h,R,q,yt,n]);if(c.useEffect(()=>{Y(!1),rt(null),at.current=null,ot.current=null},[ct]),c.useEffect(()=>{if(!h||!S||!O||!R||at.current===R)return;if(at.current=R,h.paragraphLocation){const o={...S,paragraphLocation:h.paragraphLocation};X(o),et(H[h.paragraphLocation.paragraphIndex]??0),rt(R);return}Y(!0);const t=k.current,a=n.current;t&&a&&window.requestAnimationFrame(()=>{Qt(a,t)})},[h,R,S,O,H,n]),c.useEffect(()=>{if(!O||!q||ot.current===q)return;const t=window.requestAnimationFrame(()=>{st()});return()=>{window.cancelAnimationFrame(t)}},[st,O,q]),c.useEffect(()=>{if(nt||!ct||!O)return;const t=k.current,a=n.current;if(!t||!a||!("IntersectionObserver"in window)){Y(!0);return}const o=new IntersectionObserver(r=>{for(const s of r)if(s.isIntersecting){Y(!0),o.disconnect();return}},{root:a,rootMargin:"800px 0px",threshold:0});return o.observe(t),()=>{o.disconnect()}},[ct,O,n,nt]),!y)return u.jsx(c.Fragment,{});const Rt=C?C==="login_required"?u.jsx(Gt,{}):u.jsx(Jt,{}):u.jsx("div",{className:"w-full flex",children:u.jsx("iframe",{ref:g,onLoad:()=>{var t,a;te(g,{isDarkMode:d,selectedFont:b,fontSize:m}),ft(!0),(a=(t=g.current)==null?void 0:t.contentWindow)==null||a.postMessage({type:"paragraph-comment-counts-updated",countsByParagraphIndex:H},"*"),window.requestAnimationFrame(()=>{st()})},srcDoc:`<html><body style="margin: 0;margin-top: -16px;margin-bottom: -16px;"><div style="height:100%">${A}</div></html></body>`,className:"flex-grow",title:"Embedded Content"})}),kt=!C;return u.jsxs(u.Fragment,{children:[u.jsxs("div",{className:"w-full px-2 lg:pl-4 lg:pr-0 pb-8",children:[Rt,kt?u.jsx("div",{className:"flex justify-center mt-4 pb-4",children:u.jsx("button",{className:"px-6 py-2 bg-[#872341] hover:scale-105 text-white font-semibold rounded-lg shadow-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50",style:{maxWidth:"200px"},onClick:async t=>{if(t.currentTarget.blur(),!V)return;const a=Pt(i.bookId),o=pt(i.bookId,i.chapter),r=(o==null?void 0:o.book)||a||B,s=(o==null?void 0:o.chapter)||(r&&B===r?lt(P):void 0)||(r?ut(r):void 0);if(!r||!s)return;const p=await qt(r,s);if(!p){e("/reader/end");return}const x=p.chapterId||p.chapter;e(tt(r,x))},children:"Next Chapter"})}):null,Et?u.jsxs(u.Fragment,{children:[u.jsx("div",{ref:k,className:"mt-8 h-px w-full","aria-hidden":"true"}),nt?u.jsx(St,{locationId:S,className:"mb-4",highlightedCommentId:Lt}):u.jsxs("section",{className:`mx-auto mb-4 w-full max-w-3xl rounded-2xl border px-4 py-5 ${d?"border-slate-700 bg-slate-900":"border-slate-200 bg-slate-50"}`,children:[u.jsx("h2",{className:`text-xl font-bold ${d?"text-slate-100":"text-slate-950"}`,children:"Comments"}),u.jsx("p",{className:`mt-2 text-sm ${d?"text-slate-400":"text-slate-600"}`,children:"Comments load when this section gets near the viewport."})]})]}):null]}),u.jsx(Ft,{open:!!(K&&bt),imageSrc:bt,imageAlt:K?`Chapter image ${K}`:"Chapter image",onClose:()=>ht(null)}),u.jsx(_t,{open:N!==null,onClose:()=>X(null),fullWidth:!0,maxWidth:"md",slotProps:Ut({isDarkMode:d,zIndex:2100,paperClassName:"mx-3 w-full max-w-3xl rounded-2xl shadow-2xl",paperAriaLabel:"Paragraph comments",paperSx:{maxHeight:"calc(100% - 48px)"}}),children:N?u.jsxs("div",{className:"max-h-[calc(100vh-3rem)] overflow-y-auto p-5",children:[u.jsxs("div",{className:"mb-1 flex items-center justify-between gap-3",children:[u.jsxs("h2",{className:`text-lg font-bold ${d?"text-slate-100":"text-slate-950"}`,children:[gt," Paragraph Comment",gt===1?"":"s"]}),u.jsx("button",{type:"button",className:`rounded-full px-3 py-1 text-sm font-semibold ${d?"bg-slate-800 text-slate-100 hover:bg-slate-700":"bg-slate-100 text-slate-700 hover:bg-slate-200"}`,onClick:()=>X(null),children:"Close"})]}),u.jsx(St,{locationId:N,hideDefaultHeader:!0,highlightedCommentId:At,onCommentCountChange:Bt})]}):null})]})},Qt=(n,e)=>{const l=n.getBoundingClientRect(),i=e.getBoundingClientRect(),d=n.scrollTop+(i.top-l.top)-Math.max(24,n.clientHeight*.18);n.scrollTo({top:Math.max(0,d),behavior:"auto"})},Zt=(n,e,l)=>{const i=n.getBoundingClientRect(),d=e.getBoundingClientRect(),b=l.getBoundingClientRect(),m=d.top-i.top+b.top,y=n.scrollTop+m-Math.max(24,n.clientHeight*.22);n.scrollTo({top:Math.max(0,y),behavior:"auto"})},te=(n,{isDarkMode:e,selectedFont:l,fontSize:i})=>{const d=n.current;if(d){const b=d.contentDocument;if(b){const m=b.createElement("style");m.innerHTML=`
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
          color: ${e?"#ddd":"black"};
          font-family: ${l};
          font-size: ${i}px;
          line-height: 1.6;
          text-align: justify;
          padding: 0.5em 10px;
        }

        p.paragraph-comment-target {
          border-radius: 10px;
          background: ${e?"rgba(148, 163, 184, 0.12)":"rgba(241, 245, 249, 0.92)"};
          box-shadow: inset 0 0 0 1px ${e?"rgba(148, 163, 184, 0.28)":"rgba(148, 163, 184, 0.45)"};
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
          background: ${e?"#334155":"#e2e8f0"};
          color: ${e?"#e2e8f0":"#334155"};
          font-family: ${l};
          font-size: ${Math.max(11,i-5)}px;
          font-style: normal;
          font-weight: 700;
          line-height: 1;
          vertical-align: 0.12em;
          cursor: pointer;
        }

        .paragraph-comment-count:hover {
          background: ${e?"#475569":"#cbd5e1"};
        }

        .paragraph-comment-count:focus {
          outline: 2px solid ${e?"#93c5fd":"#1d4ed8"};
          outline-offset: 2px;
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
          border: 1px solid ${e?"#64748b":"#94a3b8"};
          border-radius: 999px;
          background: ${e?"#1e293b":"#ffffff"};
          color: ${e?"#e2e8f0":"#334155"};
          font-family: ${l};
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
          border-right: 1px solid ${e?"#64748b":"#94a3b8"};
          border-bottom: 1px solid ${e?"#64748b":"#94a3b8"};
          background: ${e?"#1e293b":"#ffffff"};
          transform: translateX(-50%) rotate(45deg);
        }

        .paragraph-comment-button:hover {
          background: ${e?"#334155":"#f8fafc"};
        }

        .paragraph-comment-button:focus {
          outline: 2px solid ${e?"#93c5fd":"#1d4ed8"};
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
          border: 1px solid ${e?"#4a596f":"#a5b4c5"};
          border-radius: 10px;
          background: ${e?"#1b2a41":"#eef2f7"};
          color: ${e?"#f5f7fa":"#1f2937"};
          font-family: ${l};
          font-size: ${Math.max(14,i-1)}px;
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
          outline: 2px solid ${e?"#93c5fd":"#1d4ed8"};
          outline-offset: 2px;
        }
      `,b.head.appendChild(m);const y=b.createElement("script");y.textContent=Vt,b.head.appendChild(y)}}};export{re as DataViewer};

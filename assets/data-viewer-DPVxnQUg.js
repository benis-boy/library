import{j as p,k as Me,a6 as Ke,a7 as qe,r as c,y as Oe,L as Fe,a8 as ue,a9 as _e,aa as Te,ab as de,n as me,ac as Ue,t as re,ad as Ee,I as De,ae as We,af as Xe,q as he,w as ze,ag as Ye}from"./index-Sw9LNV84.js";function ge(n){if(!n||n.length===0)return"00000000";let t=2166136261;for(let u=0;u<n.length;u++)t^=n.charCodeAt(u),t=t*16777619>>>0;return Math.abs(t).toString(36).padStart(8,"0").slice(-8).toUpperCase()}function X(n){return ge(n.content)}function z(n,t){const u=t>0?n[t-1].content:"",i=t<n.length-1?n[t+1].content:"";return{prev:ge(u),next:ge(i)}}function Ve(n,t,u,i){const h=u[i];if(!h)throw new Error("Cannot create paragraph location for missing paragraph.");return{bookId:n,chapterId:t,paragraphIndex:i,secondaryKey:X(h),tertiaryKey:z(u,i)}}function Ge(n,t){if(!t||t.length===0)return null;const u=n.paragraphIndex;if(u>=0&&u<t.length){const i=t[u],h=X(i),C=z(t,u);if(h===n.secondaryKey&&C.prev===n.tertiaryKey.prev&&C.next===n.tertiaryKey.next)return i}return null}function Je(n,t){const u=Ge(n,t);if(u)return u;const i=n.paragraphIndex;if(i>=0&&i<t.length){const d=t[i];if(X(d)===n.secondaryKey){const g=z(t,i);return n.tertiaryKey.prev=g.prev,n.tertiaryKey.next=g.next,d}}const h=Math.max(0,i-10),C=Math.min(t.length-1,i+10);for(let d=h;d<=C;d++){if(d===i)continue;const b=t[d];if(X(b)===n.secondaryKey){const $=z(t,d);return n.paragraphIndex=d,n.tertiaryKey.prev=$.prev,n.tertiaryKey.next=$.next,b}}for(let d=h;d<=C;d++){const b=z(t,d),g=t[d],$=b.prev===n.tertiaryKey.prev&&b.next===n.tertiaryKey.next,Y=b.prev===n.tertiaryKey.prev,M=b.next===n.tertiaryKey.next;if($||Y||M){const V=X(g);return n.paragraphIndex=d,n.secondaryKey=V,n.tertiaryKey.prev=b.prev,n.tertiaryKey.next=b.next,g}}return null}const Qe=`const paragraphCommentButtonHitArea = document.createElement('div');
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
`,Ze=()=>p.jsxs("div",{className:"mx-auto my-8 max-w-2xl rounded-2xl border border-slate-300/70 bg-white/80 p-6 font-sans shadow-sm dark:border-slate-700 dark:bg-slate-900/60",children:[p.jsx("h1",{className:"text-2xl mb-2",children:"Access Restricted"}),p.jsx("p",{className:"text-lg leading-relaxed m-0",children:"You need to log in to view this content. Please log in or create an account to continue."})]}),et=()=>p.jsxs("div",{className:"mx-auto my-8 max-w-2xl rounded-2xl border border-slate-300/70 bg-white/80 p-6 font-sans shadow-sm dark:border-slate-700 dark:bg-slate-900/60",children:[p.jsx("h1",{className:"text-2xl mb-2",children:"Support me on Patreon"}),p.jsxs("p",{className:"text-lg leading-relaxed m-0",children:["To access the full content, please consider subscribing to me on"," ",p.jsx("a",{href:"https://www.patreon.com/BenisBoy16",target:"_blank",rel:"noopener noreferrer",className:"bg-[#872341] font-bold no-underline hover:underline",children:"Patreon"}),"."]})]}),ot=({scrollerRef:n})=>{const t=Me(),u=Ke(),i=qe(),{isDarkMode:h,selectedFont:C,fontSize:d}=c.useContext(Oe),b=c.useContext(Fe),g=c.useRef(null),$=c.useRef(null),Y=c.useRef(null),[M,V]=c.useState({}),[K,fe]=c.useState(null),[N,G]=c.useState(null),[H,J]=c.useState({}),[xe,ae]=c.useState(0),[q,be]=c.useState(!1),[oe,Q]=c.useState(!1),[_,ie]=c.useState(null),U=c.useRef(null),Be=c.useRef(1),ce=c.useRef(null),se=c.useRef(null),{libraryData:{content:L,selectedBook:S,selectedChapter:T,accessDeniedReason:w,isLoading:Z,loadError:D}={content:"",selectedBook:void 0,selectedChapter:void 0,accessDeniedReason:null,isLoading:!1,loadError:null},setSelectedBook:W,setSelectedChapter:O}=b||{},ee="/library/",j=c.useMemo(()=>{const e=new URLSearchParams(u.search),r=e.get("commentId"),a=e.get("paragraphLocation");let o=null;if(a)try{o=JSON.parse(a)}catch{o=null}return r?{commentId:r,paragraphLocation:o}:null},[u.search]),[f,ye]=c.useState(null),m=c.useMemo(()=>ue(i.bookId,i.chapter),[i.bookId,i.chapter]),te=c.useCallback(e=>({...e,requestId:Be.current++}),[]);c.useEffect(()=>{if(!j)return;ye(te(j));const e=new URLSearchParams(u.search);e.delete("commentId"),e.delete("paragraphLocation");const r=e.toString();t({pathname:u.pathname,search:r?`?${r}`:""},{replace:!0})},[te,u.pathname,u.search,t,j]),c.useEffect(()=>{const e=`${i.bookId??""}:${i.chapter??""}`;if(U.current===null){U.current=e;return}if(U.current!==e){U.current=e,ye(j?te(j):null);return}U.current=e},[te,i.bookId,i.chapter,j]),c.useEffect(()=>{be(w!==null)},[w,L,i.bookId,i.chapter]),c.useEffect(()=>{let e=!1;return(async()=>{if(!W||!O)return;const a=Te(i.bookId);if(!a){t("/",{replace:!0});return}const o=ue(i.bookId,i.chapter);if(!o){const k=(S===a?de(T):void 0)||me(a);if(k){const B=(window.location.hash.replace(/^#/,"")||"/").split("?")[0],P=await he(a,k).catch(()=>re(a,k));!e&&B!==P&&t(P,{replace:!0})}else{if(S===a&&(Z||D))return;const B=await W(a,!0);if(e||!B)return;const P=me(a);if(!P)return;const F=(window.location.hash.replace(/^#/,"")||"/").split("?")[0],v=await he(a,P).catch(()=>re(a,P));!e&&F!==v&&t(v,{replace:!0})}return}const l=(S===o.book?de(T):void 0)===o.chapter&&(Z||L||w||D),x=l?void 0:O(o.book,o.chapter),I=(window.location.hash.replace(/^#/,"")||"/").split("?")[0],y=await he(o.book,o.chapter).catch(()=>re(o.book,o.chapter));if(!e&&I!==y){t(`${y}${u.search}`,{replace:!0});return}if(l)return;const R=await x})(),()=>{e=!0}},[w,L,Z,D,u.search,t,i.bookId,i.chapter,S,T,W,O]),c.useEffect(()=>{const e=()=>{var o;if(g.current){const s=g.current,l=(s==null?void 0:s.contentDocument)||((o=s==null?void 0:s.contentWindow)==null?void 0:o.document);if(l){const x=l.body.getBoundingClientRect().height+"px";s.style.height=x,l.body.parentElement.style.height=x}}},r=g.current;function a(){e(),setTimeout(()=>{e()},300)}return r&&r.addEventListener("load",a),()=>{r&&r.removeEventListener("load",a)}},[L,g]),c.useEffect(()=>{var F;const e=n.current;if(!m||!e||!L&&!w||j)return;const r=`${m.book}:${m.chapter}:${L?"content":w}:${C}:${d}:${h}`;if(Y.current===r)return;const a=_e(m.book);let o=!1,s,l,x,I=null;const y=()=>{var Se;if(o)return;const v=n.current;if(!v)return;const He=((Se=g.current)==null?void 0:Se.getBoundingClientRect().height)??0;if(!w&&He<=0)return;const we=Math.max(0,v.scrollHeight-v.clientHeight);let Ie=0;if((a==null?void 0:a.chapter)===m.chapter){const ne=Math.max(1,a.scrollHeight-a.clientHeight);Ie=Math.abs(v.scrollHeight-a.scrollHeight)>8?a.scrollTop/ne*we:a.scrollTop}const Pe=Math.min(Math.max(0,Ie),we);v.dataset.readerRestoreUntil=String(Date.now()+200),x!==void 0&&window.clearTimeout(x),x=window.setTimeout(()=>{var ne;((ne=n.current)==null?void 0:ne.dataset.readerRestoreUntil)===v.dataset.readerRestoreUntil&&delete v.dataset.readerRestoreUntil,x=void 0},220),v.scrollTo({top:Pe,behavior:"auto"}),I=Pe,Y.current=r},R=()=>{o||(s!==void 0&&window.cancelAnimationFrame(s),s=window.requestAnimationFrame(()=>{s=void 0,y()}))},k=()=>{o||(l!==void 0&&window.clearTimeout(l),l=window.setTimeout(()=>{l=void 0;const v=n.current;!v||I===null||Math.abs(v.scrollTop-I)>2||R()},350))},B=()=>{R(),k()},P=g.current;return w?R():P&&(P.addEventListener("load",B),((F=P.contentDocument)==null?void 0:F.readyState)==="complete"&&B()),()=>{o=!0,P&&P.removeEventListener("load",B),s!==void 0&&window.cancelAnimationFrame(s),l!==void 0&&window.clearTimeout(l),x!==void 0&&window.clearTimeout(x),e&&delete e.dataset.readerRestoreUntil}},[w,L,d,h,j,m,n,C]),c.useEffect(()=>{Le(g,{isDarkMode:h,selectedFont:C,fontSize:d})},[L,d,h,C]),c.useEffect(()=>{let e=!1;return(async()=>{try{const a=await fetch(ze(ee));if(!a.ok)return;const o=await a.json();if(!Array.isArray(o.images))return;const s={};for(const l of o.images)typeof(l==null?void 0:l.id)!="string"||typeof(l==null?void 0:l.fullSrc)!="string"||(s[l.id]={fullSrc:l.fullSrc});e||V(s)}catch{e||V({})}})(),()=>{e=!0}},[ee]),c.useEffect(()=>{const e=m?{bookId:m.book,chapterId:m.chapter}:T?{bookId:S,chapterId:T}:null;let r=!1;return(async()=>{if(!e||w){J({});return}try{const o=await Ye(e);if(r)return;const s={};for(const l of o.lineThreadKeys){const x=l.match(/:paragraph:(\d+):[^:]+$/);if(!x)continue;const I=Number(x[1]);Number.isInteger(I)&&(s[I]=(s[I]??0)+(o.commentCountsByThreadKey[l]??0))}J(s)}catch{r||J({})}})(),()=>{r=!0}},[w,m,S,T]),c.useEffect(()=>{var e,r;(r=(e=g.current)==null?void 0:e.contentWindow)==null||r.postMessage({type:"paragraph-comment-counts-updated",countsByParagraphIndex:H},"*")},[L,H]),c.useEffect(()=>{const e=r=>{var o,s,l,x,I;if(r.origin.startsWith("https://benis-boy.github.io")||r.origin.startsWith("http://localhost:")||r.origin.startsWith("http://127.0.0.1:")){if(((o=r.data)==null?void 0:o.type)==="chapter-image-clicked"){const y=(s=r.data)==null?void 0:s.imageId;if(typeof y!="string"||!M[y])return;fe(y);return}if(((l=r.data)==null?void 0:l.type)==="paragraph-comment-requested"){const y=(x=r.data)==null?void 0:x.paragraphIndex,R=(m==null?void 0:m.book)||S,k=(m==null?void 0:m.chapter)||T;if(typeof y!="number"||!R||!k||!((I=g.current)!=null&&I.contentDocument))return;const B=Array.from(g.current.contentDocument.querySelectorAll("p[data-paragraph-index]")).map(F=>{var v;return{content:((v=F.textContent)==null?void 0:v.trim())??""}});if(y<0||y>=B.length)return;const P=Ve(R,k,B,y);ae(H[y]??0),G({bookId:R,chapterId:k,paragraphLocation:P})}}};return window.addEventListener("message",e),()=>{window.removeEventListener("message",e)}},[M,H,m,S,T]);const ve=c.useMemo(()=>{if(!K)return"";const e=M[K];return e?`${ee}${e.fullSrc.replace(/^\/+/,"")}`:""},[ee,M,K]),Ae=c.useCallback(e=>{var a;ae(e);const r=(a=N==null?void 0:N.paragraphLocation)==null?void 0:a.paragraphIndex;r!==void 0&&J(o=>{if((o[r]??0)===e)return o;if(e<=0){const s={...o};return delete s[r],s}return{...o,[r]:e}})},[N]),E=c.useMemo(()=>m?{bookId:m.book,chapterId:m.chapter}:T?{bookId:S,chapterId:T}:null,[m,S,T]),Re=E!==null&&w===null,pe=E?`${E.bookId}:${E.chapterId}`:null,A=c.useMemo(()=>!f||!E?null:`${E.bookId}:${E.chapterId}:${f.commentId}:${f.paragraphLocation?JSON.stringify(f.paragraphLocation):"chapter"}:${f.requestId}`,[f,E]),ke=f&&!f.paragraphLocation?f.commentId:void 0,$e=f!=null&&f.paragraphLocation?f.commentId:void 0,Ce=c.useCallback((e,r)=>{const a=Array.from(e.querySelectorAll("p[data-paragraph-index]")),o=a.map(I=>{var y;return{content:((y=I.textContent)==null?void 0:y.trim())??""}}),s={...r,tertiaryKey:{...r.tertiaryKey}},l=Je(s,o);if(!l)return null;const x=o.indexOf(l);return x<0?null:a[x]??null},[]),le=c.useCallback(()=>{if(!(f!=null&&f.paragraphLocation)||!A||_!==A)return!1;const e=g.current,r=n.current,a=e==null?void 0:e.contentDocument;if(!e||!r||!a)return!1;const o=Ce(a,f.paragraphLocation);return o?(se.current=A,a.querySelectorAll("p.paragraph-comment-target").forEach(s=>{s!==o&&s.classList.remove("paragraph-comment-target")}),o.classList.add("paragraph-comment-target"),nt(r,e,o),ie(null),!0):!1},[f,A,_,Ce,n]);if(c.useEffect(()=>{Q(!1),ie(null),ce.current=null,se.current=null},[pe]),c.useEffect(()=>{if(!f||!E||!q||!A||ce.current===A)return;if(ce.current=A,f.paragraphLocation){const a={...E,paragraphLocation:f.paragraphLocation};G(a),ae(H[f.paragraphLocation.paragraphIndex]??0),ie(A);return}Q(!0);const e=$.current,r=n.current;e&&r&&window.requestAnimationFrame(()=>{tt(r,e)})},[f,A,E,q,H,n]),c.useEffect(()=>{if(!q||!_||se.current===_)return;const e=window.requestAnimationFrame(()=>{le()});return()=>{window.cancelAnimationFrame(e)}},[le,q,_]),c.useEffect(()=>{if(oe||!pe||!q)return;const e=$.current,r=n.current;if(!e||!r||!("IntersectionObserver"in window)){Q(!0);return}const a=new IntersectionObserver(o=>{for(const s of o)if(s.isIntersecting){Q(!0),a.disconnect();return}},{root:r,rootMargin:"800px 0px",threshold:0});return a.observe(e),()=>{a.disconnect()}},[pe,q,n,oe]),!b)return p.jsx(c.Fragment,{});const je=w?w==="login_required"?p.jsx(Ze,{}):p.jsx(et,{}):Z?p.jsx("div",{role:"status",className:"w-full px-4 py-8 text-center","data-reader-load-state":"loading",children:"Loading chapter…"}):D?p.jsxs("div",{role:"alert",className:"w-full px-4 py-8 text-center","data-reader-load-state":"error",children:[p.jsx("p",{children:"This chapter could not be loaded."}),p.jsx("p",{className:"mt-2 text-sm",children:D}),p.jsx("button",{type:"button",className:"mt-4 rounded-lg bg-[#872341] px-5 py-2 font-semibold text-white",onClick:()=>{const e=(m==null?void 0:m.chapter)||T,r=(m==null?void 0:m.book)||S;e&&r&&O?O(r,e):r&&W&&W(r,!0)},children:"Retry loading chapter"})]}):p.jsx("div",{className:"w-full flex",children:p.jsx("iframe",{ref:g,onLoad:()=>{var e,r;Le(g,{isDarkMode:h,selectedFont:C,fontSize:d},!0),be(!0),(r=(e=g.current)==null?void 0:e.contentWindow)==null||r.postMessage({type:"paragraph-comment-counts-updated",countsByParagraphIndex:H},"*"),window.requestAnimationFrame(()=>{le()})},srcDoc:`<html><body style="margin: 0;margin-top: -16px;margin-bottom: -16px;"><div style="height:100%">${L}</div></html></body>`,className:"block min-h-[1px] w-full flex-grow",title:"Embedded Content"})}),Ne=!w;return p.jsxs(p.Fragment,{children:[p.jsxs("div",{className:"w-full px-2 lg:pl-4 lg:pr-0 pb-8",children:[je,Ne?p.jsx("div",{className:"flex justify-center mt-4 pb-4",children:p.jsx("button",{className:"px-6 py-2 bg-[#872341] hover:scale-105 text-white font-semibold rounded-lg shadow-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50",style:{maxWidth:"200px"},onClick:async e=>{if(e.currentTarget.blur(),!O)return;const r=Te(i.bookId),a=ue(i.bookId,i.chapter),o=(a==null?void 0:a.book)||r||S,s=(a==null?void 0:a.chapter)||(o&&S===o?de(T):void 0)||(o?me(o):void 0);if(!o||!s)return;const l=await Ue(o,s);if(!l){t("/reader/end");return}const x=l.chapterId||l.chapter;t(re(o,x))},children:"Next Chapter"})}):null,Re?p.jsxs(p.Fragment,{children:[p.jsx("div",{ref:$,className:"mt-8 h-px w-full","aria-hidden":"true"}),oe?p.jsx(Ee,{locationId:E,className:"mb-4",highlightedCommentId:ke}):p.jsxs("section",{className:`mx-auto mb-4 w-full max-w-3xl rounded-2xl border px-4 py-5 ${h?"border-slate-700 bg-slate-900":"border-slate-200 bg-slate-50"}`,children:[p.jsx("h2",{className:`text-xl font-bold ${h?"text-slate-100":"text-slate-950"}`,children:"Comments"}),p.jsx("p",{className:`mt-2 text-sm ${h?"text-slate-400":"text-slate-600"}`,children:"Comments load when this section gets near the viewport."})]})]}):null]}),p.jsx(De,{open:!!(K&&ve),imageSrc:ve,imageAlt:K?`Chapter image ${K}`:"Chapter image",onClose:()=>fe(null)}),p.jsx(We,{open:N!==null,onClose:()=>G(null),fullWidth:!0,maxWidth:"md",slotProps:Xe({isDarkMode:h,zIndex:2100,paperClassName:"mx-3 w-full max-w-3xl rounded-2xl shadow-2xl",paperAriaLabel:"Paragraph comments",paperSx:{maxHeight:"calc(100% - 48px)"}}),children:N?p.jsxs("div",{className:"max-h-[calc(100vh-3rem)] overflow-y-auto p-5",children:[p.jsxs("div",{className:"mb-1 flex items-center justify-between gap-3",children:[p.jsxs("h2",{className:`text-lg font-bold ${h?"text-slate-100":"text-slate-950"}`,children:[xe," Paragraph Comment",xe===1?"":"s"]}),p.jsx("button",{type:"button",className:`rounded-full px-3 py-1 text-sm font-semibold ${h?"bg-slate-800 text-slate-100 hover:bg-slate-700":"bg-slate-100 text-slate-700 hover:bg-slate-200"}`,onClick:()=>G(null),children:"Close"})]}),p.jsx(Ee,{locationId:N,hideDefaultHeader:!0,highlightedCommentId:$e,onCommentCountChange:Ae})]}):null})]})},tt=(n,t)=>{const u=n.getBoundingClientRect(),i=t.getBoundingClientRect(),h=n.scrollTop+(i.top-u.top)-Math.max(24,n.clientHeight*.18);n.scrollTo({top:Math.max(0,h),behavior:"auto"})},nt=(n,t,u)=>{const i=n.getBoundingClientRect(),h=t.getBoundingClientRect(),C=u.getBoundingClientRect(),d=h.top-i.top+C.top,b=n.scrollTop+d-Math.max(24,n.clientHeight*.22);n.scrollTo({top:Math.max(0,b),behavior:"auto"})},Le=(n,{isDarkMode:t,selectedFont:u,fontSize:i},h=!1)=>{const C=n.current;if(C){const d=C.contentDocument;if(d){let b=d.querySelector("style[data-reader-settings]");if(b||(b=d.createElement("style"),b.dataset.readerSettings="true",d.head.appendChild(b)),b.textContent=`
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
          font-family: ${u};
          font-size: ${i}px;
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
          font-family: ${u};
          font-size: ${Math.max(11,i-5)}px;
          font-style: normal;
          font-weight: 700;
          line-height: 1;
          vertical-align: 0.12em;
          cursor: pointer;
        }

        .paragraph-comment-count:hover {
          background: ${t?"#475569":"#cbd5e1"};
        }

        .paragraph-comment-count:focus {
          outline: 2px solid ${t?"#93c5fd":"#1d4ed8"};
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
          border: 1px solid ${t?"#64748b":"#94a3b8"};
          border-radius: 999px;
          background: ${t?"#1e293b":"#ffffff"};
          color: ${t?"#e2e8f0":"#334155"};
          font-family: ${u};
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
          font-family: ${u};
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
          outline: 2px solid ${t?"#93c5fd":"#1d4ed8"};
          outline-offset: 2px;
        }
      `,h&&!d.querySelector("script[data-reader-enhancements]")){const g=d.createElement("script");g.dataset.readerEnhancements="true",g.textContent=Qe,d.head.appendChild(g)}}}};export{ot as DataViewer};

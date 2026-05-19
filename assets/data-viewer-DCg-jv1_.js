import{f as P,a0 as W,r as c,C as A,L as D,a1 as R,a2 as N,a3 as T,o as k,n as I,j as g,a4 as z,p as S}from"./index-CsbJ1I0-.js";import{I as F}from"./ImageLightbox-B2Auegs9.js";import"./createSvgIcon-DkBKX2jI.js";const V=({scrollerRef:f})=>{const a=P(),s=W(),{isDarkMode:h,selectedFont:m,fontSize:l}=c.useContext(A),x=c.useContext(D),d=c.useRef(null),[y,$]=c.useState({}),[u,L]=c.useState(null),{libraryData:{content:w,selectedBook:v,selectedChapter:E}={content:"",selectedBook:void 0,selectedChapter:void 0},setSelectedBook:j,setSelectedChapter:b}=x||{},C="/library/";c.useEffect(()=>{if(!j||!b)return;const t=R(s.bookId);if(!t){a("/",{replace:!0});return}const n=N(s.bookId,s.chapter);if(!n){const r=(v===t?T(E):void 0)||k(t);if(r){const o=window.location.hash.replace(/^#/,"")||"/",e=S(t,r);o!==e&&a(e,{replace:!0})}else j(t,!0).then(o=>{if(!o)return;if(!o.ok){a(I(o.reason),{replace:!0});return}const e=k(t);if(!e)return;const p=window.location.hash.replace(/^#/,"")||"/",M=S(t,e);p!==M&&a(M,{replace:!0})});return}k(n.book)===n.chapter&&w||b(n.book,n.chapter).then(r=>{r&&(r.ok||a(I(r.reason),{replace:!0}))})},[w,a,s.bookId,s.chapter,v,E,j,b]),c.useEffect(()=>{const t=()=>{var r;if(d.current){const o=d.current,e=(o==null?void 0:o.contentDocument)||((r=o==null?void 0:o.contentWindow)==null?void 0:r.document);if(e){const p=e.body.getBoundingClientRect().height+"px";o.style.height=p,e.body.parentElement.style.height=p}}},n=d.current;function i(){t(),setTimeout(()=>{t()},300)}return n&&n.addEventListener("load",i),()=>{n&&n.removeEventListener("load",i)}},[w,d]),c.useEffect(()=>{f.current&&f.current.scrollTo({top:0,behavior:"smooth"})},[s.bookId,s.chapter,f]),c.useEffect(()=>{var t;d.current&&((t=d.current.contentWindow)==null||t.location.reload())},[h,m,l]),c.useEffect(()=>{let t=!1;return(async()=>{try{const i=await fetch(`${C}assets/gallery/gallery.json`,{cache:"no-store"});if(!i.ok)return;const r=await i.json();if(!Array.isArray(r.images))return;const o={};for(const e of r.images)typeof(e==null?void 0:e.id)!="string"||typeof(e==null?void 0:e.fullSrc)!="string"||(o[e.id]={fullSrc:e.fullSrc});t||$(o)}catch{t||$({})}})(),()=>{t=!0}},[C]),c.useEffect(()=>{const t=n=>{var o,e;if(!(n.origin.startsWith("https://benis-boy.github.io")||n.origin.startsWith("http://localhost:")||n.origin.startsWith("http://127.0.0.1:"))||((o=n.data)==null?void 0:o.type)!=="chapter-image-clicked")return;const r=(e=n.data)==null?void 0:e.imageId;typeof r!="string"||!y[r]||L(r)};return window.addEventListener("message",t),()=>{window.removeEventListener("message",t)}},[y]);const B=c.useMemo(()=>{if(!u)return"";const t=y[u];return t?`${C}${t.fullSrc.replace(/^\/+/,"")}`:""},[C,y,u]);return x?g.jsxs(g.Fragment,{children:[g.jsx("div",{className:"w-full flex lg:pl-4 px-2 lg:pr-0",children:g.jsx("iframe",{ref:d,onLoad:()=>G(d,{isDarkMode:h,selectedFont:m,fontSize:l}),srcDoc:`<html><body style="margin: 0;margin-top: -16px;margin-bottom: -16px;"><div style="height:100%">${w}</div></html></body>`,className:"flex-grow",title:"Embedded Content"})}),g.jsx("div",{className:"flex justify-center mt-4 pb-4",children:g.jsx("button",{className:"px-6 py-2 bg-[#872341] hover:scale-105 text-white font-semibold rounded-lg shadow-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50",style:{maxWidth:"200px"},onClick:async t=>{if(t.currentTarget.blur(),!b)return;const n=R(s.bookId),i=N(s.bookId,s.chapter),r=(i==null?void 0:i.book)||n||v,o=(i==null?void 0:i.chapter)||(r&&v===r?T(E):void 0)||(r?k(r):void 0);if(!r||!o)return;const e=await z(r,o);if(!e){a("/reader/end");return}const p=await b(r,e.chapter,e.isSecured);if(!p.ok){a(I(p.reason));return}a(S(r,e.chapter))},children:"Next Chapter"})}),g.jsx(F,{open:!!(u&&B),imageSrc:B,imageAlt:u?`Chapter image ${u}`:"Chapter image",onClose:()=>L(null)})]}):g.jsx(c.Fragment,{})},G=(f,{isDarkMode:a,selectedFont:s,fontSize:h})=>{const m=f.current;if(m){const l=m.contentDocument;if(l){const x=l.createElement("style");x.innerHTML=`
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
          color: ${a?"#ddd":"black"};
          font-family: ${s};
          font-size: ${h}px;
          line-height: 1.6;
          text-align: justify;
          padding: 0.5em 10px;
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
          border: 1px solid ${a?"#4a596f":"#a5b4c5"};
          border-radius: 10px;
          background: ${a?"#1b2a41":"#eef2f7"};
          color: ${a?"#f5f7fa":"#1f2937"};
          font-family: ${s};
          font-size: ${Math.max(14,h-1)}px;
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
          outline: 2px solid ${a?"#93c5fd":"#1d4ed8"};
          outline-offset: 2px;
        }
      `,l.head.appendChild(x);const d=l.createElement("script");d.innerHTML=`
        document.addEventListener('click', function(event) {
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
      `,l.head.appendChild(d)}}};export{V as DataViewer};

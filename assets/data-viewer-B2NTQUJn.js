import{k as R,a0 as B,r as c,C as N,L as T,a1 as S,a2 as $,o as C,n as L,j as g,a3 as W,p as M}from"./index-DlsU2LKn.js";import{I as A}from"./ImageLightbox-8_qNc23E.js";import"./createSvgIcon-BtrqaRDT.js";const H=({scrollerRef:p})=>{const i=R(),s=B(),{isDarkMode:f,selectedFont:h,fontSize:d}=c.useContext(N),m=c.useContext(T),l=c.useRef(null),[y,E]=c.useState({}),[u,j]=c.useState(null),{libraryData:{content:w}={content:""},setSelectedBook:v,setSelectedChapter:x}=m||{},k="/library/";c.useEffect(()=>{if(!v||!x)return;const r=S(s.bookId);if(!r){i("/",{replace:!0});return}const n=$(s.bookId,s.chapter);if(!n){const t=C(r);if(t){const o=window.location.hash.replace(/^#/,"")||"/",e=M(r,t);o!==e&&i(e,{replace:!0})}else v(r,!0);return}C(n.book)===n.chapter&&w||x(n.book,n.chapter).then(t=>{t&&(t.ok||i(L(t.reason),{replace:!0}))})},[w,i,s.bookId,s.chapter,v,x]),c.useEffect(()=>{const r=()=>{var t;if(l.current){const o=l.current,e=(o==null?void 0:o.contentDocument)||((t=o==null?void 0:o.contentWindow)==null?void 0:t.document);if(e){const b=e.body.getBoundingClientRect().height+"px";o.style.height=b,e.body.parentElement.style.height=b}}},n=l.current;function a(){r(),setTimeout(()=>{r()},300)}return n&&n.addEventListener("load",a),()=>{n&&n.removeEventListener("load",a)}},[w,l]),c.useEffect(()=>{p.current&&p.current.scrollTo({top:0,behavior:"smooth"})},[s.bookId,s.chapter,p]),c.useEffect(()=>{var r;l.current&&((r=l.current.contentWindow)==null||r.location.reload())},[f,h,d]),c.useEffect(()=>{let r=!1;return(async()=>{try{const a=await fetch(`${k}assets/gallery/gallery.json`,{cache:"no-store"});if(!a.ok)return;const t=await a.json();if(!Array.isArray(t.images))return;const o={};for(const e of t.images)typeof(e==null?void 0:e.id)!="string"||typeof(e==null?void 0:e.fullSrc)!="string"||(o[e.id]={fullSrc:e.fullSrc});r||E(o)}catch{r||E({})}})(),()=>{r=!0}},[k]),c.useEffect(()=>{const r=n=>{var o,e;if(!(n.origin.startsWith("https://benis-boy.github.io")||n.origin.startsWith("http://localhost:")||n.origin.startsWith("http://127.0.0.1:"))||((o=n.data)==null?void 0:o.type)!=="chapter-image-clicked")return;const t=(e=n.data)==null?void 0:e.imageId;typeof t!="string"||!y[t]||j(t)};return window.addEventListener("message",r),()=>{window.removeEventListener("message",r)}},[y]);const I=c.useMemo(()=>{if(!u)return"";const r=y[u];return r?`${k}${r.fullSrc.replace(/^\/+/,"")}`:""},[k,y,u]);return m?g.jsxs(g.Fragment,{children:[g.jsx("div",{className:"w-full flex lg:pl-4 px-2 lg:pr-0",children:g.jsx("iframe",{ref:l,onLoad:()=>D(l,{isDarkMode:f,selectedFont:h,fontSize:d}),srcDoc:`<html><body style="margin: 0;margin-top: -16px;margin-bottom: -16px;"><div style="height:100%">${w}</div></html></body>`,className:"flex-grow",title:"Embedded Content"})}),g.jsx("div",{className:"flex justify-center mt-4 pb-4",children:g.jsx("button",{className:"px-6 py-2 bg-[#872341] hover:scale-105 text-white font-semibold rounded-lg shadow-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50",style:{maxWidth:"200px"},onClick:async r=>{if(r.currentTarget.blur(),!x)return;const n=S(s.bookId),a=$(s.bookId,s.chapter),t=(a==null?void 0:a.book)||n,o=(a==null?void 0:a.chapter)||(t?C(t):void 0);if(!t||!o)return;const e=await W(t,o);if(!e){i("/reader/end");return}const b=await x(t,e.chapter,e.isSecured);if(!b.ok){i(L(b.reason));return}i(M(t,e.chapter))},children:"Next Chapter"})}),g.jsx(A,{open:!!(u&&I),imageSrc:I,imageAlt:u?`Chapter image ${u}`:"Chapter image",onClose:()=>j(null)})]}):g.jsx(c.Fragment,{})},D=(p,{isDarkMode:i,selectedFont:s,fontSize:f})=>{const h=p.current;if(h){const d=h.contentDocument;if(d){const m=d.createElement("style");m.innerHTML=`
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
          color: ${i?"#ddd":"black"};
          font-family: ${s};
          font-size: ${f}px;
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
          border: 1px solid ${i?"#4a596f":"#a5b4c5"};
          border-radius: 10px;
          background: ${i?"#1b2a41":"#eef2f7"};
          color: ${i?"#f5f7fa":"#1f2937"};
          font-family: ${s};
          font-size: ${Math.max(14,f-1)}px;
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
          outline: 2px solid ${i?"#93c5fd":"#1d4ed8"};
          outline-offset: 2px;
        }
      `,d.head.appendChild(m);const l=d.createElement("script");l.innerHTML=`
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
      `,d.head.appendChild(l)}}};export{H as DataViewer};

import{j as o,f as _,a1 as q,r as l,C as O,L as U,a2 as D,a3 as W,a4 as B,n as L,a5 as V,p as I,o as $,q as Y}from"./index-CkL9VLEu.js";import{I as J}from"./ImageLightbox-Qd_2a8Xp.js";import"./createSvgIcon-CW3QSw7Z.js";const K=()=>o.jsxs("div",{className:"mx-auto my-8 max-w-2xl rounded-2xl border border-slate-300/70 bg-white/80 p-6 font-sans shadow-sm dark:border-slate-700 dark:bg-slate-900/60",children:[o.jsx("h1",{className:"text-2xl mb-2",children:"Access Restricted"}),o.jsx("p",{className:"text-lg leading-relaxed m-0",children:"You need to log in to view this content. Please log in or create an account to continue."})]}),Q=()=>o.jsxs("div",{className:"mx-auto my-8 max-w-2xl rounded-2xl border border-slate-300/70 bg-white/80 p-6 font-sans shadow-sm dark:border-slate-700 dark:bg-slate-900/60",children:[o.jsx("h1",{className:"text-2xl mb-2",children:"Support me on Patreon"}),o.jsxs("p",{className:"text-lg leading-relaxed m-0",children:["To access the full content, please consider subscribing to me on"," ",o.jsx("a",{href:"https://www.patreon.com/BenisBoy16",target:"_blank",rel:"noopener noreferrer",className:"bg-[#872341] font-bold no-underline hover:underline",children:"Patreon"}),"."]})]}),re=({scrollerRef:p})=>{const i=_(),c=q(),{isDarkMode:f,selectedFont:m,fontSize:u}=l.useContext(O),x=l.useContext(U),d=l.useRef(null),[v,P]=l.useState({}),[g,M]=l.useState(null),{libraryData:{content:k,selectedBook:b,selectedChapter:C,accessDeniedReason:y}={content:"",selectedBook:void 0,selectedChapter:void 0,accessDeniedReason:null},setSelectedBook:S,setSelectedChapter:j}=x||{},E="/library/";l.useEffect(()=>{let t=!1;return(async()=>{if(!S||!j)return;const r=D(c.bookId);if(!r){i("/",{replace:!0});return}const e=W(c.bookId,c.chapter);if(!e){const R=(b===r?B(C):void 0)||L(r);if(R){const N=window.location.hash.replace(/^#/,"")||"/",h=await $(r,R).catch(()=>I(r,R));!t&&N!==h&&i(h,{replace:!0})}else{const N=await S(r,!0);if(t||!N)return;const h=L(r);if(!h)return;const H=window.location.hash.replace(/^#/,"")||"/",A=await $(r,h).catch(()=>I(r,h));!t&&H!==A&&i(A,{replace:!0})}return}const n=window.location.hash.replace(/^#/,"")||"/",a=await $(e.book,e.chapter).catch(()=>I(e.book,e.chapter));if(!t&&n!==a){i(a,{replace:!0});return}if((b===e.book?B(C):void 0)===e.chapter&&(k||y))return;const G=await j(e.book,e.chapter)})(),()=>{t=!0}},[y,k,i,c.bookId,c.chapter,b,C,S,j]),l.useEffect(()=>{const t=()=>{var e;if(d.current){const n=d.current,a=(n==null?void 0:n.contentDocument)||((e=n==null?void 0:n.contentWindow)==null?void 0:e.document);if(a){const w=a.body.getBoundingClientRect().height+"px";n.style.height=w,a.body.parentElement.style.height=w}}},s=d.current;function r(){t(),setTimeout(()=>{t()},300)}return s&&s.addEventListener("load",r),()=>{s&&s.removeEventListener("load",r)}},[k,d]),l.useEffect(()=>{p.current&&p.current.scrollTo({top:0,behavior:"smooth"})},[c.bookId,c.chapter,p]),l.useEffect(()=>{var t;d.current&&((t=d.current.contentWindow)==null||t.location.reload())},[f,m,u]),l.useEffect(()=>{let t=!1;return(async()=>{try{const r=await fetch(Y(E));if(!r.ok)return;const e=await r.json();if(!Array.isArray(e.images))return;const n={};for(const a of e.images)typeof(a==null?void 0:a.id)!="string"||typeof(a==null?void 0:a.fullSrc)!="string"||(n[a.id]={fullSrc:a.fullSrc});t||P(n)}catch{t||P({})}})(),()=>{t=!0}},[E]),l.useEffect(()=>{const t=s=>{var n,a;if(!(s.origin.startsWith("https://benis-boy.github.io")||s.origin.startsWith("http://localhost:")||s.origin.startsWith("http://127.0.0.1:"))||((n=s.data)==null?void 0:n.type)!=="chapter-image-clicked")return;const e=(a=s.data)==null?void 0:a.imageId;typeof e!="string"||!v[e]||M(e)};return window.addEventListener("message",t),()=>{window.removeEventListener("message",t)}},[v]);const T=l.useMemo(()=>{if(!g)return"";const t=v[g];return t?`${E}${t.fullSrc.replace(/^\/+/,"")}`:""},[E,v,g]);if(!x)return o.jsx(l.Fragment,{});const z=y?y==="login_required"?o.jsx(K,{}):o.jsx(Q,{}):o.jsx("div",{className:"w-full flex lg:pl-4 px-2 lg:pr-0",children:o.jsx("iframe",{ref:d,onLoad:()=>X(d,{isDarkMode:f,selectedFont:m,fontSize:u}),srcDoc:`<html><body style="margin: 0;margin-top: -16px;margin-bottom: -16px;"><div style="height:100%">${k}</div></html></body>`,className:"flex-grow",title:"Embedded Content"})}),F=!y;return o.jsxs(o.Fragment,{children:[z,F?o.jsx("div",{className:"flex justify-center mt-4 pb-4",children:o.jsx("button",{className:"px-6 py-2 bg-[#872341] hover:scale-105 text-white font-semibold rounded-lg shadow-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50",style:{maxWidth:"200px"},onClick:async t=>{if(t.currentTarget.blur(),!j)return;const s=D(c.bookId),r=W(c.bookId,c.chapter),e=(r==null?void 0:r.book)||s||b,n=(r==null?void 0:r.chapter)||(e&&b===e?B(C):void 0)||(e?L(e):void 0);if(!e||!n)return;const a=await V(e,n);if(!a){i("/reader/end");return}const w=a.chapterId||a.chapter;i(I(e,w))},children:"Next Chapter"})}):null,o.jsx(J,{open:!!(g&&T),imageSrc:T,imageAlt:g?`Chapter image ${g}`:"Chapter image",onClose:()=>M(null)})]})},X=(p,{isDarkMode:i,selectedFont:c,fontSize:f})=>{const m=p.current;if(m){const u=m.contentDocument;if(u){const x=u.createElement("style");x.innerHTML=`
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
          font-family: ${c};
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
          font-family: ${c};
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
      `,u.head.appendChild(x);const d=u.createElement("script");d.innerHTML=`
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
      `,u.head.appendChild(d)}}};export{re as DataViewer};

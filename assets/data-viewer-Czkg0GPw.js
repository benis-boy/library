import{j as n,f as q,O as Q,r as l,C as U,L as V,P as B,Q as F,R as P,i as $,S as Y,o as S,n as M,p as J}from"./index-D0W9tyb0.js";import{C as K}from"./comment-section-BuGp07Wq.js";import{I as X}from"./ImageLightbox-BNNRlnB0.js";import"./Button-DtxHpfN5.js";import"./Select-C-OaXyh9.js";import"./createSvgIcon-0praqswX.js";const Z=()=>n.jsxs("div",{className:"mx-auto my-8 max-w-2xl rounded-2xl border border-slate-300/70 bg-white/80 p-6 font-sans shadow-sm dark:border-slate-700 dark:bg-slate-900/60",children:[n.jsx("h1",{className:"text-2xl mb-2",children:"Access Restricted"}),n.jsx("p",{className:"text-lg leading-relaxed m-0",children:"You need to log in to view this content. Please log in or create an account to continue."})]}),ee=()=>n.jsxs("div",{className:"mx-auto my-8 max-w-2xl rounded-2xl border border-slate-300/70 bg-white/80 p-6 font-sans shadow-sm dark:border-slate-700 dark:bg-slate-900/60",children:[n.jsx("h1",{className:"text-2xl mb-2",children:"Support me on Patreon"}),n.jsxs("p",{className:"text-lg leading-relaxed m-0",children:["To access the full content, please consider subscribing to me on"," ",n.jsx("a",{href:"https://www.patreon.com/BenisBoy16",target:"_blank",rel:"noopener noreferrer",className:"bg-[#872341] font-bold no-underline hover:underline",children:"Patreon"}),"."]})]}),ce=({scrollerRef:f})=>{const c=q(),s=Q(),{isDarkMode:x,selectedFont:b,fontSize:u}=l.useContext(U),y=l.useContext(V),d=l.useRef(null),[v,T]=l.useState({}),[p,A]=l.useState(null),{libraryData:{content:C,selectedBook:h,selectedChapter:g,accessDeniedReason:w}={content:"",selectedBook:void 0,selectedChapter:void 0,accessDeniedReason:null},setSelectedBook:E,setSelectedChapter:j}=y||{},I="/library/";l.useEffect(()=>{let t=!1;return(async()=>{if(!E||!j)return;const r=F(s.bookId);if(!r){c("/",{replace:!0});return}const e=B(s.bookId,s.chapter);if(!e){const N=(h===r?P(g):void 0)||$(r);if(N){const L=window.location.hash.replace(/^#/,"")||"/",m=await M(r,N).catch(()=>S(r,N));!t&&L!==m&&c(m,{replace:!0})}else{const L=await E(r,!0);if(t||!L)return;const m=$(r);if(!m)return;const _=window.location.hash.replace(/^#/,"")||"/",z=await M(r,m).catch(()=>S(r,m));!t&&_!==z&&c(z,{replace:!0})}return}const a=window.location.hash.replace(/^#/,"")||"/",o=await M(e.book,e.chapter).catch(()=>S(e.book,e.chapter));if(!t&&a!==o){c(o,{replace:!0});return}if((h===e.book?P(g):void 0)===e.chapter&&(C||w))return;const O=await j(e.book,e.chapter)})(),()=>{t=!0}},[w,C,c,s.bookId,s.chapter,h,g,E,j]),l.useEffect(()=>{const t=()=>{var e;if(d.current){const a=d.current,o=(a==null?void 0:a.contentDocument)||((e=a==null?void 0:a.contentWindow)==null?void 0:e.document);if(o){const k=o.body.getBoundingClientRect().height+"px";a.style.height=k,o.body.parentElement.style.height=k}}},i=d.current;function r(){t(),setTimeout(()=>{t()},300)}return i&&i.addEventListener("load",r),()=>{i&&i.removeEventListener("load",r)}},[C,d]),l.useEffect(()=>{f.current&&f.current.scrollTo({top:0,behavior:"smooth"})},[s.bookId,s.chapter,f]),l.useEffect(()=>{var t;d.current&&((t=d.current.contentWindow)==null||t.location.reload())},[x,b,u]),l.useEffect(()=>{let t=!1;return(async()=>{try{const r=await fetch(J(I));if(!r.ok)return;const e=await r.json();if(!Array.isArray(e.images))return;const a={};for(const o of e.images)typeof(o==null?void 0:o.id)!="string"||typeof(o==null?void 0:o.fullSrc)!="string"||(a[o.id]={fullSrc:o.fullSrc});t||T(a)}catch{t||T({})}})(),()=>{t=!0}},[I]),l.useEffect(()=>{const t=i=>{var a,o;if(!(i.origin.startsWith("https://benis-boy.github.io")||i.origin.startsWith("http://localhost:")||i.origin.startsWith("http://127.0.0.1:"))||((a=i.data)==null?void 0:a.type)!=="chapter-image-clicked")return;const e=(o=i.data)==null?void 0:o.imageId;typeof e!="string"||!v[e]||A(e)};return window.addEventListener("message",t),()=>{window.removeEventListener("message",t)}},[v]);const D=l.useMemo(()=>{if(!p)return"";const t=v[p];return t?`${I}${t.fullSrc.replace(/^\/+/,"")}`:""},[I,v,p]);if(!y)return n.jsx(l.Fragment,{});const R=B(s.bookId,s.chapter),W=R?{bookId:R.book,chapterId:R.chapter}:g?{bookId:h,chapterId:g}:null,G=w?w==="login_required"?n.jsx(Z,{}):n.jsx(ee,{}):n.jsx("div",{className:"w-full flex",children:n.jsx("iframe",{ref:d,onLoad:()=>te(d,{isDarkMode:x,selectedFont:b,fontSize:u}),srcDoc:`<html><body style="margin: 0;margin-top: -16px;margin-bottom: -16px;"><div style="height:100%">${C}</div></html></body>`,className:"flex-grow",title:"Embedded Content"})}),H=!w;return n.jsxs(n.Fragment,{children:[n.jsxs("div",{className:"w-full px-2 lg:pl-4 lg:pr-0 pb-8",children:[G,H?n.jsx("div",{className:"flex justify-center mt-4 pb-4",children:n.jsx("button",{className:"px-6 py-2 bg-[#872341] hover:scale-105 text-white font-semibold rounded-lg shadow-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50",style:{maxWidth:"200px"},onClick:async t=>{if(t.currentTarget.blur(),!j)return;const i=F(s.bookId),r=B(s.bookId,s.chapter),e=(r==null?void 0:r.book)||i||h,a=(r==null?void 0:r.chapter)||(e&&h===e?P(g):void 0)||(e?$(e):void 0);if(!e||!a)return;const o=await Y(e,a);if(!o){c("/reader/end");return}const k=o.chapterId||o.chapter;c(S(e,k))},children:"Next Chapter"})}):null,W?n.jsx(K,{locationId:W,className:"mt-8 mb-4"}):null]}),n.jsx(X,{open:!!(p&&D),imageSrc:D,imageAlt:p?`Chapter image ${p}`:"Chapter image",onClose:()=>A(null)})]})},te=(f,{isDarkMode:c,selectedFont:s,fontSize:x})=>{const b=f.current;if(b){const u=b.contentDocument;if(u){const y=u.createElement("style");y.innerHTML=`
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
          color: ${c?"#ddd":"black"};
          font-family: ${s};
          font-size: ${x}px;
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
          border: 1px solid ${c?"#4a596f":"#a5b4c5"};
          border-radius: 10px;
          background: ${c?"#1b2a41":"#eef2f7"};
          color: ${c?"#f5f7fa":"#1f2937"};
          font-family: ${s};
          font-size: ${Math.max(14,x-1)}px;
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
          outline: 2px solid ${c?"#93c5fd":"#1d4ed8"};
          outline-offset: 2px;
        }
      `,u.head.appendChild(y);const d=u.createElement("script");d.innerHTML=`
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
      `,u.head.appendChild(d)}}};export{ce as DataViewer};

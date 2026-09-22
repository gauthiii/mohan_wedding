import React, { Component, Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { chapters } from './journey';
const TempleScene = lazy(()=>import('./TempleScene'));
const ASSET = `${import.meta.env.BASE_URL}assets/generated/`;

class SceneBoundary extends Component {
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(){this.props.onFailure();}
 render(){return this.state.failed?null:this.props.children;}
}
function supported(){try {const canvas=document.createElement('canvas');const gl=canvas.getContext('webgl2');if(!gl)return false;gl.getExtension('WEBGL_lose_context')?.loseContext();return true;}catch{return false;}}
function goToInvitation(){const target=document.getElementById('invitation');target?.scrollIntoView({behavior:'instant'});target?.focus({preventScroll:true});}
export default function TempleJourney({language,reducedMotion}){
 const root=useRef(),targetProgress=useRef(0),bar=useRef(),chapterIndex=useRef(0);
 const [chapter,setChapter]=useState(0),[ready,setReady]=useState(false),[failed,setFailed]=useState(false),[active,setActive]=useState(true);
 const [webgl]=useState(supported);const fallback=reducedMotion||failed||!webgl;const lang=language==='ta'?1:0;
 const onFailure=useCallback(()=>setFailed(true),[]),onReady=useCallback(()=>setReady(true),[]);
 const onProgress=useCallback((p,metrics)=>{const index=chapters.findIndex(c=>p<=c.end);if(index!==chapterIndex.current){chapterIndex.current=index;setChapter(index);}if(bar.current)bar.current.style.transform=`scaleX(${p})`;if(root.current){root.current.dataset.progress=p.toFixed(4);if(metrics){root.current.dataset.fps=metrics.fps.toFixed(1);root.current.dataset.drawCalls=metrics.drawCalls;root.current.dataset.triangles=metrics.triangles;}}},[]);
 useEffect(()=>{
  if(fallback)return;
  let inView=true;const update=()=>{const el=root.current;if(!el)return;const rect=el.getBoundingClientRect();inView=rect.bottom>1 && rect.top<window.innerHeight-1;setActive(inView&&!document.hidden);targetProgress.current=Math.max(0,Math.min(1,-rect.top/Math.max(1,el.offsetHeight-window.innerHeight)));};
  const visibility=()=>setActive(inView&&!document.hidden);
  window.addEventListener('scroll',update,{passive:true});window.addEventListener('resize',update);document.addEventListener('visibilitychange',visibility);update();
  return()=>{window.removeEventListener('scroll',update);window.removeEventListener('resize',update);document.removeEventListener('visibilitychange',visibility);};
 },[fallback]);
 const replay=()=>{root.current?.scrollIntoView({behavior:'instant'});targetProgress.current=0;};
 if(fallback)return <section className="temple-static" aria-label={lang?'திருமண அழைப்பிதழ்':'Wedding invitation'}>
  {[['temple-exterior.webp',0],['temple-corridor.webp',2],['temple-ceremony.webp',5]].map(([image,index])=><article key={image}><img src={`${ASSET}${image}`} alt={index===0?'Sunlit Tamil temple':index===2?'Temple corridor':'The couple at their wedding ceremony'}/><div><p className="overline">{chapters[index].label[lang]}</p><h1>{chapters[index].title[lang]}</h1><p>{chapters[index].detail[lang]}</p>{index===2&&<p>{chapters[3].title[lang]} · {chapters[3].detail[lang]}</p>}{index===0&&<button onClick={goToInvitation}>{lang?'விழா விவரங்கள்':'View invitation'} ↓</button>}</div></article>)}
 </section>;
 const current=chapters[chapter];
 return <section ref={root} className="temple-journey" id="journey" data-ready={ready} data-active={active} aria-label={lang?'கோவிலுக்குள் ஒரு பயணம்':'A journey into the temple'}>
  <div className="temple-stage">
   <div className="temple-poster" style={{opacity:ready?0:1}}><img src={`${ASSET}temple-exterior.webp`} alt=""/><span>{lang?'கோவிலுக்குள் வரவேற்கிறோம்…':'Preparing your journey…'}</span></div>
   <div className="temple-canvas" aria-hidden="true"><SceneBoundary onFailure={onFailure}><Suspense fallback={null}><TempleScene targetProgress={targetProgress} onProgress={onProgress} onReady={onReady} onFailure={onFailure} active={active}/></Suspense></SceneBoundary></div>
   <div className="journey-shade"/>
   <div className="journey-brand"><span className="brand-mark">M <i>&</i> N</span><span>THE WEDDING · 2026</span></div>
   <div className={`journey-caption ${chapter===0?'opening':''} ${lang?'tamil':''}`} key={`${chapter}-${lang}`}><p className="overline">{current.label[lang]}</p><h1>{current.title[lang]}</h1><p className="journey-detail">{current.detail[lang]}</p></div>
   <div className="journey-bottom"><div className="journey-step"><span>{String(chapter+1).padStart(2,'0')}</span><span className="step-divider"/><span>07</span></div><span className="journey-scroll">{lang?'பயணிக்க ஸ்க்ரோல் செய்யுங்கள்':'SCROLL TO JOURNEY'} <span>↓</span></span><button onClick={chapter===6?replay:goToInvitation}>{chapter===6?(lang?'மீண்டும் பயணிக்க':'Replay journey'):(lang?'விழா விவரங்கள்':'Skip to invitation')} ↗</button></div>
   <div className="journey-progress"><i ref={bar}/></div>
  </div>
 </section>;
}

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { ArrowDown, ArrowRight, Check, ChevronDown, Languages, Music2, Sparkles, Volume2, VolumeX } from 'lucide-react';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/noto-sans-tamil/400.css';
import '@fontsource/noto-sans-tamil/500.css';
import './styles.css';

const ASSET = `${import.meta.env.BASE_URL}assets/generated/`;
const UI = createContext(null);
const copy = {
  venue: { en: 'Venue details coming soon', ta: 'இடம் குறித்த விவரங்கள் விரைவில்' },
  events: [
    { type: { en: 'Reception', ta: 'வரவேற்பு' }, date: { en: 'October 29', ta: 'அக்டோபர் 29' }, day: { en: 'Thursday', ta: 'வியாழக்கிழமை' }, time: { en: '6:30 PM onwards', ta: 'மாலை 6:30 முதல்' }, description: { en: 'An evening of music, dinner and blessings with the couple.', ta: 'இசை, விருந்து மற்றும் மணமக்களுக்கான ஆசீர்வாதங்களுடன் ஓர் இனிய மாலை.' }, Icon: Music2 },
    { type: { en: 'Muhurtham · Wedding', ta: 'முகூர்த்தம் · திருமணம்' }, date: { en: 'October 30', ta: 'அக்டோபர் 30' }, day: { en: 'Friday', ta: 'வெள்ளிக்கிழமை' }, time: { en: '6:00 AM – 7:30 AM', ta: 'காலை 6:00 – 7:30' }, description: { en: 'The sacred ceremony at the auspicious hour, followed by breakfast.', ta: 'மங்களகரமான நேரத்தில் புனித திருமணச் சடங்கு, அதனைத் தொடர்ந்து காலை உணவு.' }, Icon: Sparkles },
  ],
};

function Txt({ en, ta, as: Tag = 'span', className = '' }) {
  const { language } = useContext(UI);
  if (language === 'ta') return <Tag className={`txt tamil ${className}`} lang="ta">{ta}</Tag>;
  return <Tag className={`txt bilingual ${className}`} data-ta={ta}><span>{en}</span></Tag>;
}

function useAmbient(theme, enabled) {
  const nodes = useRef(null);
  useEffect(() => {
    if (!enabled) { nodes.current?.context.close(); nodes.current = null; return; }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const context = new AudioCtx(); const gain = context.createGain(); gain.gain.value = 0.035; gain.connect(context.destination);
    const frequencies = theme === 'traditional' ? [110, 164.81, 220] : [98, 146.83, 293.66];
    const oscillators = frequencies.map((frequency, index) => { const osc = context.createOscillator(); const level = context.createGain(); osc.type = index ? 'sine' : 'triangle'; osc.frequency.value = frequency; level.gain.value = index ? .18 : .32; osc.connect(level).connect(gain); osc.start(); return osc; });
    nodes.current = { context, oscillators };
    const visibility = () => document.hidden ? context.suspend() : context.resume(); document.addEventListener('visibilitychange', visibility);
    return () => { document.removeEventListener('visibilitychange', visibility); oscillators.forEach(o => o.stop()); context.close(); nodes.current = null; };
  }, [theme, enabled]);
}

function Shell({ children, theme }) {
  const [language, setLanguage] = useState('en'); const [soundEnabled, setSoundEnabled] = useState(false); const reduce = useReducedMotion();
  useAmbient(theme, soundEnabled && !reduce); const location = useLocation(); useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  return <UI.Provider value={{ language, setLanguage, soundEnabled, setSoundEnabled, reducedExperience: reduce }}>
    <a className="skip" href="#main">Skip to invitation</a>
    <header className={`site-controls ${theme}`}><nav aria-label="Invitation style"><Link className={theme === 'traditional' ? 'active' : ''} to="/traditional">Temple</Link><Link className={theme === 'modern' ? 'active' : ''} to="/modern">Museum</Link></nav><button type="button" onClick={() => setLanguage(v => v === 'en' ? 'ta' : 'en')} aria-label="Switch language"><Languages/><span>{language === 'en' ? 'தமிழ்' : 'EN'}</span></button><button type="button" onClick={() => setSoundEnabled(v => !v)} aria-pressed={soundEnabled} aria-label={soundEnabled ? 'Mute ambience' : 'Play ambience'}>{soundEnabled ? <Volume2/> : <VolumeX/>}</button></header>
    <AnimatePresence mode="wait"><motion.div key={location.pathname} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{children}</motion.div></AnimatePresence>
  </UI.Provider>;
}

function ScrollHint({ label, ta }) { return <a className="scroll-hint" href="#journey"><Txt en={label} ta={ta}/><ChevronDown/></a>; }
function TraditionalHero() {
  const ref = useRef(null); const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] }); const scale = useTransform(scrollYProgress, [0, 1], [1, 1.22]); const opacity = useTransform(scrollYProgress, [.55, 1], [1, .2]);
  return <section className="t-hero" ref={ref}><motion.img style={{ scale }} src={`${ASSET}temple-exterior.png`} alt="A flower-decorated South Indian temple at sunrise"/><div className="t-vignette"/><motion.div className="hero-copy" style={{ opacity }}><Txt as="p" className="overline" en="With the blessings of our families" ta="எங்கள் குடும்பங்களின் ஆசீர்வாதங்களுடன்"/><span className="sacred-mark">ௐ</span><h1><Txt en="Mohan" ta="மோகன்"/><em>weds</em><Txt en="Nandhini" ta="நந்தினி"/></h1><Txt as="p" className="hero-date" en="30 October 2026" ta="30 அக்டோபர் 2026"/><ScrollHint label="Enter the temple" ta="கோவிலுக்குள் வாருங்கள்"/></motion.div></section>;
}

function Corridor() {
  const ref = useRef(null); const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] }); const scale = useTransform(scrollYProgress, [0, 1], [1.14, 1]); const left = useTransform(scrollYProgress, [.15, .45], [-60, 0]); const right = useTransform(scrollYProgress, [.35, .65], [60, 0]);
  return <section className="corridor" id="journey" ref={ref}><motion.img style={{ scale }} src={`${ASSET}temple-corridor.png`} alt="A lamp-lit temple corridor leading to the wedding mandapam"/><div className="corridor-shade"/><motion.article className="family-stone left" style={{ x: left }}><span>01</span><Txt as="h2" en="Mohan" ta="மோகன்"/><Txt as="p" en="Son of Mr. P. Karthikeyan & Mrs. K. Meenakshi" ta="திரு. பி. கார்த்திகேயன் மற்றும் திருமதி கே. மீனாட்சி அவர்களின் புதல்வர்"/></motion.article><motion.article className="family-stone right" style={{ x: right }}><span>02</span><Txt as="h2" en="Nandhini" ta="நந்தினி"/><Txt as="p" en="Daughter of Mr. R. Ganesan & Mrs. G. Jayalakshmi" ta="திரு. ஆர். கணேசன் மற்றும் திருமதி ஜி. ஜெயலட்சுமி அவர்களின் புதல்வி"/></motion.article><div className="threshold"><Txt en="Two families · One sacred beginning" ta="இரு குடும்பங்கள் · ஒரு புனித தொடக்கம்"/></div></section>;
}

function Ceremony() {
  const ref = useRef(null); const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] }); const x = useTransform(scrollYProgress, [0, .5, 1], [-16, 0, 16]); const scale = useTransform(scrollYProgress, [0, .5, 1], [1.07, 1, 1.08]);
  return <section className="ceremony" ref={ref}><motion.img style={{ x, scale }} src={`${ASSET}temple-ceremony.png`} alt="A stylized animated portrait of Mohan and Nandhini at their wedding ceremony"/><div className="ceremony-frame"/><div className="petals" aria-hidden="true">{[...Array(12)].map((_,i)=><i key={i} style={{'--i':i}}/>)}</div><div className="ceremony-caption"><Txt as="p" className="overline" en="The auspicious hour" ta="மங்கள நேரம்"/><Txt as="h2" en="Where forever begins." ta="என்றென்றும் இங்கே தொடங்குகிறது."/></div></section>;
}

function EventCards({ variant }) { return <section className={`events ${variant}`}><div className="section-heading"><Txt as="p" className="overline" en="The celebrations" ta="திருமண விழாக்கள்"/><Txt as="h2" en={variant === 'temple-events' ? 'An evening & a dawn of joy' : 'Two moments. One beginning.'} ta={variant === 'temple-events' ? 'மகிழ்ச்சியின் ஓர் மாலையும் விடியலும்' : 'இரு தருணங்கள். ஒரு தொடக்கம்.'}/></div><div className="event-list">{copy.events.map((event, index)=><motion.article key={event.type.en} initial={{ opacity:0, y:40 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true, amount:.25 }}><span className="event-no">0{index+1}</span><event.Icon/><Txt as="p" className="overline" {...event.type}/><Txt as="h3" {...event.date}/><Txt as="p" className="event-time" en={`${event.day.en} · ${event.time.en}`} ta={`${event.day.ta} · ${event.time.ta}`}/><Txt as="p" className="event-desc" {...event.description}/><Txt as="p" className="venue" {...copy.venue}/></motion.article>)}</div></section>; }

function RSVP({ variant }) {
  const { language } = useContext(UI); const [sent, setSent] = useState(false); const [error, setError] = useState(''); const tr = (en, ta) => language === 'ta' ? ta : en;
  const submit = e => { e.preventDefault(); const data = new FormData(e.currentTarget); if (!data.get('name')?.trim() || !data.get('phone')?.trim() || !data.get('attendance')) { setError(tr('Please complete the required fields.', 'தேவையான விவரங்களைப் பூர்த்தி செய்யுங்கள்.')); return; } setError(''); setSent(true); };
  return <section className={`rsvp ${variant}`} id="rsvp"><div className="rsvp-intro"><Txt as="p" className="overline" en={variant === 'museum-rsvp' ? 'The guest book' : 'A place is set for you'} ta={variant === 'museum-rsvp' ? 'விருந்தினர் பதிவு' : 'உங்களுக்காக ஓர் இடம் காத்திருக்கிறது'}/><Txt as="h2" en="Will you join us?" ta="எங்களுடன் இணைவீர்களா?"/><Txt as="p" en="Your presence is the most precious blessing. Kindly respond for our celebration." ta="உங்கள் வருகையே எங்களுக்குக் கிடைக்கும் மிகப் பெரிய ஆசீர்வாதம். அன்புடன் உங்கள் பதிலைத் தெரிவியுங்கள்."/></div>{sent ? <div className="success" role="status"><span><Check/></span><Txt as="h3" en="Response received" ta="உங்கள் பதில் பெறப்பட்டது"/><Txt as="p" en="Preview complete — no information was stored." ta="முன்னோட்டம் நிறைவடைந்தது — எந்தத் தகவலும் சேமிக்கப்படவில்லை."/><button type="button" onClick={()=>setSent(false)}>{tr('Edit response','பதிலைத் திருத்துங்கள்')}</button></div> : <form onSubmit={submit} noValidate><label>{tr('Your name *','உங்கள் பெயர் *')}<input name="name" autoComplete="name" placeholder={tr('e.g. Arjun Kumar','எ.கா. அர்ஜுன் குமார்')}/></label><div className="fields"><label>{tr('Will you attend? *','வருகை தருவீர்களா? *')}<select name="attendance" defaultValue=""><option value="" disabled>{tr('Select an answer','பதிலைத் தேர்ந்தெடுக்கவும்')}</option><option value="yes">{tr('Joyfully attending','மகிழ்ச்சியுடன் வருகிறேன்')}</option><option value="no">{tr('Unable to attend','வர இயலாது')}</option></select></label><label>{tr('Number of guests','விருந்தினர்கள் எண்ணிக்கை')}<select name="guests" defaultValue="1">{[1,2,3,4].map(n=><option key={n}>{n}</option>)}</select></label></div><label>{tr('Phone number *','தொலைபேசி எண் *')}<input name="phone" type="tel" autoComplete="tel" placeholder={tr('Your contact number','உங்கள் தொடர்பு எண்')}/></label><label>{tr('A note for the couple (optional)','மணமக்களுக்கு ஒரு குறிப்பு (விருப்பத்தேர்வு)')}<textarea name="message" rows="3" placeholder={tr('Share your wishes…','உங்கள் வாழ்த்துகளைப் பகிருங்கள்…')}/></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="submit" type="submit"><Txt en="Send my RSVP" ta="என் பதிலை அனுப்பவும்"/><ArrowRight/></button><small>{tr('Demo only — this response will not be saved.','மாதிரி மட்டும் — இந்தப் பதில் சேமிக்கப்படாது.')}</small></form>}</section>;
}

function Traditional() { return <Shell theme="traditional"><main id="main" className="traditional"><TraditionalHero/><Corridor/><Ceremony/><EventCards variant="temple-events"/><RSVP variant="temple-rsvp"/><footer><span>ௐ</span><Txt en="Mohan & Nandhini · 30.10.2026" ta="மோகன் & நந்தினி · 30.10.2026"/></footer></main></Shell>; }
function MuseumHero() {
  const ref = useRef(null); const { scrollYProgress } = useScroll({ target: ref, offset:['start start','end start'] }); const scale=useTransform(scrollYProgress,[0,1],[1,1.18]); const y=useTransform(scrollYProgress,[0,1],[0,90]);
  return <section className="m-hero" ref={ref}><motion.img style={{scale}} src={`${ASSET}museum-gallery.png`} alt="A contemporary gallery installation celebrating Mohan and Nandhini"/><div className="m-overlay"/><motion.div className="museum-title" style={{y}}><Txt as="p" className="museum-label" en="Exhibition 30 · 10 · 26" ta="கண்காட்சி 30 · 10 · 26"/><h1><Txt en="Museum" ta="நினைவகம்"/><i>of</i><Txt en="Us" ta="நாம்"/></h1><ScrollHint label="Begin the tour" ta="பயணத்தைத் தொடங்குங்கள்"/></motion.div><div className="marquee" aria-hidden="true"><span>MOHAN + NANDHINI — ONE BEAUTIFUL BEGINNING — </span><span>MOHAN + NANDHINI — ONE BEAUTIFUL BEGINNING — </span></div></section>;
}

function PortraitRoom() { return <section className="portrait-room" id="journey"><div className="room-intro"><Txt as="p" className="overline" en="Room 01 · The people" ta="அறை 01 · மணமக்கள்"/><Txt as="h2" en="Two portraits. One future." ta="இரு முகங்கள். ஓர் எதிர்காலம்."/></div><div className="turntable"><img src={`${ASSET}couple-turnaround.png`} alt="Stylized character study of Mohan and Nandhini from several angles"/><div className="scanline"/><span>FRONT</span><span>¾</span><span>PROFILE</span><span>REAR</span></div><div className="museum-families"><article><b>01</b><Txt as="h3" en="Mohan" ta="மோகன்"/><Txt as="p" en="Son of Mr. P. Karthikeyan & Mrs. K. Meenakshi" ta="திரு. பி. கார்த்திகேயன் மற்றும் திருமதி கே. மீனாட்சி அவர்களின் புதல்வர்"/></article><article><b>02</b><Txt as="h3" en="Nandhini" ta="நந்தினி"/><Txt as="p" en="Daughter of Mr. R. Ganesan & Mrs. G. Jayalakshmi" ta="திரு. ஆர். கணேசன் மற்றும் திருமதி ஜி. ஜெயலட்சுமி அவர்களின் புதல்வி"/></article></div></section>; }
function Modern() { return <Shell theme="modern"><main id="main" className="modern"><MuseumHero/><PortraitRoom/><EventCards variant="museum-events"/><section className="finale"><img src={`${ASSET}museum-gallery.png`} alt="The Museum of Us finale"/><div><Txt as="p" className="overline" en="Final room · Forever" ta="இறுதி அறை · என்றென்றும்"/><Txt as="h2" en="Meet us at the beginning." ta="எங்கள் புதிய தொடக்கத்தில் சந்திப்போம்."/><a href="#rsvp"><Txt en="Leave your name in our guest book" ta="எங்கள் விருந்தினர் பதிவில் உங்கள் பெயரைச் சேருங்கள்"/><ArrowDown/></a></div></section><RSVP variant="museum-rsvp"/><footer><Txt en="Come for the vows. Stay for the feast." ta="திருமணத்திற்கு வாருங்கள். விருந்துடன் மகிழுங்கள்."/><span>M + N</span></footer></main></Shell>; }
function App(){ return <BrowserRouter basename={import.meta.env.BASE_URL}><Routes><Route path="/traditional" element={<Traditional/>}/><Route path="/modern" element={<Modern/>}/><Route path="*" element={<Navigate to="/traditional" replace/>}/></Routes></BrowserRouter>; }
createRoot(document.getElementById('root')).render(<App/>);

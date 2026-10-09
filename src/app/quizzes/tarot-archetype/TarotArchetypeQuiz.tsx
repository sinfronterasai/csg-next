"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./TarotArchetypeQuiz.module.css";

const QUIZ_URL = "https://cosmicspiritguide.com/quizzes/tarot-archetype";
const STORAGE_KEY = "csg-archetype-drop-v1";

type ArchetypeKey = "seeker" | "creator" | "intuitive" | "nurturer" | "builder" | "connector" | "pathfinder" | "reflector";
type WeightMap = Partial<Record<ArchetypeKey, number>>;
type Archetype = { name: string; card: string; theme: string; line: string; traits: string[]; desc: string; strength: string; watch: string; reflect: string };
type Question = { q: string; sub: string; answers: { text: string; weights: WeightMap }[] };

const ORDER: ArchetypeKey[] = ["seeker", "creator", "intuitive", "nurturer", "builder", "connector", "pathfinder", "reflector"];

const ARCHETYPES: Record<ArchetypeKey, Archetype> = {
  seeker: { name: "The Seeker", card: "The Fool", theme: "Exploration", line: "You learn the map by walking it.", traits: ["Curious", "Open-handed", "Restless in a good way"], desc: "You move toward the unknown with curiosity rather than caution. New places, new ideas and unfinished paths feel like invitations, not warnings. You would rather learn by trying than by waiting for certainty.", strength: "You start things other people only talk about.", watch: "You can leave before the interesting part arrives.", reflect: "Where would a small experiment help?" },
  creator: { name: "The Creator", card: "The Magician", theme: "Initiative", line: "You make the tool you need.", traits: ["Inventive", "Resourceful", "Action-oriented"], desc: "You see raw material where others see a dead end. Given a problem, your instinct is to make something — a plan, a prototype, a way through. You trust that the tools you need are already within reach.", strength: "You turn ideas into something real.", watch: "You can start more than you finish.", reflect: "What resource can you use today?" },
  intuitive: { name: "The Intuitive", card: "The High Priestess", theme: "Inner awareness", line: "You know before you can explain.", traits: ["Perceptive", "Reflective", "Deeply private"], desc: "You notice what is not being said. Before the evidence is complete, something in you already knows — and you have learned to trust that quiet signal. Your best answers tend to arrive when you stop forcing them.", strength: "You read situations other people miss.", watch: "You can keep insight to yourself too long.", reflect: "What deserves more attention before action?" },
  nurturer: { name: "The Nurturer", card: "The Empress", theme: "Care and growth", line: "You grow what you tend.", traits: ["Warm", "Generous", "Steady"], desc: "You grow things — people, projects, small daily rituals. You give attention generously and you are often the reason something fragile survives its early days. Your presence makes room for others to become themselves.", strength: "You make people feel safe enough to grow.", watch: "You can give past the point of refilling.", reflect: "Where are you giving without replenishing?" },
  builder: { name: "The Builder", card: "The Emperor", theme: "Structure", line: "You build what holds.", traits: ["Grounded", "Disciplined", "Reliable"], desc: "You make things dependable. Where others see chaos, you see a system waiting to be drawn. You value clear agreements, solid foundations and the quiet satisfaction of a plan that holds.", strength: "You create stability other people can stand on.", watch: "You can hold the structure tighter than it needs.", reflect: "What simple boundary would help?" },
  connector: { name: "The Connector", card: "The Lovers", theme: "Values and connection", line: "You choose by what you love.", traits: ["Empathetic", "Loyal", "Value-driven"], desc: "You think in relationships. Choices are not just about outcomes for you — they are about what they mean and who they bring closer. You are at your best when what you do lines up with what you value.", strength: "You bring people and purpose together.", watch: "You can delay a decision to keep everyone happy.", reflect: "Which choice matches your values?" },
  pathfinder: { name: "The Pathfinder", card: "The Chariot", theme: "Direction", line: "You find the way by moving.", traits: ["Driven", "Decisive", "Forward-leaning"], desc: "You move. When something matters, you find the route and take it, adjusting as you go. Momentum is your natural state, and you would rather be in motion toward something than perfectly still.", strength: "You get things moving when they are stuck.", watch: "You can outrun the reason you started.", reflect: "What is the next manageable step?" },
  reflector: { name: "The Reflector", card: "The Hermit", theme: "Perspective", line: "You see clearly in the quiet.", traits: ["Thoughtful", "Observant", "Self-possessed"], desc: "You understand by looking inward. Solitude is not withdrawal for you — it is where the picture sharpens. You would rather see clearly than move quickly, and your calm is often what steadies everyone else.", strength: "You see what only distance reveals.", watch: "You can wait for certainty that never comes.", reflect: "What becomes clearer when you slow down?" },
};

const QUESTIONS: Question[] = [
  { q: "When you meet something completely unfamiliar, what do you do first?", sub: "Think about the last time you were genuinely out of your depth.", answers: [{ text: "Dive in and see what happens", weights: { seeker: 3, pathfinder: 1 } }, { text: "Read and absorb everything I can", weights: { intuitive: 3, reflector: 1 } }, { text: "Ask someone who has done it before", weights: { connector: 3, nurturer: 1 } }, { text: "Map out the steps before I start", weights: { builder: 3, creator: 1 } }] },
  { q: "When a plan falls apart, what is your first move?", sub: "Not the ideal response — the one you actually have.", answers: [{ text: "Step back and think it through", weights: { reflector: 3, intuitive: 1 } }, { text: "Try a completely different approach", weights: { creator: 3, seeker: 1 } }, { text: "Rally the people involved", weights: { connector: 3, nurturer: 1 } }, { text: "Build a practical replacement plan", weights: { builder: 3, pathfinder: 1 } }] },
  { q: "What do your friends most rely on you for?", sub: "The role you fall into without being asked.", answers: [{ text: "Being the calm, steady one", weights: { reflector: 3, builder: 1 } }, { text: "Coming up with the ideas", weights: { creator: 3, seeker: 1 } }, { text: "Really listening", weights: { nurturer: 3, intuitive: 1 } }, { text: "Getting things moving", weights: { pathfinder: 3, connector: 1 } }] },
  { q: "How do you choose between two good options?", sub: "When both would work, what tips it?", answers: [{ text: "Which one feels right", weights: { intuitive: 3, reflector: 1 } }, { text: "Which one I can start today", weights: { pathfinder: 3, seeker: 1 } }, { text: "Which one fits my values", weights: { connector: 3, nurturer: 1 } }, { text: "Which one is most solid", weights: { builder: 3, creator: 1 } }] },
  { q: "After a demanding day, how do you recover?", sub: "What actually restores you, not what you think should.", answers: [{ text: "Quiet time on my own", weights: { reflector: 3, intuitive: 1 } }, { text: "Making something", weights: { creator: 3, builder: 1 } }, { text: "Time with people I love", weights: { nurturer: 3, connector: 1 } }, { text: "Getting outside and moving", weights: { seeker: 3, pathfinder: 1 } }] },
  { q: "What currently feels most worth pursuing?", sub: "Right now, in this season of your life.", answers: [{ text: "Something new I have never tried", weights: { seeker: 3, creator: 1 } }, { text: "A deeper understanding", weights: { intuitive: 3, reflector: 1 } }, { text: "A goal I have been circling", weights: { pathfinder: 3, builder: 1 } }, { text: "Stronger bonds", weights: { nurturer: 3, connector: 1 } }] },
];

function sigil(key: ArchetypeKey) {
  const common = '<circle cx="32" cy="32" r="30" stroke="rgba(201,204,214,.30)" stroke-width="1"/><circle cx="32" cy="32" r="22" stroke="rgba(169,143,224,.45)" stroke-width="1"/>';
  const inner: Record<ArchetypeKey, string> = {
    seeker: '<path d="M32 14l3.6 12.4L48 30l-12.4 3.6L32 46l-3.6-12.4L16 30l12.4-3.6z" fill="#c9ccd6"/><circle cx="32" cy="30" r="2.6" fill="#4b0082"/>',
    creator: '<path d="M32 15v30M17 30h30" stroke="#c9ccd6" stroke-width="2.2" stroke-linecap="round"/><circle cx="32" cy="30" r="6.5" stroke="#a98fe0" stroke-width="1.6" fill="none"/>',
    intuitive: '<path d="M32 15c7 6 7 24 0 30-7-6-7-24 0-30z" fill="#c9ccd6"/><circle cx="32" cy="30" r="3" fill="#4b0082"/>',
    nurturer: '<path d="M32 45c-9-6-13-13-13-19a7 7 0 0113-4 7 7 0 0113 4c0 6-4 13-13 19z" fill="#c9ccd6"/>',
    builder: '<path d="M18 42V22l14-8 14 8v20" stroke="#c9ccd6" stroke-width="2.2" fill="none" stroke-linejoin="round"/><path d="M26 42V30h12v12" stroke="#a98fe0" stroke-width="1.6" fill="none"/>',
    connector: '<circle cx="25" cy="30" r="8" stroke="#c9ccd6" stroke-width="2" fill="none"/><circle cx="39" cy="30" r="8" stroke="#a98fe0" stroke-width="2" fill="none"/>',
    pathfinder: '<path d="M32 14l9 16-9 16-9-16z" fill="#c9ccd6"/><circle cx="32" cy="30" r="2.6" fill="#4b0082"/>',
    reflector: '<circle cx="32" cy="30" r="11" stroke="#c9ccd6" stroke-width="2" fill="none"/><path d="M32 19v22" stroke="#a98fe0" stroke-width="1.4"/><circle cx="32" cy="30" r="3" fill="#c9ccd6"/>',
  };
  return common + inner[key];
}

function score(answers: number[]) {
  const raw = Object.fromEntries(ORDER.map((key) => [key, 0])) as Record<ArchetypeKey, number>;
  const max = Object.fromEntries(ORDER.map((key) => [key, 0])) as Record<ArchetypeKey, number>;
  answers.forEach((answer, questionIndex) => {
    if (answer === -1) return;
    Object.entries(QUESTIONS[questionIndex].answers[answer].weights).forEach(([key, weight]) => { raw[key as ArchetypeKey] += weight || 0; });
  });
  QUESTIONS.forEach((question) => ORDER.forEach((key) => { max[key] += Math.max(...question.answers.map((answer) => answer.weights[key] || 0)); }));
  let bestKey = ORDER[0]; let bestValue = -1;
  ORDER.forEach((key) => { const normalized = max[key] ? raw[key] / max[key] : 0; if (normalized > bestValue + 1e-9) { bestValue = normalized; bestKey = key; } });
  return { key: bestKey, raw };
}

function drawCard(canvas: HTMLCanvasElement, key: ArchetypeKey) {
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  const a = ARCHETYPES[key]; const W = canvas.width; const H = canvas.height;
  const gradient = ctx.createLinearGradient(0, 0, W, H); gradient.addColorStop(0, "#1e1733"); gradient.addColorStop(.55, "#151024"); gradient.addColorStop(1, "#0d0a16"); ctx.fillStyle = gradient; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, H * .16, 0, W / 2, H * .16, W * .95); glow.addColorStop(0, "rgba(123,63,212,.55)"); glow.addColorStop(1, "rgba(123,63,212,0)"); ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H * .7);
  ctx.strokeStyle = "rgba(201,204,214,.28)"; ctx.lineWidth = 2; ctx.strokeRect(46, 46, W - 92, H - 92); ctx.strokeStyle = "rgba(169,143,224,.35)"; ctx.lineWidth = 1; ctx.strokeRect(62, 62, W - 124, H - 124);
  ctx.textAlign = "center"; ctx.fillStyle = "#dfb76c"; ctx.font = "600 26px Cinzel, Georgia, serif"; ctx.fillText("C O S M I C   S P I R I T   G U I D E", W / 2, 150);
  ctx.fillStyle = "#a98fe0"; ctx.font = "600 24px Inter, sans-serif"; ctx.fillText("Y O U R   T A R O T   A R C H E T Y P E", W / 2, 560);
  ctx.fillStyle = "#eef0f6"; ctx.font = "500 86px 'Cormorant Garamond', Georgia, serif"; ctx.fillText(a.name, W / 2, 680);
  ctx.fillStyle = "#a98fe0"; ctx.font = "600 30px Inter, sans-serif"; ctx.fillText(`${a.card} · ${a.theme}`.toUpperCase(), W / 2, 740);
  ctx.strokeStyle = "rgba(201,204,214,.30)"; ctx.beginPath(); ctx.moveTo(W / 2 - 90, 800); ctx.lineTo(W / 2 + 90, 800); ctx.stroke();
  ctx.fillStyle = "#c9ccd6"; ctx.font = "italic 500 46px 'Cormorant Garamond', Georgia, serif"; ctx.fillText(`“${a.line}”`, W / 2, 900);
  ctx.fillStyle = "#8b8fa0"; ctx.font = "600 24px Inter, sans-serif"; ctx.fillText(a.traits.join("   ·   ").toUpperCase(), W / 2, 1080);
  ctx.fillStyle = "#c9ccd6"; ctx.font = "600 25px Inter, sans-serif"; ctx.fillText("cosmicspiritguide.com/quizzes/tarot-archetype", W / 2, 1230); ctx.fillStyle = "#8b8fa0"; ctx.font = "400 22px Inter, sans-serif"; ctx.fillText("Take the quiz → find your archetype", W / 2, 1272);
}

export default function TarotArchetypeQuiz() {
  const [screen, setScreen] = useState<"landing" | "quiz" | "result">("landing");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>(() => Array(QUESTIONS.length).fill(-1));
  const [resultKey, setResultKey] = useState<ArchetypeKey | null>(null);
  const [email, setEmail] = useState("");
  const [emailNote, setEmailNote] = useState("Optional. Your result is never locked behind this. Marketing consent is separate from receiving a copy.");
  const [toast, setToast] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const result = resultKey ? ARCHETYPES[resultKey] : null;
  const currentAnswer = answers[index];
  const why = useMemo(() => resultKey ? answers.map((answer, questionIndex) => ({ answer, questionIndex, weight: answer >= 0 ? QUESTIONS[questionIndex].answers[answer].weights[resultKey] || 0 : 0 })).filter((item) => item.weight > 0).sort((a, b) => b.weight - a.weight).slice(0, 2) : [], [answers, resultKey]);

  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); if (saved?.answers?.length === QUESTIONS.length) { setAnswers(saved.answers); setIndex(Math.min(Math.max(0, saved.index || 0), QUESTIONS.length - 1)); } } catch {} }, []);
  useEffect(() => { if (screen === "result" && resultKey && canvasRef.current) drawCard(canvasRef.current, resultKey); }, [screen, resultKey]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 2400); return () => window.clearTimeout(timer); }, [toast]);

  function save(nextAnswers: number[], nextIndex: number) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ answers: nextAnswers, index: nextIndex })); } catch {} }
  function start() { if (answers.every((answer) => answer !== -1)) { finish(); return; } setScreen("quiz"); }
  function selectAnswer(answer: number) { const next = [...answers]; next[index] = answer; setAnswers(next); save(next, index); }
  function next() { if (currentAnswer === -1) return; if (index < QUESTIONS.length - 1) { const nextIndex = index + 1; setIndex(nextIndex); save(answers, nextIndex); } else finish(); }
  function finish() { const scored = score(answers); setResultKey(scored.key); setScreen("result"); try { localStorage.removeItem(STORAGE_KEY); } catch {} }
  function restart() { const blank = Array(QUESTIONS.length).fill(-1); setAnswers(blank); setIndex(0); setResultKey(null); setScreen("quiz"); try { localStorage.removeItem(STORAGE_KEY); } catch {} }
  function caption() { if (!resultKey) return ""; const a = ARCHETYPES[resultKey]; return `I'm ${a.name} — ${a.card} (${a.theme}). “${a.line}”\nFind your tarot archetype: ${QUIZ_URL}`; }
  async function copyCaption() { try { await navigator.clipboard.writeText(caption()); setToast("Caption & link copied"); } catch { setToast("Copy failed — select manually"); } }
  async function share() { if (!resultKey) return; const text = caption(); if (navigator.share) { try { await navigator.share({ title: `My tarot archetype: ${ARCHETYPES[resultKey].name}`, text, url: QUIZ_URL }); setToast("Shared"); } catch {} } else copyCaption(); }
  function download() { if (!canvasRef.current || !resultKey) return; const link = document.createElement("a"); link.href = canvasRef.current.toDataURL("image/png"); link.download = `csg-archetype-${resultKey}.png`; link.click(); setToast("Card downloaded"); }
  function submitEmail() { if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setToast("Enter a valid email"); return; } setEmail(""); setEmailNote("Thanks — we'll send next week's reflection. Your result stays yours either way."); setToast("Saved"); }

  return <div className={styles.page}>
    <div className={styles.wrap}>
      <div className={styles.brand}><svg className={styles.brandMark} viewBox="0 0 40 40" fill="none" aria-hidden="true"><defs><mask id="csgMoon"><rect width="40" height="40" fill="#000"/><circle cx="20" cy="20" r="8.6" fill="#fff"/><circle cx="24.6" cy="18.2" r="7.4" fill="#000"/></mask></defs><circle cx="20" cy="20" r="18.2" stroke="#dfb76c" strokeWidth="1.9" transform="rotate(45 20 20)"/><circle cx="20" cy="20" r="14.4" stroke="#dfb76c" strokeWidth="1.5" strokeDasharray="3.4 3.2" transform="rotate(-45 20 20)"/><rect width="40" height="40" fill="#dfb76c" mask="url(#csgMoon)"/></svg><span className={styles.brandName}>Cosmic Spirit Guide</span></div>

      {screen === "landing" && <section className={styles.screen} aria-labelledby="landing-title"><p className={styles.eyebrow}>The Archetype Drop</p><h1 id="landing-title" className={styles.title}>What's Your <em>Tarot Archetype?</em></h1><p className={styles.lede}>Answer 6 questions to explore the tarot themes that reflect how you move through life. Free, with no signup needed.</p><div className={styles.metaRow}><span className={styles.chip}>6 questions</span><span className={styles.chip}>~90 seconds</span><span className={styles.chip}>No signup</span></div><div className={styles.example} aria-hidden="true"><p className={styles.exLabel}>Example result</p><svg className={styles.exSigil} viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="30" stroke="rgba(201,204,214,.35)"/><circle cx="32" cy="32" r="22" stroke="rgba(169,143,224,.5)"/><path d="M32 12l4.4 11.6L48 28l-11.6 4.4L32 44l-4.4-11.6L16 28l11.6-4.4z" fill="#c9ccd6"/><circle cx="32" cy="28" r="3" fill="#4b0082"/></svg><p className={styles.exName}>The Signal Keeper</p><p className={styles.exCard}>The Star · Guidance</p><p className={styles.exLine}>“You hold the light steady for others.”</p></div><button className={styles.cta} onClick={start}>Start the quiz</button><p className={styles.fineprint}>For reflection, not a scientific assessment or a prediction. Your answers stay on your device.</p></section>}

      {screen === "quiz" && <section className={styles.screen} aria-labelledby="question-title"><div className={styles.qhead}><button className={styles.back} disabled={index === 0} onClick={() => { setIndex(index - 1); save(answers, index - 1); }}>← Back</button><span className={styles.qcount}>Question {index + 1} of {QUESTIONS.length}</span></div><div className={styles.progress} role="progressbar" aria-valuemin={0} aria-valuemax={6} aria-valuenow={index}><span className={styles.progressFill} style={{ width: `${(index / QUESTIONS.length) * 100}%` }} /></div><h2 id="question-title" className={styles.question}>{QUESTIONS[index].q}</h2><p className={styles.sub}>{QUESTIONS[index].sub}</p><div className={styles.answers} role="group" aria-labelledby="question-title">{QUESTIONS[index].answers.map((answer, answerIndex) => <button type="button" key={answer.text} className={`${styles.answer} ${currentAnswer === answerIndex ? styles.answerSelected : ""}`} aria-pressed={currentAnswer === answerIndex} onClick={() => selectAnswer(answerIndex)}><span className={styles.dot} aria-hidden="true" /><span>{answer.text}</span></button>)}</div><button className={styles.cta} disabled={currentAnswer === -1} onClick={next}>Continue</button><p className={styles.hint}>{currentAnswer === -1 ? "Select an answer to continue" : index === QUESTIONS.length - 1 ? "Ready to see your archetype" : "Tap continue"}</p></section>}

      {screen === "result" && result && resultKey && <section className={styles.screen} aria-labelledby="result-title"><div className={styles.resultHero}><p className={styles.resultLabel}>Your tarot archetype</p><svg className={styles.resultSigil} viewBox="0 0 64 64" fill="none" aria-hidden="true" dangerouslySetInnerHTML={{ __html: sigil(resultKey) }} /><h2 id="result-title" className={styles.resultName}>{result.name}</h2><p className={styles.resultCard}>{result.card} · {result.theme}</p><p className={styles.resultLine}>“{result.line}”</p><div className={styles.traits}>{result.traits.map((trait) => <span className={styles.trait} key={trait}>{trait}</span>)}</div></div><div className={styles.panel}><h3>What this means</h3><p>{result.desc}</p></div><div className={styles.panel}><h3>Why you got this</h3>{why.length ? why.map((item) => <div className={styles.why} key={item.questionIndex}><span className={styles.key}>Q{item.questionIndex + 1}</span><span className={styles.value}>“{QUESTIONS[item.questionIndex].answers[item.answer].text}” — this points toward {result.name}.</span></div>) : <div className={styles.why}><span className={styles.key}>Note</span><span className={styles.value}>Your answers spread evenly across themes, which is why {result.name} came out on top.</span></div>}</div><div className={styles.panel}><h3>Strength &amp; what to watch</h3><div className={styles.why}><span className={styles.key}>Strength</span><span className={styles.value}>{result.strength}</span></div><div className={styles.why}><span className={styles.key}>Watch for</span><span className={styles.value}>{result.watch}</span></div></div><div className={`${styles.panel} ${styles.reflect}`}><h3>Reflection prompt</h3><p>{result.reflect}</p></div><div className={styles.cardWrap}><p className={styles.cardLabel}>Your shareable result card</p><canvas ref={canvasRef} className={styles.canvas} width={1080} height={1350} aria-label="Shareable result card" /><div className={styles.actions}><button className={styles.cta} onClick={share}>Share</button><button className={`${styles.cta} ${styles.ghost}`} onClick={download}>Download</button><button className={`${styles.cta} ${styles.ghost} ${styles.full}`} onClick={copyCaption}>Copy caption &amp; link</button></div></div><div className={styles.next}><button className={styles.cta} onClick={() => window.open("/tarot", "_blank", "noopener,noreferrer")}>Explore this theme with a free tarot reading</button><p className={styles.fineprint}>Opens Cosmic Spirit Guide's free tarot experience.</p></div><div className={styles.email}><label htmlFor="archetype-email">Want next week's archetype reflection? Add your email — the result above is already yours.</label><div className={styles.emailRow}><input id="archetype-email" className={styles.emailInput} type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" /><button className={styles.emailButton} onClick={submitEmail}>Send</button></div><p className={styles.note}>{emailNote}</p></div><button className={styles.restart} onClick={restart}>Retake the quiz</button><footer className={styles.footer}><p>Cosmic Spirit Guide · The Archetype Drop<br />For reflection and entertainment. Not a scientific assessment or a prediction.<br /><a href="/tarot">cosmicspiritguide.com/tarot</a></p></footer></section>}
    </div>{toast && <div className={styles.toast} role="status" aria-live="polite">{toast}</div>}
  </div>;
}

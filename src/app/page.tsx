import Link from "next/link";

const phases = [
  { number: "01", name: "Strip", weeks: "Weeks 1—12", copy: "Cut with precision. Hold strength, reveal shape, and build the habits that make the next phase possible." },
  { number: "02", name: "Build", weeks: "Weeks 13—32", copy: "Twenty weeks of progressive overload focused on the shoulders, back, arms, and base that define the silhouette." },
  { number: "03", name: "Refine", weeks: "Weeks 33—36+", copy: "Keep the load. Lose the blur. Finish with a focused cut that holds onto everything you earned." },
];

const disciplines = [
  ["Training", "4—5 focused sessions each week"],
  ["Nutrition", "Phase-specific calorie and protein targets"],
  ["Recovery", "Sleep, steps, mobility, and stress control"],
  ["Tracking", "Every workout, habit, and weekly check-in"],
];

export default function HomePage() {
  return (
    <div className="landing-page">
      <header className="landing-nav">
        <Link href="/" className="landing-mark" aria-label="The Rebuild home"><span>RB</span><span>The Rebuild</span></Link>
        <nav aria-label="Primary navigation">
          <a href="#system">The system</a><a href="#standard">The standard</a><Link href="/login" className="nav-cta">Enter program</Link>
        </nav>
      </header>
      <main className="landing-main">
        <section className="landing-hero" aria-labelledby="hero-title">
          <div className="hero-signal" aria-hidden="true"><span>36</span><span>weeks</span></div>
          <div className="hero-copy">
            <p className="landing-kicker">A complete physical rebuild</p>
            <h1 id="hero-title">Build the frame.<br /><em>Earn the presence.</em></h1>
            <p className="hero-lede">A 36-week strength, nutrition, and discipline system built to create a powerful, athletic silhouette—without shortcuts or guesswork.</p>
            <div className="hero-actions">
              <Link href="/login" className="landing-button">Enter the program <span aria-hidden="true">↗</span></Link>
              <a href="#system" className="landing-text-link">Explore the blueprint <span aria-hidden="true">↓</span></a>
            </div>
          </div>
          <div className="hero-structure" aria-hidden="true">
            <div className="structure-grid">
              <span className="structure-label">Strength</span><span className="structure-label">Tension</span><span className="structure-label">Development</span>
              <span className="structure-bar bar-one" /><span className="structure-bar bar-two" /><span className="structure-bar bar-three" />
            </div>
            <div className="structure-caption">Built by repetition<br />Measured by proof</div>
          </div>
          <div className="hero-scroll" aria-hidden="true">Scroll to begin</div>
        </section>
        <section className="manifesto-section" id="standard">
          <p className="section-index">[ 001 ]</p>
          <div className="manifesto-copy"><p className="landing-kicker">The standard</p><h2>You do not need more motivation. You need a system that still works when motivation leaves.</h2></div>
          <p className="manifesto-note">The Rebuild turns the next 36 weeks into a clear sequence of work: what to lift, what to eat, what to measure, and when to adjust.</p>
        </section>
        <section className="system-section" id="system" aria-labelledby="system-title">
          <div className="section-heading">
            <div><p className="landing-kicker">The blueprint</p><h2 id="system-title">Three phases.<br />One direction.</h2></div>
            <p>The plan changes as your body changes. Each phase has one job, one set of targets, and a clear standard for progress.</p>
          </div>
          <div className="phase-list">
            {phases.map((phase) => <article className="phase-card" key={phase.number}><div className="phase-meta"><span>{phase.number}</span><span>{phase.weeks}</span></div><h3>{phase.name}</h3><p>{phase.copy}</p><span className="phase-line" aria-hidden="true" /></article>)}
          </div>
        </section>
        <section className="discipline-section" aria-labelledby="discipline-title">
          <div className="discipline-intro"><p className="section-index">[ 002 ]</p><p className="landing-kicker">The daily work</p><h2 id="discipline-title">A physique is the visible record of invisible standards.</h2></div>
          <div className="discipline-list">
            {disciplines.map(([title, copy], index) => <div className="discipline-row" key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{copy}</p></div>)}
          </div>
        </section>
        <section className="landing-close">
          <p className="landing-kicker">Week one starts when you do</p><h2>Stop collecting plans.<br /><em>Start the rebuild.</em></h2>
          <Link href="/login" className="landing-button light">Enter the program <span aria-hidden="true">↗</span></Link><div className="close-stamp" aria-hidden="true">36 / WEEKS</div>
        </section>
      </main>
      <footer className="landing-footer"><span>The Rebuild</span><span>Strength · Structure · Discipline</span><span>Built for the long game</span></footer>
    </div>
  );
}

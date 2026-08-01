export default function About() {
  return (
    <section id="about" className="py-24 relative z-10 bg-cosmic-900/60 border-y border-white/5">
      <div className="max-w-7xl mx-auto px-6 lg:px-16">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <span className="text-xs uppercase tracking-[0.4em] text-gold block mb-3">Ancient Mechanics</span>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white">How the Stars Guide Us</h2>
          <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-gold to-transparent mx-auto mt-6"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1 */}
          <div className="glass-panel p-8 rounded-3xl relative overflow-hidden group hover:border-gold/40 transition-all duration-300 hover:shadow-[0_0_20px_rgba(223,183,108,0.05)]">
            <div className="absolute -right-6 -bottom-6 text-9xl text-white/[0.02] font-serif font-black">01</div>
            <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center border border-gold/30 mb-6 text-gold text-xl">
              <i className="fa-solid fa-chart-pie"></i>
            </div>
            <h3 className="text-xl font-semibold mb-3 font-serif text-white group-hover:text-gold transition-colors">Birth Chart Anatomy</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Your birth chart (natal chart) is a cosmic snapshot of the exact sky when you were born, detailing the placements of planets in signs and houses.
            </p>
          </div>

          {/* Card 2 */}
          <div className="glass-panel p-8 rounded-3xl relative overflow-hidden group hover:border-gold/40 transition-all duration-300 hover:shadow-[0_0_20px_rgba(223,183,108,0.05)]">
            <div className="absolute -right-6 -bottom-6 text-9xl text-white/[0.02] font-serif font-black">02</div>
            <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center border border-gold/30 mb-6 text-gold text-xl">
              <i className="fa-solid fa-arrows-spin"></i>
            </div>
            <h3 className="text-xl font-semibold mb-3 font-serif text-white group-hover:text-gold transition-colors">Planetary Transits</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              As the planets continue their eternal dance across the night sky, their angles to your birth chart form transits, predicting cosmic seasons in your life.
            </p>
          </div>

          {/* Card 3 */}
          <div className="glass-panel p-8 rounded-3xl relative overflow-hidden group hover:border-gold/40 transition-all duration-300 hover:shadow-[0_0_20px_rgba(223,183,108,0.05)]">
            <div className="absolute -right-6 -bottom-6 text-9xl text-white/[0.02] font-serif font-black">03</div>
            <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center border border-gold/30 mb-6 text-gold text-xl">
              <i className="fa-solid fa-star-and-crescent"></i>
            </div>
            <h3 className="text-xl font-semibold mb-3 font-serif text-white group-hover:text-gold transition-colors">The 12 Houses</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Dividing the sky into 12 sectors, the astrological houses represent specific life areas, from career and relationships to personal growth and spirituality.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

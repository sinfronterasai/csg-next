export default function Newsletter() {
  return (
    <section className="py-24 relative z-10 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 lg:px-16 relative">
        <div className="glass-panel p-8 md:p-16 rounded-[40px] border border-gold/30 glow-border text-center relative max-w-4xl mx-auto">
          <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 w-20 h-20 bg-cosmic-950 border border-gold rounded-full flex items-center justify-center">
            <i className="fa-regular fa-bell text-gold text-2xl animate-bounce"></i>
          </div>

          <span className="text-xs uppercase tracking-[0.4em] text-gold block mb-3 mt-4">STAY IN SYNC WITH THE UNIVERSE</span>
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-6">Cosmic Daily Alignment Dispatch</h2>
          <p className="text-gray-300 text-sm max-w-lg mx-auto mb-8 font-light">
            Receive direct planet transits, retrograde survival manuals, and customized astrology readings matching your exact birth metrics straight to your inbox.
          </p>

          <form onSubmit={(e) => { e.preventDefault(); alert('Subscribed!'); }} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input type="email" required placeholder="Enter cosmic coordinates (email)" className="bg-white/5 border border-white/15 rounded-full px-6 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-gold flex-grow text-sm" />
            <button type="submit" className="bg-gradient-to-r from-gold to-gold-400 text-cosmic-950 font-bold uppercase tracking-widest text-xs px-8 py-4 rounded-full transition-all duration-300 hover:shadow-[0_0_20px_rgba(223,183,108,0.4)]">
              Subscribe
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

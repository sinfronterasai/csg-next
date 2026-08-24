export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="py-12 border-t border-white/5 relative z-10 bg-cosmic-950 text-gray-500 text-xs">
      <div className="max-w-7xl mx-auto px-6 lg:px-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <div className="space-y-4">
            <a href="#" className="flex items-center space-x-3">
              <div className="relative w-8 h-8 flex items-center justify-center">
                <span className="absolute inset-0 border border-gold rounded-full rotate-45"></span>
                <i className="fa-solid fa-moon text-gold text-xs absolute"></i>
              </div>
              <span className="font-serif text-lg tracking-widest text-white">COSMIC SPIRIT GUIDE</span>
            </a>
            <p className="text-[11px] text-gray-400 font-light leading-relaxed">
              Decoding cosmic geometry and mapping celestial cycles since retrogrades began. Connect to the sky above.
            </p>
          </div>
          <div>
            <h4 className="font-serif text-white tracking-widest uppercase mb-4">Navigations</h4>
            <ul className="space-y-2">
              <li><a href="#about" className="hover:text-white transition-colors">Cosmos Mechanics</a></li>
              <li><a href="#zodiac-explorer" className="hover:text-white transition-colors">The 12 Signs</a></li>
              <li><a href="/constellations" className="hover:text-white transition-colors">Star Map Explorer</a></li>
              <li><a href="/birth-chart" className="hover:text-white transition-colors">Transit Calculator</a></li>
              <li><a href="/moon-calculator" className="hover:text-white transition-colors">Moon Sign Calculator</a></li>
              <li><a href="/tarot" className="hover:text-white transition-colors">Tarot Reading</a></li>
              <li><a href="/reports" className="hover:text-white transition-colors">Reports</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-serif text-white tracking-widest uppercase mb-4">Legal Alignments</h4>
            <ul className="space-y-2">
              <li><a href="#" className="hover:text-white transition-colors">Privacy Paradigm</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Cosmic Disclaimer</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Terms of Divinity</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Contact Astrals</a></li>
            </ul>
          </div>
          <div className="space-y-4">
            <h4 className="font-serif text-white tracking-widest uppercase mb-2">Social Constellations</h4>
            <div className="flex space-x-3">
              <a href="#" className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:border-gold hover:text-gold transition-all"><i className="fa-brands fa-instagram"></i></a>
              <a href="#" className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:border-gold hover:text-gold transition-all"><i className="fa-brands fa-tiktok"></i></a>
              <a href="#" className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:border-gold hover:text-gold transition-all"><i className="fa-brands fa-youtube"></i></a>
              <a href="#" className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:border-gold hover:text-gold transition-all"><i className="fa-brands fa-pinterest"></i></a>
            </div>
          </div>
        </div>

        <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-[11px]">
          <span>&copy; {year} Cosmic Spirit Guide Designed for the celestial seeker.</span>
          <span className="flex items-center gap-1.5"><i className="fa-solid fa-heart text-gold"></i> Crafted in astronomical harmony.</span>
        </div>
      </div>
    </footer>
  );
}

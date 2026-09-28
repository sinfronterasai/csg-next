import { getProduct } from '@/lib/productCatalog';

const services = [
  {
    product: getProduct('transit'),
    icon: 'fa-clock-rotate-left',
    description: 'Map planetary movements relative to your life nodes over the next 12 months.',
    action: 'Request',
    href: undefined,
  },
  {
    product: getProduct('loveblueprint'),
    icon: 'fa-heart-circle-bolt',
    description: 'Explore your Venus, Mars and Moon signature with the real love aspects colouring your chart.',
    action: 'Request',
    href: undefined,
  },
  {
    product: getProduct('vocation'),
    icon: 'fa-briefcase',
    description: 'Decode Midheaven aspects and 2nd/10th House dynamics for professional alignment.',
    action: 'Request',
    href: undefined,
  },
  {
    product: getProduct('celtic-cross-tarot'),
    icon: 'fa-wand-magic-sparkles',
    description: 'A one-time ten-card deep dive into the forces shaping your question.',
    action: 'Explore',
    href: '/tarot/pricing',
  },
] as const;

export default function Services() {
  return (
    <section id="services" className="py-24 relative z-10 bg-cosmic-900/40 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-6 lg:px-16">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <span className="text-xs uppercase tracking-[0.4em] text-gold block mb-3">Professional Wisdom</span>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white">Personalized Astrological Services</h2>
          <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-gold to-transparent mx-auto mt-6"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map(({ product, icon, description, action, href }) => (
            <div key={product.id} className="glass-panel p-6 rounded-3xl border border-white/5 hover:border-gold/30 transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center text-gold text-lg mb-6"><i className={`fa-solid ${icon}`}></i></div>
                <h3 className="text-xl font-serif text-white mb-2 group-hover:text-gold transition-colors">{product.displayName}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
              </div>
              <div className="pt-6 border-t border-white/5 flex justify-between items-center mt-6">
                <span className="font-serif text-gold">{product.formattedPrice}</span>
                <a href={href ?? product.reportRoute} className="text-xs uppercase tracking-wider text-white hover:text-gold font-semibold flex items-center gap-1.5">{action} <i className="fa-solid fa-arrow-right text-[10px]"></i></a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

import React, { useState } from 'react';
import { BRANDS_DATA, Brand } from '../data/brands';
import { Sparkles, ArrowUpRight } from 'lucide-react';

interface BrandShowcaseProps {
  onSelectBrand?: (brand: Brand) => void;
}

export const BrandShowcase: React.FC<BrandShowcaseProps> = () => {
  const [isPaused, setIsPaused] = useState(false);
  const [activeBrandId, setActiveBrandId] = useState<string | null>(null);

  // Divide 8 real brands into two distinct 4-item arrays for balanced dual-track marquee
  const row1Brands = BRANDS_DATA.slice(0, 4);
  const row2Brands = BRANDS_DATA.slice(4, 8);

  // Quadruple arrays to ensure an unbroken seamless infinite loop
  const track1Brands = [...row1Brands, ...row1Brands, ...row1Brands, ...row1Brands];
  const track2Brands = [...row2Brands, ...row2Brands, ...row2Brands, ...row2Brands];

  return (
    <div className="section-block brand-showcase-section">
      {/* Section Header Box — matching FirstFrame aesthetic */}
      <div className="section-header-box brand-header-box">
        <div className="section-header-inner" style={{ justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span className="section-number">1.</span>
            <span className="section-title">Collaborated Brands</span>
          </div>

          <div className="brand-header-badge">
            <span className="live-dot"></span>
            <span className="brand-header-badge__text">Verified Brand Portfolio</span>
          </div>
        </div>
        <p className="section-description">
          Our creator roster has collaborated on viral UGC campaigns with top beauty, wellness, lifestyle, and tech brands including Mamaearth, Dot & Key, Plum Goodness, Oziva, Aqualogica, boAt, The Derma Co, and Sugar Cosmetics. Hover to inspect brand partnerships.
        </p>
      </div>

      {/* Horizontal Scrolling Tracks Container */}
      <div 
        className={`brand-showcase-container ${isPaused ? 'is-paused' : ''}`}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Left & Right gradient fade masks matching #EDEEF0 */}
        <div className="brand-fade-mask brand-fade-mask--left" aria-hidden="true" />
        <div className="brand-fade-mask brand-fade-mask--right" aria-hidden="true" />

        {/* Row 1 — Moving Left */}
        <div className="brand-marquee-track brand-marquee-track--left">
          <div className="brand-marquee-inner">
            {track1Brands.map((brand, idx) => (
              <BrandCard 
                key={`track1-${brand.id}-${idx}`} 
                brand={brand} 
                isActive={activeBrandId === brand.id}
                onHover={() => setActiveBrandId(brand.id)}
                onLeave={() => setActiveBrandId(null)}
              />
            ))}
          </div>
        </div>

        {/* Row 2 — Moving Right */}
        <div className="brand-marquee-track brand-marquee-track--right">
          <div className="brand-marquee-inner brand-marquee-inner--reverse">
            {track2Brands.map((brand, idx) => (
              <BrandCard 
                key={`track2-${brand.id}-${idx}`} 
                brand={brand} 
                isActive={activeBrandId === brand.id}
                onHover={() => setActiveBrandId(brand.id)}
                onLeave={() => setActiveBrandId(null)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Trust Stats Ribbon below brand track */}
      <div className="brand-stats-strip">
        <div className="brand-stat-unit">
          <span className="brand-stat-unit__val">8+</span>
          <span className="brand-stat-unit__lbl">Flagship Brands</span>
        </div>
        <div className="brand-stat-divider" />
        <div className="brand-stat-unit">
          <span className="brand-stat-unit__val">35M+</span>
          <span className="brand-stat-unit__lbl">Total UGC Views</span>
        </div>
        <div className="brand-stat-divider" />
        <div className="brand-stat-unit">
          <span className="brand-stat-unit__val">100%</span>
          <span className="brand-stat-unit__lbl">Conversion-Driven</span>
        </div>
        <div className="brand-stat-divider" />
        <div className="brand-stat-unit">
          <span className="brand-stat-unit__val">4.9/5</span>
          <span className="brand-stat-unit__lbl">Creator Performance</span>
        </div>
      </div>
    </div>
  );
};

interface BrandCardProps {
  brand: Brand;
  isActive: boolean;
  onHover: () => void;
  onLeave: () => void;
}

const BrandCard: React.FC<BrandCardProps> = ({ brand, isActive, onHover, onLeave }) => {
  // Get stylized abbreviation or 2-letter monogram
  const monogram = brand.name === 'The Derma Co' 
    ? 'DC' 
    : brand.name === 'Dot & Key' 
    ? 'DK' 
    : brand.name === 'Sugar Cosmetics'
    ? 'SC'
    : brand.name === 'Plum Goodness'
    ? 'PG'
    : brand.name.slice(0, 2).toUpperCase();

  return (
    <div 
      className={`brand-card ${isActive ? 'brand-card--active' : ''}`}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <div className="brand-card__header">
        <div className="brand-card__icon-box" style={{ background: brand.accentBg || '#F3F4F6' }}>
          <span className="brand-card__monogram" style={{ color: brand.accentColor || '#111111' }}>
            {monogram}
          </span>
        </div>

        <div className="brand-card__meta">
          <span className="brand-card__tag">{brand.category}</span>
          <span className="brand-card__tier-pill">
            <Sparkles size={9} />
            Collab
          </span>
        </div>
      </div>

      <div className="brand-card__body">
        <h4 className="brand-card__title">
          {brand.name}
          <ArrowUpRight size={13} className="brand-card__arrow" />
        </h4>
        <p className="brand-card__tagline">{brand.tagline}</p>
      </div>

      <div className="brand-card__footer">
        <div className="brand-card__metric-badge">
          <span className="brand-card__metric-label">UGC Metric</span>
          <span className="brand-card__metric-value">{brand.metric}</span>
        </div>
        <span className="brand-card__year">{brand.year || '2026'}</span>
      </div>
    </div>
  );
};

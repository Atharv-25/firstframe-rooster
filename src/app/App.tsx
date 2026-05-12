import { creators } from './data/creators';
import { CreatorCard } from './components/CreatorCard';

export default function App() {
  return (
    <div className="app-canvas">
      {/* Header */}
      <div className="page-header">
        <div className="page-brand">
          <span className="page-brand__first">First Frame</span>
          <span className="page-brand__creators">Creators</span>
        </div>
      </div>

      {/* Section Block */}
      <div className="section-block">
        <div className="section-header-box">
          <div className="section-header-inner">
            <span className="section-number">1.</span>
            <span className="section-title">Creator Reels</span>
          </div>
          <p className="section-description">
            Starting Point: These are UGC demo reels from our 2026 creator roster — hover any video to preview.
          </p>
        </div>

        <div className="video-row">
          {creators.map((creator) => (
            <CreatorCard key={creator.id} creator={creator} />
          ))}
        </div>
      </div>
    </div>
  );
}

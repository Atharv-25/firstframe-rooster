import { useRef, useState } from 'react';
import { Creator } from '../data/creators';

interface CreatorCardProps {
  creator: Creator;
}

const GITHUB_VIDEO_BASE = 'https://media.githubusercontent.com/media/vanshsurti213-arch/firstframe-rooster/main/public/videos';

export function CreatorCard({ creator }: CreatorCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  const handleMouseEnter = () => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
      setPlaying(true);
    }
  };

  const handleMouseLeave = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setPlaying(false);
      setMuted(true);
      videoRef.current.muted = true;
    }
  };

  const handleClick = () => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setPlaying(false);
      setMuted(true);
      videoRef.current.muted = true;
    } else {
      videoRef.current.play().catch(() => {});
      setPlaying(true);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      const next = !muted;
      videoRef.current.muted = next;
      setMuted(next);
    }
  };

  return (
    <div className="creator-card">
      <div
        className="creator-card__video-wrap"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        {creator.videoFile ? (
          <>
            <video ref={videoRef} preload="metadata" loop playsInline muted>
              <source
                src={`${GITHUB_VIDEO_BASE}/${creator.videoFile}`}
                type={creator.videoFile.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4'}
              />
              <source src={`${GITHUB_VIDEO_BASE}/${creator.videoFile}`} type="video/mp4" />
              <source src={`/videos/${creator.videoFile}`} type="video/mp4" />
            </video>

            {/* Play overlay */}
            <div className={`creator-card__play-overlay${playing ? ' hidden' : ''}`}>
              <div className="creator-card__play-btn">
                <svg width="14" height="16" viewBox="0 0 14 16" fill="none">
                  <path d="M1 1L13 8L1 15V1Z" fill="#111111"/>
                </svg>
              </div>
            </div>

            {/* Mute toggle — only visible when playing */}
            {playing && (
              <button className="creator-card__mute-btn" onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}>
                {muted ? (
                  /* muted icon */
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
                  </svg>
                ) : (
                  /* sound icon */
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                  </svg>
                )}
              </button>
            )}
          </>
        ) : (
          <div className="creator-card__placeholder">
            <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
              <path d="M1 1L19 12L1 23V1Z" fill="#444" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
      </div>

      <div className="creator-card__info">
        <div className="creator-card__stats">
          <div className="stat-item">
            <span className="stat-label">Followers</span>
            <span className="stat-value">{creator.followers}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Avg Views</span>
            <span className="stat-value">{creator.avgViews}</span>
          </div>
        </div>
        {creator.niches.length > 0 && (
          <div className="creator-card__niches">
            {creator.niches.map((n) => (
              <span key={n} className="niche-tag">{n}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

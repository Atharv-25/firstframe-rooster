import { useRef, useState } from 'react';
import { Creator } from '../data/creators';
import { Trash2, Plus, Check } from 'lucide-react';
import { motion } from 'motion/react';

interface CreatorCardProps {
  creator: Creator;
  isAdminView: boolean;
  onUpdateName: (id: number, newName: string) => void;
  onDelete: (id: number) => void;
  isAddedToCampaign: boolean;
  onToggleCampaign: (creator: Creator) => void;
  onClickVideo: (creator: Creator) => void;
}

const GITHUB_VIDEO_BASE = 'https://media.githubusercontent.com/media/Atharv-25/firstframe-rooster/main/public/videos';

export function CreatorCard({
  creator,
  isAdminView,
  onUpdateName,
  onDelete,
  isAddedToCampaign,
  onToggleCampaign,
  onClickVideo,
}: CreatorCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [videoLoaded, setVideoLoaded] = useState(false);

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
    onClickVideo(creator);
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      const next = !muted;
      videoRef.current.muted = next;
      setMuted(next);
    }
  };

  // Get first name for public view
  const firstName = creator.name ? creator.name.split(' ')[0] : 'Creator';

  return (
    <div className={`creator-card ${isAddedToCampaign ? 'creator-card--selected' : ''}`}>
      <motion.div
        layoutId={`creator-video-wrap-${creator.id}`}
        className="creator-card__video-wrap"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        {creator.videoFile ? (
          <>
            {/* Loading spinner — shown until first frame is ready */}
            {!videoLoaded && (
              <div className="creator-card__loader">
                <div className="creator-card__spinner"></div>
              </div>
            )}

            <video
              ref={videoRef}
              preload="metadata"
              loop
              playsInline
              muted
              style={{ opacity: videoLoaded ? 1 : 0, transition: 'opacity 0.3s ease' }}
              onLoadedData={() => setVideoLoaded(true)}
            >
              <source
                src={`${GITHUB_VIDEO_BASE}/${creator.videoFile}`}
                type={creator.videoFile.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4'}
              />
              <source src={`${GITHUB_VIDEO_BASE}/${creator.videoFile}`} type="video/mp4" />
              <source src={`/videos/${creator.videoFile}`} type="video/mp4" />
            </video>

            {/* Play overlay */}
            {videoLoaded && (
              <div className={`creator-card__play-overlay${playing ? ' hidden' : ''}`}>
                <div className="creator-card__play-btn">
                  <svg width="14" height="16" viewBox="0 0 14 16" fill="none">
                    <path d="M1 1L13 8L1 15V1Z" fill="#111111"/>
                  </svg>
                </div>
              </div>
            )}

            {/* Mute toggle — only visible when playing */}
            {playing && (
              <button className="creator-card__mute-btn" onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}>
                {muted ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
                  </svg>
                ) : (
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

        {/* Delete button badge shown in Admin View */}
        {isAdminView && (
          <button
            className="creator-card__delete-badge"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(creator.id);
            }}
            title="Delete Creator"
          >
            <Trash2 size={14} />
          </button>
        )}
      </motion.div>

      <div className="creator-card__info">
        {/* Creator Name Section */}
        <div className="creator-card__name-container">
          {isAdminView ? (
            <>
              <input
                type="text"
                className="creator-card__name-input"
                value={creator.name}
                onChange={(e) => onUpdateName(creator.id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Creator Name"
              />
              <span className="creator-card__handle">
                {creator.handle}
              </span>
            </>
          ) : (
            <span className="creator-card__name" title={firstName}>
              {firstName}
            </span>
          )}
        </div>

        <div className="creator-card__stats">
          <div className="stat-item">
            <span className="stat-label">Followers</span>
            <span className="stat-value">{creator.followers || 'N/A'}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Avg Views</span>
            <span className="stat-value">{creator.avgViews || 'N/A'}</span>
          </div>
        </div>

        {isAdminView && creator.niches.length > 0 && (
          <div className="creator-card__niches">
            {creator.niches.slice(0, 3).map((n) => (
              <span key={n} className="niche-tag">{n}</span>
            ))}
            {creator.niches.length > 3 && (
              <span className="niche-tag niche-tag--more">+{creator.niches.length - 3}</span>
            )}
          </div>
        )}

        {/* Add to Campaign Button (Only shown in Public View) */}
        {!isAdminView && (
          <button
            type="button"
            className={`creator-card__campaign-btn ${isAddedToCampaign ? 'creator-card__campaign-btn--added' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleCampaign(creator);
            }}
          >
            {isAddedToCampaign ? (
              <>
                <Check size={13} strokeWidth={3} />
                <span>Added</span>
              </>
            ) : (
              <>
                <Plus size={13} strokeWidth={3} />
                <span>Add to Campaign</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

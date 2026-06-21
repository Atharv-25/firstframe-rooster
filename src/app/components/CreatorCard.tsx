import { useState, useRef, useEffect, memo } from 'react';
import { Creator, Reel } from '../data/creators';
import { Plus, Check, X, Play, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const GITHUB_VIDEO_BASE = 'https://media.githubusercontent.com/media/Atharv-25/firstframe-rooster/main/public/videos';

// ── Helper functions ──────────────────────────────────────────────

function isInstagramUrl(url: string) {
  return (url.includes('instagram.com') || url.includes('instagr.am')) && !url.includes('cdninstagram.com');
}

function isYouTubeUrl(url: string) {
  return url.includes('youtube.com') || url.includes('youtu.be');
}

function getYouTubeEmbedUrl(url: string) {
  const match = url.match(/(?:youtu\.be\/|v=|shorts\/)([a-zA-Z0-9_-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}?autoplay=1&mute=1` : url;
}

function getInstagramEmbedUrl(url: string) {
  const match = url.match(/\/(p|reel|reels)\/([A-Za-z0-9_-]+)/);
  return match ? `https://www.instagram.com/${match[1]}/${match[2]}/embed/captioned/` : url;
}

/** Resolve video src for local files vs remote URLs */
function resolveVideoSrc(videoUrl: string): string {
  if (!videoUrl) return '';
  if (videoUrl.startsWith('http')) return videoUrl;
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return isLocalhost
    ? `/videos/${videoUrl}`
    : `${GITHUB_VIDEO_BASE}/${videoUrl}`;
}

/** Backward compat: convert old single-video creators to reels[] shape at runtime */
function normalizeCreator(c: Creator): Creator {
  if (c.videoUrl && (!c.reels || c.reels.length === 0)) {
    return {
      ...c,
      reels: [{
        id: `${c.id}_reel0`,
        label: 'Demo Reel',
        videoUrl: c.videoUrl,
        views: c.avgViews,
      }],
    };
  }
  return c;
}

// ── ReelPlayer ────────────────────────────────────────────────────

interface ReelPlayerProps {
  reel: Reel;
  autoPlay?: boolean;
  previewMode?: boolean;
}

function ReelPlayer({ reel, autoPlay = false, previewMode = false }: ReelPlayerProps) {
  const [fallbackSrc, setFallbackSrc] = useState('');
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.defaultMuted = true;
      if (previewMode) {
        video.muted = isMuted;
      }
      if (autoPlay) {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.log('Autoplay prevented:', err);
          });
        }
      }
    }
  }, [autoPlay, isMuted, previewMode, reel.videoUrl]);

  if (isInstagramUrl(reel.videoUrl)) {
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        {previewMode && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, cursor: 'pointer' }} />
        )}
        <iframe
          src={getInstagramEmbedUrl(reel.videoUrl)}
          title={reel.label}
          frameBorder="0"
          scrolling="no"
          allowTransparency
          allow="encrypted-media"
          style={{ width: '100%', height: '100%', border: 'none', background: '#000', pointerEvents: previewMode ? 'none' : 'auto' }}
        />
      </div>
    );
  }

  if (isYouTubeUrl(reel.videoUrl)) {
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        {previewMode && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, cursor: 'pointer' }} />
        )}
        <iframe
          src={getYouTubeEmbedUrl(reel.videoUrl)}
          title={reel.label}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ width: '100%', height: '100%', border: 'none', background: '#000', pointerEvents: previewMode ? 'none' : 'auto' }}
        />
      </div>
    );
  }

  const primarySrc = resolveVideoSrc(reel.videoUrl);
  const src = fallbackSrc || primarySrc;

  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  return (
    <div 
      style={{ width: '100%', height: '100%', position: 'relative', cursor: 'pointer' }}
      onClick={togglePlay}
    >
      <style>{`
        video::-webkit-media-controls-start-playback-button {
          display: none !important;
          -webkit-appearance: none;
        }
      `}</style>
      <video
        ref={videoRef}
        key={src}
        src={src}
        controls={false}
        defaultMuted={previewMode ? true : undefined}
        muted={previewMode ? isMuted : undefined}
        loop
        playsInline
        preload="auto"
        poster={reel.thumbnailUrl || (reel as any).coverUrl}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000', pointerEvents: 'none' }}
        onError={() => {
          if (!fallbackSrc && !reel.videoUrl.startsWith('http')) {
            setFallbackSrc(`${GITHUB_VIDEO_BASE}/${reel.videoUrl}`);
          }
        }}
      />
      {!isPlaying && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(0,0,0,0.5)',
          borderRadius: '50%',
          width: '48px',
          height: '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          pointerEvents: 'none',
          zIndex: 10
        }}>
          <Play size={24} fill="white" style={{ marginLeft: '4px' }} />
        </div>
      )}
      {previewMode && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsMuted(!isMuted);
          }}
          style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            background: 'rgba(0,0,0,0.6)',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            cursor: 'pointer',
            zIndex: 20
          }}
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      )}
    </div>
  );
}

// ── ReelThumb ─────────────────────────────────────────────────────

interface ReelThumbProps {
  reel: Reel;
  onClick: () => void;
}

function ReelThumb({ reel, onClick }: ReelThumbProps) {
  return (
    <button
      type="button"
      className="reel-thumb"
      onClick={onClick}
    >
      <div className="reel-thumb__container" style={{ position: 'relative', overflow: 'hidden', borderRadius: '8px' }}>
        {reel.videoUrl ? (
          <div className="reel-thumb__preview" style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
            <ReelPlayer reel={reel} autoPlay={true} previewMode={true} />
            <div style={{ position: 'absolute', inset: 0, zIndex: 10 }} />
          </div>
        ) : reel.thumbnailUrl ? (
          <img
            src={reel.thumbnailUrl}
            alt={reel.label}
            className="reel-thumb__img"
          />
        ) : (
          <div className="reel-thumb__placeholder">
            <svg width="24" height="28" viewBox="0 0 24 28" fill="none">
              <path d="M2 2L22 14L2 26V2Z" fill="white" fillOpacity="0.7" />
            </svg>
          </div>
        )}
        {/* Views badge */}
        <div className="reel-thumb__views-badge">
          <Play size={10} fill="white" stroke="white" />
          <span>{reel.views} views</span>
        </div>
        {/* Hover overlay */}
        <div className="reel-thumb__hover">
          <div className="reel-thumb__play-circle">
            <svg width="16" height="18" viewBox="0 0 16 18" fill="none">
              <path d="M1 1L15 9L1 17V1Z" fill="white" />
            </svg>
          </div>
        </div>
      </div>
      <div className="reel-thumb__info">
        <span className="reel-thumb__label">{reel.label}</span>
        {reel.likes && (
          <span className="reel-thumb__likes">{reel.likes} likes</span>
        )}
      </div>
    </button>
  );
}

// ── ExpandedView ──────────────────────────────────────────────────

interface ExpandedViewProps {
  creator: Creator;
  inCampaign: boolean;
  onToggleCampaign: () => void;
  onClose: () => void;
  isAdminView?: boolean;
  followersStr: string;
  viewsStr: string;
  setFollowersStr: (val: string) => void;
  setViewsStr: (val: string) => void;
}

function ExpandedView({ creator, inCampaign, onToggleCampaign, onClose, isAdminView, followersStr, viewsStr, setFollowersStr, setViewsStr }: ExpandedViewProps) {
  const [activeReel, setActiveReel] = useState<Reel | null>(null);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <>
      {/* Main expanded panel */}
      <motion.div
        className="expanded-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={handleBackdropClick}
      >
        <motion.div
          className="expanded-panel"
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Sticky header */}
          <div className="expanded-header">
            <div className="expanded-header__info">
              <h2 className="expanded-header__name">{creator.name}</h2>
              {creator.handle && (
                <a
                  href={creator.profileUrl || `https://instagram.com/${creator.handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="expanded-header__handle"
                  onClick={(e) => e.stopPropagation()}
                >
                  @{creator.handle}
                </a>
              )}
            </div>
            <button
              type="button"
              className="expanded-header__close"
              onClick={onClose}
            >
              <X size={20} />
            </button>
          </div>

          {/* Stats bar */}
          <div className="expanded-stats">
            <div className="expanded-stats__item">
              <span className="expanded-stats__label">Followers</span>
              <span className="expanded-stats__value">{followersStr}</span>
            </div>
            {creator.engagementRate && (
              <>
                <span className="expanded-stats__dot">·</span>
                <div className="expanded-stats__item">
                  <span className="expanded-stats__label">Engagement</span>
                  <span className="expanded-stats__value">{creator.engagementRate}</span>
                </div>
              </>
            )}
            <div className="expanded-stats__niches">
              {creator.niches.slice(0, 4).map((n) => (
                <span key={n} className="expanded-niche-pill">{n}</span>
              ))}
              {creator.niches.length > 4 && (
                <span className="expanded-niche-pill expanded-niche-pill--more">
                  +{creator.niches.length - 4}
                </span>
              )}
            </div>
          </div>

          {/* Single Video Section */}
          {creator.reels && creator.reels.length > 0 && (
            <div className="expanded-reels" style={{ marginTop: '16px' }}>
              <div style={{ width: '100%', aspectRatio: '9/16', maxHeight: '500px', borderRadius: '12px', overflow: 'hidden', margin: '0 auto', background: '#000' }}>
                <ReelPlayer reel={creator.reels[0]} autoPlay={true} />
              </div>
            </div>
          )}

          {/* Sticky footer */}
          {!isAdminView && (
            <div className="expanded-footer">
              <button
                type="button"
                className={`expanded-footer__btn ${inCampaign ? 'expanded-footer__btn--added' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCampaign();
                }}
              >
                {inCampaign ? (
                  <>
                    <Check size={16} strokeWidth={3} />
                    <span>Added to Campaign</span>
                  </>
                ) : (
                  <>
                    <Plus size={16} strokeWidth={2} />
                    <span>Add to Campaign</span>
                  </>
                )}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </>
  );
}

// ── CreatorCard (compact card) ────────────────────────────────────

interface CreatorCardProps {
  creator: Creator;
  inCampaign: boolean;
  onToggleCampaign: (creator: Creator) => void;
  isAdminView?: boolean;
  onUpdateName?: (id: string, newName: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (creator: Creator) => void;
}

export const CreatorCard = memo(function CreatorCard({
  creator: rawCreator,
  inCampaign,
  onToggleCampaign,
  isAdminView = false,
  onUpdateName,
  onDelete,
  onEdit
}: CreatorCardProps) {
  const creator = normalizeCreator(rawCreator);
  const firstReel = creator.reels?.[0];

  const [followersStr, setFollowersStr] = useState(() => localStorage.getItem(`creator_followers_${creator.id}`) || creator.followers);
  const [viewsStr, setViewsStr] = useState(() => localStorage.getItem(`creator_views_${creator.id}`) || creator.avgViews);

  return (
      <div
        className={`cc ${inCampaign ? 'cc--selected' : ''}`}
      >
        {/* Thumbnail area */}
        <div className="cc__thumb">
          {firstReel?.videoUrl ? (
            <div className="cc__preview-wrapper" style={{ width: '100%', height: '100%' }}>
              <ReelPlayer reel={firstReel} autoPlay={true} previewMode={true} />
            </div>
          ) : firstReel?.thumbnailUrl ? (
            <img
              src={firstReel.thumbnailUrl}
              alt={creator.name}
              className="cc__thumb-img"
            />
          ) : (
            <div className="cc__thumb-placeholder">
              <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
                <path d="M1 1L19 12L1 23V1Z" fill="white" fillOpacity="0.5" />
              </svg>
            </div>
          )}

          {/* Admin: Edit badge (Top Right) */}
          {isAdminView && onEdit && (
            <button
              className="creator-card__edit-badge"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(creator);
              }}
              title="Edit Creator"
              style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(255, 255, 255, 0.9)', color: '#111', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 10 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
            </button>
          )}

          {/* Admin: Delete badge (Top Left) */}
          {isAdminView && onDelete && (
            <button
              className="creator-card__delete-badge"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(creator.id);
              }}
              title="Delete Creator"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Info section */}
        <div className="cc__info">
          <div className="cc__name-row">
            <span className="cc__name">{creator.name}</span>
            {isAdminView && creator.handle && <span className="cc__handle">@{creator.handle}</span>}
          </div>
          <div className="cc__stats-line">
            <span>{followersStr} followers</span>
          </div>
          {creator.niches && creator.niches.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
              {creator.niches.slice(0, 3).map((niche) => (
                <span key={niche} style={{ background: '#f5f5f5', color: '#555', fontSize: '10px', padding: '4px 8px', borderRadius: '12px', fontWeight: 600, letterSpacing: '0.2px' }}>
                  {niche}
                </span>
              ))}
              {creator.niches.length > 3 && (
                <span style={{ background: '#f5f5f5', color: '#555', fontSize: '10px', padding: '4px 8px', borderRadius: '12px', fontWeight: 600, letterSpacing: '0.2px' }}>
                  +{creator.niches.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        {/* CTA button */}
        {!isAdminView && (
          <div className="cc__cta" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={`cc__campaign-btn ${inCampaign ? 'cc__campaign-btn--added' : ''}`}
              onClick={() => onToggleCampaign(creator)}
            >
              {inCampaign ? (
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
          </div>
        )}
      </div>
  );
}, (prev, next) => {
  return prev.creator.id === next.creator.id && 
         prev.inCampaign === next.inCampaign && 
         prev.isAdminView === next.isAdminView &&
         prev.onUpdateName === next.onUpdateName &&
         prev.onDelete === next.onDelete &&
         prev.onEdit === next.onEdit;
});

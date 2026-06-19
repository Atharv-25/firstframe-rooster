import { useState, useEffect } from 'react';
import { creators as initialCreators, Creator } from './data/creators';
import { CreatorCard } from './components/CreatorCard';
import { Settings, Plus, Check, AlertCircle, RefreshCw, X, CheckSquare, Shield, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const GITHUB_VIDEO_BASE = 'https://media.githubusercontent.com/media/Atharv-25/firstframe-rooster/main/public/videos';

export default function App() {
  const [creatorsList, setCreatorsList] = useState<Creator[]>(initialCreators);
  const [campaignList, setCampaignList] = useState<Creator[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Lightbox player state
  const [activeVideoCreator, setActiveVideoCreator] = useState<Creator | null>(null);
  const [lightboxMuted, setLightboxMuted] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState('');

  // New Creator Form State
  const [newName, setNewName] = useState('');
  const [newHandle, setNewHandle] = useState('');
  const [newFollowers, setNewFollowers] = useState('');
  const [newAvgViews, setNewAvgViews] = useState('');
  const [newNiches, setNewNiches] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [uploadingVideo, setUploadingVideo] = useState(false);

  // Simple Router Detection based on window.location.pathname
  const [isAdminView, setIsAdminView] = useState(() => window.location.pathname === '/kalva');

  // Listen to popstate event to handle forward/backward path changes
  useEffect(() => {
    const handleLocationChange = () => {
      setIsAdminView(window.location.pathname === '/kalva');
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Update lightboxSrc when activeVideoCreator changes
  useEffect(() => {
    if (activeVideoCreator) {
      const initialSrc = activeVideoCreator.videoFile.startsWith('http')
        ? activeVideoCreator.videoFile
        : (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? `/videos/${activeVideoCreator.videoFile}`
            : `${GITHUB_VIDEO_BASE}/${activeVideoCreator.videoFile}`);
      setLightboxSrc(initialSrc);
    } else {
      setLightboxSrc('');
    }
  }, [activeVideoCreator]);

  // Load campaign list from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('campaignList');
    if (saved) {
      try {
        setCampaignList(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Show status toast
  const triggerStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const handleUpdateName = (id: number, newName: string) => {
    const updated = creatorsList.map((c) => (c.id === id ? { ...c, name: newName } : c));
    setCreatorsList(updated);
    saveCreatorsToBackend(updated);
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this creator from the roster?')) {
      const updated = creatorsList.filter((c) => c.id !== id);
      setCreatorsList(updated);
      
      // Also remove from campaign list if present
      if (campaignList.some(c => c.id === id)) {
        const updatedCampaign = campaignList.filter(c => c.id !== id);
        setCampaignList(updatedCampaign);
        localStorage.setItem('campaignList', JSON.stringify(updatedCampaign));
      }
      
      saveCreatorsToBackend(updated);
      triggerStatus('success', 'Creator successfully deleted.');
    }
  };

  const saveCreatorsToBackend = async (list: Creator[]) => {
    try {
      const res = await fetch('/api/save-creators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(list),
      });
      if (!res.ok) throw new Error('Failed to save to local file');
    } catch (e: any) {
      console.error(e);
      triggerStatus('error', `Failed to persist roster locally: ${e.message}`);
    }
  };

  const handleToggleCampaign = (creator: Creator) => {
    const exists = campaignList.some((c) => c.id === creator.id);
    let updated: Creator[];

    if (exists) {
      updated = campaignList.filter((c) => c.id !== creator.id);
      setCampaignList(updated);
      localStorage.setItem('campaignList', JSON.stringify(updated));
      triggerStatus('success', `Removed ${creator.name.split(' ')[0]} from Campaign shortlist.`);
    } else {
      updated = [...campaignList, creator];
      setCampaignList(updated);
      localStorage.setItem('campaignList', JSON.stringify(updated));
      triggerStatus('success', `Added ${creator.name.split(' ')[0]} to Campaign shortlist.`);
    }
  };

  const handleSubmitCampaign = async () => {
    if (campaignList.length === 0) return;
    setSubmittingCampaign(true);
    triggerStatus('success', 'Submitting shortlist to Google Sheets...');
    
    // Check if direct Google Sheets Web App URL is configured in environment variables
    const webAppUrl = import.meta.env.VITE_SHEETS_WEBAPP_URL || "https://script.google.com/macros/s/AKfycbw13qQVMpT3k0IY_LLDUcl4_PyK0tVopVbkbFGZcpwBEqMH_H5AdxCrkPJnYimWCBri-Q/exec";

    try {
      let success = false;
      let errorMsg = '';

      if (webAppUrl) {
        // Direct client-side submission with no-cors to prevent CORS/redirect errors.
        // Google Apps Script doPost runs successfully, but redirects the response.
        await fetch(webAppUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'text/plain',
          },
          body: JSON.stringify(campaignList),
        });
        success = true;
      } else {
        // Fallback to local dev server endpoint if no URL is provided
        const res = await fetch('/api/add-to-campaign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(campaignList),
        });
        const data = await res.json();
        success = data.success;
        errorMsg = data.error;
      }

      if (success) {
        triggerStatus('success', `✓ Successfully submitted ${campaignList.length} creators to Campaign Sheet!`);
        setCampaignList([]);
        localStorage.removeItem('campaignList');
      } else {
        throw new Error(errorMsg || 'Failed to append to Google Sheet');
      }
    } catch (e: any) {
      console.error(e);
      triggerStatus('error', `Submission failed: ${e.message}`);
    } finally {
      setSubmittingCampaign(false);
    }
  };

  const [submittingCampaign, setSubmittingCampaign] = useState(false);

  const handleAddCreator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newHandle) {
      triggerStatus('error', 'Name and Instagram Handle are required.');
      return;
    }

    setUploadingVideo(true);
    let uploadedFilename = '';

    if (videoUrl) {
      try {
        const res = await fetch('/api/download-reel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: videoUrl }),
        });
        const data = await res.json();
        if (data.success) {
          uploadedFilename = data.filename;
        } else {
          throw new Error(data.error);
        }
      } catch (err: any) {
        triggerStatus('error', `Reel download failed: ${err.message}`);
        setUploadingVideo(false);
        return;
      }
    } else if (videoFile) {
      try {
        const res = await fetch('/api/upload-video', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-Filename': videoFile.name,
          },
          body: videoFile,
        });
        const data = await res.json();
        if (data.success) {
          uploadedFilename = data.filename;
        } else {
          throw new Error(data.error);
        }
      } catch (err: any) {
        triggerStatus('error', `Video upload failed: ${err.message}`);
        setUploadingVideo(false);
        return;
      }
    }

    const newId = Math.max(...creatorsList.map((c) => c.id), 0) + 1;
    const cleanNiches = newNiches
      .split(',')
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    const newCreator: Creator = {
      id: newId,
      name: newName,
      handle: newHandle.startsWith('@') ? newHandle : `@${newHandle}`,
      followers: newFollowers || 'N/A',
      avgViews: newAvgViews || 'N/A',
      niches: cleanNiches,
      brandCollabs: 0,
      videoFile: uploadedFilename || undefined,
    };

    const updatedList = [newCreator, ...creatorsList];
    setCreatorsList(updatedList);
    await saveCreatorsToBackend(updatedList);

    // Reset Form
    setNewName('');
    setNewHandle('');
    setNewFollowers('');
    setNewAvgViews('');
    setNewNiches('');
    setVideoFile(null);
    setVideoUrl('');
    setShowAddModal(false);
    setUploadingVideo(false);
    triggerStatus('success', `Creator ${newName} added successfully!`);
  };

  const clearCampaign = () => {
    if (confirm('Are you sure you want to clear your local campaign shortlist?')) {
      setCampaignList([]);
      localStorage.removeItem('campaignList');
      triggerStatus('success', 'Shortlist cleared.');
    }
  };

  return (
    <div className="app-canvas">
      {/* Toast Alert */}
      {statusMessage && (
        <div className={`status-toast status-toast--${statusMessage.type}`}>
          {statusMessage.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div className="header-top-bar">
          <div className="page-brand">
            <span className="page-brand__first">FirstFrame</span>
            <span className="page-brand__creators">
              {isAdminView ? 'Creators (Admin)' : 'Creators'}
            </span>
          </div>
          
          {/* Action buttons (Only shown in Admin Route) */}
          {isAdminView && (
            <div className="header-actions">
              <div className="admin-badge">
                <Shield size={14} />
                <span>Admin Mode</span>
              </div>
              <button 
                className="action-btn action-btn--primary"
                onClick={() => setShowAddModal(true)}
              >
                <Plus size={15} />
                <span>Add Creator</span>
              </button>
            </div>
          )}
        </div>
        <p className="page-subtitle">
          {isAdminView ? 'Roster Management Console' : '2026 Premium UGC Creator Roster'}
        </p>
      </div>

      {/* Roster Block */}
      <div className="section-block">
        <div className="section-header-box">
          <div className="section-header-inner">
            <span className="section-number">1.</span>
            <span className="section-title">
              {isAdminView ? 'Manage UGC Roster' : 'UGC Demo Reels'}
            </span>
          </div>
          <p className="section-description">
            {isAdminView 
              ? 'Admin Controls: Update creator names inline (saved instantly) or delete creators. Click "Add Creator" above to upload new portfolios.'
              : 'Starting Point: These are UGC demo reels from our premium 2026 creator roster. Click any video to view it in full mobile display, shortlist candidates, and submit campaign.'}
          </p>
        </div>

        {/* Creator Grid */}
        <div className="video-row">
          {creatorsList.map((creator) => (
            <CreatorCard
              key={creator.id}
              creator={creator}
              isAdminView={isAdminView}
              onUpdateName={handleUpdateName}
              onDelete={handleDelete}
              isAddedToCampaign={campaignList.some((c) => c.id === creator.id)}
              onToggleCampaign={handleToggleCampaign}
              onClickVideo={(c) => {
                setActiveVideoCreator(c);
                setLightboxMuted(false);
              }}
            />
          ))}
        </div>
      </div>

      {/* Campaign Shortlist Floating Pill (Only visible in public brand view) */}
      {!isAdminView && (
        <AnimatePresence>
          {campaignList.length > 0 && (
            <motion.div
              className="campaign-pill"
              initial={{ opacity: 0, y: 50, scale: 0.9, x: '-50%' }}
              animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
              exit={{ opacity: 0, y: 50, scale: 0.9, x: '-50%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              style={{ x: '-50%' }}
            >
              <div className="campaign-pill__content">
                <div className="campaign-pill__badge">
                  <CheckSquare size={15} className="campaign-pill__icon" />
                  <span className="campaign-pill__label">Campaign Shortlist</span>
                  <motion.span
                    key={campaignList.length}
                    className="campaign-pill__count"
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                  >
                    {campaignList.length}
                  </motion.span>
                </div>
                <div className="campaign-pill__divider"></div>
                <button 
                  type="button" 
                  className="campaign-pill__submit-btn" 
                  onClick={handleSubmitCampaign}
                  disabled={submittingCampaign}
                >
                  {submittingCampaign ? 'Submitting...' : 'Submit Shortlist'}
                </button>
                <div className="campaign-pill__divider"></div>
                <button 
                  type="button" 
                  className="campaign-pill__clear-btn" 
                  onClick={clearCampaign}
                  disabled={submittingCampaign}
                >
                  Clear
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Mobile Video Lightbox Overlay */}
      <AnimatePresence>
        {activeVideoCreator && (
          <motion.div
            className="lightbox-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveVideoCreator(null)}
          >
            {/* Close button outside mobile mockup chassis */}
            <motion.button 
              className="lightbox-close-btn" 
              onClick={() => setActiveVideoCreator(null)}
              title="Close Player"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              <X size={26} />
            </motion.button>

            {/* Premium Smartphone device mockup with plain thin border */}
            <motion.div
              layoutId={`creator-video-wrap-${activeVideoCreator.id}`}
              className="phone-chassis"
              onClick={(e) => e.stopPropagation()}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            >
              {/* Simulated screen viewport */}
              <div className="phone-screen">
                {activeVideoCreator.videoFile ? (
                  activeVideoCreator.videoFile.includes('instagram.com') ? (
                    <iframe
                      src={activeVideoCreator.videoFile.split('?')[0].endsWith('/') 
                        ? `${activeVideoCreator.videoFile.split('?')[0]}embed/` 
                        : `${activeVideoCreator.videoFile.split('?')[0]}/embed/`}
                      title={`${activeVideoCreator.name} Instagram Reel`}
                      frameBorder="0"
                      scrolling="no"
                      allowTransparency
                      allow="encrypted-media"
                      style={{ width: '100%', height: '100%', border: 'none', background: '#000000' }}
                      className="phone-video"
                    />
                  ) : (
                    <video
                      key={activeVideoCreator.id}
                      src={lightboxSrc}
                      autoPlay
                      loop
                      playsInline
                      muted={lightboxMuted}
                      className="phone-video"
                      ref={(el) => {
                        if (el) {
                          el.play().catch(() => {});
                        }
                      }}
                      onError={() => {
                        // Fall back to GitHub LFS CDN if local file fails (e.g. if it is a 132-byte git LFS pointer)
                        if (lightboxSrc && !lightboxSrc.startsWith('http') && !lightboxSrc.startsWith('https://media.githubusercontent')) {
                          console.log('Local video failed, falling back to GitHub LFS CDN');
                          setLightboxSrc(`${GITHUB_VIDEO_BASE}/${activeVideoCreator.videoFile}`);
                        }
                      }}
                    />
                  )
                ) : (
                  <div className="phone-placeholder">
                    <span>Video file not found</span>
                  </div>
                )}

                {/* Reels Overlay: details of creator at bottom-left */}
                <motion.div 
                  className="reels-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: 0.2, duration: 0.25 }}
                >
                  <div className="reels-overlay__bottom">
                    <span className="reels-creator-name">
                      {isAdminView ? activeVideoCreator.name : activeVideoCreator.name.split(' ')[0]}
                    </span>
                    {!isAdminView && (
                      <span className="reels-tagline">Premium UGC Creator</span>
                    )}
                    {isAdminView && (
                      <span className="reels-creator-handle">
                        {activeVideoCreator.handle}
                      </span>
                    )}
                    <div className="reels-creator-stats">
                      <span>{activeVideoCreator.followers} followers</span>
                      <span className="bullet">•</span>
                      <span>{activeVideoCreator.avgViews} views</span>
                    </div>
                  </div>

                  {/* Reels Action Bar (Volume unmute controls on bottom right) */}
                  {!activeVideoCreator.videoFile.includes('instagram.com') && (
                    <div className="reels-overlay__right">
                      <button 
                        type="button"
                        className="reels-action-btn"
                        onClick={() => setLightboxMuted(!lightboxMuted)}
                        title={lightboxMuted ? "Unmute" : "Mute"}
                      >
                        {lightboxMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                      </button>
                    </div>
                  )}
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Creator Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => !uploadingVideo && setShowAddModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New Creator</h3>
              <button 
                className="modal-close" 
                onClick={() => !uploadingVideo && setShowAddModal(false)}
                disabled={uploadingVideo}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddCreator} className="modal-form">
              <div className="form-group">
                <label>Full Name *</label>
                <input 
                  type="text" 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)} 
                  placeholder="e.g. Siya Uppal" 
                  required 
                  disabled={uploadingVideo}
                />
              </div>
              <div className="form-group">
                <label>Instagram Handle *</label>
                <input 
                  type="text" 
                  value={newHandle} 
                  onChange={(e) => setNewHandle(e.target.value)} 
                  placeholder="e.g. @siyauppall" 
                  required 
                  disabled={uploadingVideo}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Followers Count</label>
                  <input 
                    type="text" 
                    value={newFollowers} 
                    onChange={(e) => setNewFollowers(e.target.value)} 
                    placeholder="e.g. 735 or 12.6K" 
                    disabled={uploadingVideo}
                  />
                </div>
                <div className="form-group">
                  <label>Avg Views</label>
                  <input 
                    type="text" 
                    value={newAvgViews} 
                    onChange={(e) => setNewAvgViews(e.target.value)} 
                    placeholder="e.g. 67K or 150K" 
                    disabled={uploadingVideo}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Niches (Comma-separated)</label>
                <input 
                  type="text" 
                  value={newNiches} 
                  onChange={(e) => setNewNiches(e.target.value)} 
                  placeholder="e.g. Fashion, Beauty, Lifestyle" 
                  disabled={uploadingVideo}
                />
              </div>
              <div className="form-group">
                <label>UGC Video File (Local Upload)</label>
                <div className="file-input-wrapper">
                  <input 
                    type="file" 
                    accept="video/mp4,video/quicktime" 
                    onChange={(e) => {
                      setVideoFile(e.target.files?.[0] || null);
                      if (e.target.files?.[0]) setVideoUrl('');
                    }}
                    id="creator-video"
                    disabled={uploadingVideo}
                  />
                  <label htmlFor="creator-video" className="file-label">
                    {videoFile ? videoFile.name : 'Choose Video File...'}
                  </label>
                </div>
              </div>
              <div className="form-group" style={{ marginTop: '12px' }}>
                <label>OR Direct Video URL (MP4/MOV Link)</label>
                <input 
                  type="url" 
                  value={videoUrl} 
                  onChange={(e) => {
                    setVideoUrl(e.target.value);
                    if (e.target.value) setVideoFile(null);
                  }}
                  placeholder="https://example.com/video.mp4" 
                  disabled={uploadingVideo}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    color: '#ffffff',
                    outline: 'none',
                    fontSize: '14px',
                    transition: 'border-color 0.2s ease',
                  }}
                />
              </div>
              
              <button 
                type="submit" 
                className="submit-btn" 
                disabled={uploadingVideo}
              >
                {uploadingVideo ? (
                  <>
                    <RefreshCw className="animate-spin" size={16} />
                    <span>Uploading Video & Saving...</span>
                  </>
                ) : (
                  <span>Save Creator Profile</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

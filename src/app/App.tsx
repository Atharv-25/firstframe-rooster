import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Creator, Reel } from './data/creators';
import { CreatorCard } from './components/CreatorCard';
import { Plus, Check, AlertCircle, X, CheckSquare, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const NICHE_OPTIONS = [
  'Fashion', 'Makeup', 'Skincare', 'Wellness', 'Fitness',
  'Hair', 'Nails', 'Lifestyle', 'Food', 'Travel', 'Tech', 'UGC', 'Unboxing', 'Gaming', 'Finance',
];

const NICHE_ALL = 'All';

export interface Campaign {
  id: string;
  name: string;
  date: string;
  creators: Creator[];
}

export default function App() {
  const [creatorsList, setCreatorsList] = useState<Creator[]>([]);
  const [campaignList, setCampaignList] = useState<Creator[]>([]);
  const [allCampaigns, setAllCampaigns] = useState<Campaign[]>([]);
  const [showCampaignsModal, setShowCampaignsModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Creator Form State
  const [newName, setNewName] = useState('');
  const [newProfileUrl, setNewProfileUrl] = useState('');
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [newFollowers, setNewFollowers] = useState('');
  const [newNiches, setNewNiches] = useState<string[]>([]);
  const [newReels, setNewReels] = useState<Reel[]>([{
    id: `reel_${Date.now()}_0`,
    label: 'Demo Reel',
    videoUrl: '',
  }]);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);

  // Stats Data [modalError, setModalError] = useState<string | null>('');
  const [modalError, setModalError] = useState<string | null>('');
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);
  const [isSavingCreator, setIsSavingCreator] = useState(false);
  const [editingCreator, setEditingCreator] = useState<Creator | null>(null);

  // Simple Router Detection based on window.location.pathname
  const [isAdminView, setIsAdminView] = useState(() => window.location.pathname === '/kalva');

  const [submittingCampaign, setSubmittingCampaign] = useState(false);
  const [selectedNiche, setSelectedNiche] = useState<string>(NICHE_ALL);
  const [isSyncingFollowers, setIsSyncingFollowers] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Listen to popstate event to handle forward/backward path changes
  useEffect(() => {
    const handleLocationChange = () => {
      setIsAdminView(window.location.pathname === '/kalva');
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Initialize creators from Supabase Storage bucket
  useEffect(() => {
    const loadCreators = () => {
      // Use a timestamp to prevent browser caching of the JSON file
      // Try to load from local bundled data instead of Supabase Storage 
      // to bypass the 'exceed_cached_egress_quota' limit!
      
      // We imported 'creators' statically at the top of the file
      import('./data/creators').then(module => {
        const parsed = [...module.creators];
        // Sort newest first based on numeric id timestamp
        parsed.sort((a: Creator, b: Creator) => {
          const idA = parseInt(a.id.split('_')[1] || '0');
          const idB = parseInt(b.id.split('_')[1] || '0');
          return idB - idA;
        });
        
        setCreatorsList(parsed);
      }).catch(e => {
        console.error("Failed to load local creators data", e);
      });
    };
    const loadCampaigns = async () => {
      try {
        const webAppUrl = import.meta.env.VITE_SHEETS_WEBAPP_URL || "https://script.google.com/macros/s/AKfycbw13qQVMpT3k0IY_LLDUcl4_PyK0tVopVbkbFGZcpwBEqMH_H5AdxCrkPJnYimWCBri-Q/exec";
        const res = await fetch(webAppUrl);
        const data = await res.json();
        
        if (data && data.success && data.campaigns) {
          setAllCampaigns(data.campaigns);
        } else {
          setAllCampaigns([]);
        }
      } catch (e) {
        console.warn("Failed to load campaigns from Google Sheets.", e);
        setAllCampaigns([]);
      }
    };
    loadCreators();
    loadCampaigns();
  }, []);

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

  const handleUpdateName = (id: string, newName: string) => {
    const updated = creatorsList.map((c) => (c.id === id ? { ...c, name: newName } : c));
    setCreatorsList(updated);
    saveCreatorsToBackend(updated);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this creator from the roster?')) {
      const creatorToDelete = creatorsList.find(c => c.id === id);
      const updated = creatorsList.filter((c) => c.id !== id);
      setCreatorsList(updated);

      // Also remove from campaign list if present
      if (campaignList.some(c => c.id === id)) {
        const updatedCampaign = campaignList.filter(c => c.id !== id);
        setCampaignList(updatedCampaign);
        localStorage.setItem('campaignList', JSON.stringify(updatedCampaign));
      }

      saveCreatorsToBackend(updated);

      if (creatorToDelete) {
        try {
          const { error: dbError } = await supabase.from('creators').delete().eq('name', creatorToDelete.name);
          if (dbError) console.error("Error deleting from Supabase DB:", dbError);
          
          if (creatorToDelete.reels && creatorToDelete.reels.length > 0) {
            const videoUrl = creatorToDelete.reels[0].videoUrl;
            if (videoUrl && videoUrl.includes('/storage/v1/object/public/videos/')) {
               const filename = videoUrl.split('/').pop();
               if (filename) {
                  const { error: storageError } = await supabase.storage.from('videos').remove([filename]);
                  if (storageError) console.error("Error deleting from Supabase Storage:", storageError);
               }
            }
          }
        } catch(e) {
          console.error("Supabase delete failed:", e);
        }
      }

      triggerStatus('success', 'Creator successfully deleted.');
    }
  };

  const saveCreatorsToBackend = async (list: Creator[]) => {
    try {
      // Direct Supabase Storage upload using the client's service role key
      const { error } = await supabase.storage
        .from('creator-data')
        .upload('creators.json', JSON.stringify(list, null, 2), {
          contentType: 'application/json',
          upsert: true,
        });

      if (error) throw error;
      
    } catch (e: any) {
      console.error(e);
      triggerStatus('error', `Failed to persist roster to cloud: ${e.message}`);
    }
  };

  const handleToggleCampaign = (creator: Creator) => {
    setCampaignList((prevList) => {
      const exists = prevList.some((c) => c.id === creator.id);
      let updated: Creator[];

      if (exists) {
        updated = prevList.filter((c) => c.id !== creator.id);
        setTimeout(() => triggerStatus('success', `Removed ${creator.name.split(' ')[0]} from Campaign shortlist.`), 0);
      } else {
        updated = [...prevList, creator];
        setTimeout(() => triggerStatus('success', `Added ${creator.name.split(' ')[0]} to Campaign shortlist.`), 0);
      }
      localStorage.setItem('campaignList', JSON.stringify(updated));
      return updated;
    });
  };

  const handleSubmitCampaign = async () => {
    if (campaignList.length === 0) return;
    
    const campaignName = window.prompt("Please enter the name for this Campaign:");
    if (!campaignName) return; // User cancelled
    
    setSubmittingCampaign(true);
    triggerStatus('success', 'Submitting shortlist to Google Sheets...');

    // Check if direct Google Sheets Web App URL is configured in environment variables
    const webAppUrl = import.meta.env.VITE_SHEETS_WEBAPP_URL || "https://script.google.com/macros/s/AKfycbw13qQVMpT3k0IY_LLDUcl4_PyK0tVopVbkbFGZcpwBEqMH_H5AdxCrkPJnYimWCBri-Q/exec";

    try {
      let success = false;
      let errorMsg = '';
      
      const payload = { campaignName, creators: campaignList };

      if (webAppUrl) {
        // Direct client-side submission with no-cors to prevent CORS/redirect errors.
        await fetch(webAppUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'text/plain',
          },
          body: JSON.stringify(payload),
        });
        success = true;
      } else {
        // Fallback to local dev server endpoint if no URL is provided
        const res = await fetch('/api/add-to-campaign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        success = data.success;
        errorMsg = data.error;
      }

      if (success) {
        const newCampaign: Campaign = {
          id: `camp_${Date.now()}`,
          name: campaignName,
          date: new Date().toISOString(),
          creators: campaignList
        };
        const updatedCampaigns = [...allCampaigns, newCampaign];
        setAllCampaigns(updatedCampaigns);

        triggerStatus('success', `✓ Successfully submitted ${campaignList.length} creators to Campaign!`);
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

  const resetAddModal = () => {
    setNewName('');
    setNewProfileUrl('');
    setNewFollowers('');
    setNewNiches([]);
    setNewReels([{ videoUrl: '', label: '' }]);
    setModalError(null);
  };

  const handleFetchDetails = async () => {
    if (!newProfileUrl) {
      setModalError('Please enter an Instagram Profile URL first.');
      return;
    }
    
    setIsFetchingDetails(true);
    setModalError(null);

    try {
      const res = await fetch('/api/fetch-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileUrl: newProfileUrl.trim() })
      });

      // Check if response is actually JSON
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        setModalError('Server returned an invalid response. Please try again or enter details manually.');
        return;
      }

      const data = await res.json();
      
      if (res.ok && data.success) {
        if (data.name) setNewName(data.name);
        if (data.followers) setNewFollowers(data.followers);
      } else {
        setModalError(`Failed to fetch details: ${data.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      setModalError(`Network error: ${e.message}`);
    } finally {
      setIsFetchingDetails(false);
    }
  };

  const handleEditCreator = (creator: Creator) => {
    setEditingCreator(creator);
    setNewName(creator.name);
    setNewProfileUrl(creator.profileUrl || '');
    setNewFollowers(creator.followers || '');
    setNewNiches(creator.niches || []);
    
    if (creator.reels && creator.reels.length > 0) {
      setNewReels([creator.reels[0]]);
    } else {
      setNewReels([{
        id: `reel_${Date.now()}_0`,
        label: 'Demo Reel',
        videoUrl: '',
      }]);
    }
    setShowAddModal(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploadingVideo(true);
    setModalError('');
    try {
      const res = await fetch('/api/upload-video', {
        method: 'POST',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNewReels([{ ...newReels[0], videoUrl: data.url }]);
      } else {
        setModalError(`Upload failed: ${data.error}`);
      }
    } catch (err: any) {
      setModalError(`Upload error: ${err.message}`);
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handleAddCreator = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');

    if (!newProfileUrl.trim()) {
      setModalError('Instagram Profile URL is required.');
      return;
    }

    // Validation
    if (!newName.trim()) {
      setModalError('Creator name is required.');
      return;
    }
    if (newNiches.length === 0) {
      setModalError('Select at least one niche.');
      return;
    }
    
    // Duplicate check
    const isDuplicate = creatorsList.some(c => 
      c.profileUrl && c.profileUrl.toLowerCase() === newProfileUrl.trim().toLowerCase()
    );
    if (isDuplicate && !editingCreator) {
      setModalError('Warning: This creator is already on the page!');
      return;
    }
    
    // Extract handle from URL
    let cleanHandle = '';
    try {
      const urlObj = new URL(newProfileUrl);
      const parts = urlObj.pathname.split('/').filter(Boolean);
      if (parts.length > 0) cleanHandle = parts[0];
    } catch {
      // Ignore
    }

    setIsSavingCreator(true);

    try {
      let finalName = newName.trim();
      let finalFollowers = newFollowers.trim() || '—';
           const updatedCreator: Creator = {
          id: editingCreator ? editingCreator.id : `creator_${Date.now()}`,
          name: finalName || 'Unknown Creator',
          handle: cleanHandle || undefined,
          profileUrl: newProfileUrl.trim(),
          followers: finalFollowers,
          avgViews: "—", // Avg Views removed from UI
          niches: newNiches,
          reels: newReels, // Preserve existing or updated reels
        };
  
        let updatedList: Creator[];
        if (editingCreator) {
          updatedList = creatorsList.map(c => c.id === editingCreator.id ? updatedCreator : c);
        } else {
          updatedList = [updatedCreator, ...creatorsList];
        }
  
        setCreatorsList(updatedList);
        
        // 1. Save Niches, Name, and AvgViews to disk FIRST
        await saveCreatorsToBackend(updatedList);
  
        const reelUrl = newReels[0]?.videoUrl?.trim() || '';

        // Trigger Cloudinary deletion if editing and URL changed
        if (editingCreator && editingCreator.reels && editingCreator.reels.length > 0) {
          const oldUrl = editingCreator.reels[0].videoUrl;
          if (oldUrl && oldUrl.includes('cloudinary.com') && oldUrl !== reelUrl) {
            console.log('Replacing video, deleting old Cloudinary file:', oldUrl);
            fetch('/api/delete-video', {
              method: 'POST',
              body: JSON.stringify({ url: oldUrl })
            }).catch(console.error);
          }
        }
  
        // 2. Trigger Apify to scrape reels ONLY IF it's a new external URL
        if (reelUrl.startsWith('http')) {
          try {
            const res = await fetch('/api/process-creator', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ profileUrl: newProfileUrl.trim(), reelUrl })
            });
            const data = await res.json();
            if (!res.ok) {
              console.error('Apify scraping failed:', data.error);
            }
          } catch (e) {
            console.error('Process error:', e);
          }
        }
      
      // 3. Reload the page to pull the newly generated reels from creators.json
      window.location.reload();

      resetAddModal();
      setShowAddModal(false);
      triggerStatus('success', `Creator ${newName.trim()} added successfully!`);
    } catch (e: any) {
      setModalError(`Failed to save creator: ${e.message}`);
    } finally {
      setIsSavingCreator(false);
    }
  };

  const toggleNiche = (niche: string) => {
    setNewNiches(prev =>
      prev.includes(niche)
        ? prev.filter(n => n !== niche)
        : [...prev, niche]
    );
  };

  const updateReel = (index: number, field: keyof Reel, value: string) => {
    setNewReels(prev => prev.map((r, i) =>
      i === index ? { ...r, [field]: value } : r
    ));
  };

  const addReelEntry = () => {
    if (newReels.length >= 6) return;
    setNewReels(prev => [...prev, {
      id: `reel_${Date.now()}_${prev.length}`,
      label: `Demo Reel ${prev.length + 1}`,
      videoUrl: '',
    }]);
  };

  const removeReelEntry = (index: number) => {
    if (newReels.length <= 1) return;
    setNewReels(prev => prev.filter((_, i) => i !== index));
  };

  const clearCampaign = () => {
    if (confirm('Are you sure you want to clear your local campaign shortlist?')) {
      setCampaignList([]);
      localStorage.removeItem('campaignList');
      triggerStatus('success', 'Shortlist cleared.');
    }
  };

  const exportToCSV = () => {
    if (campaignList.length === 0) {
      triggerStatus('error', 'No creators selected to export!');
      return;
    }
    const headers = ['Name', 'Handle', 'Profile URL', 'Followers', 'Niches', 'Reel Video'];
    const rows = campaignList.map(c => {
      const name = c.name ? c.name.replace(/"/g, '""') : '';
      const handle = c.handle ? c.handle.replace(/"/g, '""') : '';
      const profile = c.profileUrl ? c.profileUrl.replace(/"/g, '""') : '';
      const followers = c.followers ? c.followers.replace(/"/g, '""') : '';
      const niches = c.niches ? c.niches.join(', ').replace(/"/g, '""') : '';
      const reel = c.reels && c.reels[0] ? c.reels[0].videoUrl.replace(/"/g, '""') : '';
      return `"${name}","${handle}","${profile}","${followers}","${niches}","${reel}"`;
    });
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'FirstFrame_Campaign_Export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportCampaignCSV = (campaign: Campaign) => {
    const headers = ['Name', 'Handle', 'Profile URL', 'Followers', 'Niches', 'Reel Video'];
    const rows = campaign.creators.map(c => {
      const name = c.name ? c.name.replace(/"/g, '""') : '';
      const handle = c.handle ? c.handle.replace(/"/g, '""') : '';
      const profile = c.profileUrl ? c.profileUrl.replace(/"/g, '""') : '';
      const followers = c.followers ? c.followers.replace(/"/g, '""') : '';
      const niches = c.niches ? c.niches.join(', ').replace(/"/g, '""') : '';
      const reel = c.reels && c.reels[0] ? c.reels[0].videoUrl.replace(/"/g, '""') : '';
      return `"${name}","${handle}","${profile}","${followers}","${niches}","${reel}"`;
    });
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${campaign.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_creators.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const syncAllFollowers = async () => {
    if (isSyncingFollowers) return;
    setIsSyncingFollowers(true);
    triggerStatus('success', 'Syncing followers for all creators...');
    
    const rapidKey = import.meta.env.VITE_RAPID_API_KEY;
    if (!rapidKey) {
      triggerStatus('error', 'No RapidAPI key configured.');
      setIsSyncingFollowers(false);
      return;
    }

    const updated = [...creatorsList];
    let successCount = 0;
    
    for (let i = 0; i < updated.length; i++) {
      const creator = updated[i];
      if (!creator.handle) continue;
      try {
        const res = await fetch(
          `https://instagram-downloader-download-instagram-stories-videos4.p.rapidapi.com/convert?url=https://www.instagram.com/${creator.handle}/`,
          {
            method: 'GET',
            headers: {
              'x-rapidapi-key': rapidKey,
              'x-rapidapi-host': 'instagram-downloader-download-instagram-stories-videos4.p.rapidapi.com',
            },
          }
        );
        const json = await res.json();
        // Try to extract follower count from response metadata
        const followerCount = json?.data?.followers_count || json?.followers || json?.edge_followed_by?.count;
        if (followerCount !== undefined) {
          const formatted = followerCount >= 1000 
            ? `${(followerCount / 1000).toFixed(1)}K` 
            : `${followerCount}`;
          updated[i] = { ...creator, followers: formatted };
          successCount++;
        }
      } catch (e) {
        console.warn(`Failed to sync ${creator.handle}`, e);
      }
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 300));
    }
    
    if (successCount > 0) {
      setCreatorsList(updated);
      await saveCreatorsToBackend(updated);
      triggerStatus('success', `✓ Synced followers for ${successCount} creators!`);
    } else {
      triggerStatus('error', 'Could not fetch followers. API may not support profile scraping.');
    }
    setIsSyncingFollowers(false);
  };

  // ── Drag & Drop handlers ────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== dragOverId) setDragOverId(id);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }
    setCreatorsList(prev => {
      const list = [...prev];
      const fromIdx = list.findIndex(c => c.id === draggedId);
      const toIdx = list.findIndex(c => c.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [moved] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, moved);
      // persist order to Supabase silently
      saveCreatorsToBackend(list).catch(console.error);
      return list;
    });
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
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
            <div className="header-actions" style={{ display: 'flex', gap: '8px' }}>
              <div className="admin-badge">
                <Shield size={14} />
                <span>Admin Mode</span>
              </div>
              <button
                className="action-btn action-btn--secondary"
                style={{ backgroundColor: '#fff', color: '#111', border: '1px solid #e0e0e0' }}
                onClick={() => setShowCampaignsModal(true)}
              >
                <span>Manage Campaigns</span>
              </button>
              <button
                className="action-btn action-btn--secondary"
                style={{ backgroundColor: isSyncingFollowers ? '#f0f0f0' : '#fff', color: '#111', border: '1px solid #e0e0e0' }}
                onClick={syncAllFollowers}
                disabled={isSyncingFollowers}
              >
                <span>{isSyncingFollowers ? 'Syncing...' : 'Sync Followers'}</span>
              </button>
              <button
                className="action-btn action-btn--primary"
                onClick={() => {
                  resetAddModal();
                  setShowAddModal(true);
                }}
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
              : 'Starting Point: These are UGC demo reels from our premium 2026 creator roster. Click any card to view their full portfolio, shortlist candidates, and submit campaign.'}
          </p>
        </div>

        {/* Niche Filter Bar */}
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          flexWrap: 'nowrap', 
          overflowX: 'auto',
          marginBottom: '16px', 
          width: '100%',
          paddingBottom: '8px',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
        className="hide-scrollbar"
        >
          <style>{`
            .hide-scrollbar::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          {[NICHE_ALL, ...NICHE_OPTIONS].map((niche) => (
            <button
              key={niche}
              onClick={() => setSelectedNiche(niche)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: selectedNiche === niche ? '1.5px solid #111' : '1.5px solid #ddd',
                background: selectedNiche === niche ? '#111' : '#fff',
                color: selectedNiche === niche ? '#fff' : '#555',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                fontFamily: 'Inter, sans-serif',
                letterSpacing: '0.2px',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              {niche}
            </button>
          ))}
        </div>

        {/* Creator Masonry Grid */}
        <div className="masonry-grid" style={{ paddingTop: '4px' }}>
          {creatorsList
            .filter(c => selectedNiche === NICHE_ALL || (c.niches && c.niches.some(n => n.toLowerCase() === selectedNiche.toLowerCase())))
            .map((creator) => (
            <div
              key={creator.id}
              className="masonry-item"
              draggable={isAdminView}
              onDragStart={(e) => isAdminView && handleDragStart(e, creator.id)}
              onDragOver={(e) => isAdminView && handleDragOver(e, creator.id)}
              onDrop={(e) => isAdminView && handleDrop(e, creator.id)}
              onDragEnd={handleDragEnd}
              style={{
                opacity: draggedId === creator.id ? 0.35 : 1,
                outline: dragOverId === creator.id && draggedId !== creator.id
                  ? '2px dashed #111' : 'none',
                outlineOffset: '2px',
                borderRadius: '16px',
                transition: 'opacity 0.15s ease, outline 0.1s ease',
                cursor: isAdminView ? 'grab' : 'default',
              }}
            >
              <CreatorCard
                creator={creator}
                inCampaign={campaignList.some((c) => c.id === creator.id)}
                onToggleCampaign={handleToggleCampaign}
                isAdminView={isAdminView}
                onUpdateName={handleUpdateName}
                onDelete={handleDelete}
                onEdit={handleEditCreator}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Campaign Shortlist Floating Pill */}
      {true && (
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
                {isAdminView && (
                  <>
                    <button
                      type="button"
                      className="campaign-pill__submit-btn"
                      style={{ background: '#fff', color: '#111', border: '1px solid #e0e0e0' }}
                      onClick={exportToCSV}
                    >
                      Export CSV
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
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Manage Campaigns Modal (Admin only) */}
      {showCampaignsModal && (
        <div className="modal-overlay" onClick={() => setShowCampaignsModal(false)}>
          <div className="modal-card" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Manage Campaigns</h3>
              <button
                className="modal-close"
                onClick={() => setShowCampaignsModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '24px', maxHeight: '60vh', overflowY: 'auto' }}>
              {allCampaigns.length === 0 ? (
                <p style={{ color: '#666', textAlign: 'center' }}>No campaigns have been submitted yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {allCampaigns.map(camp => (
                    <div key={camp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#f9f9f9', borderRadius: '12px', border: '1px solid #eee' }}>
                      <div>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#111' }}>{camp.name}</h4>
                        <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: '#666' }}>
                          <span>{camp.creators.length} Creators</span>
                          <span>•</span>
                          <span>{new Date(camp.date).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <button
                        className="action-btn action-btn--secondary"
                        style={{ backgroundColor: '#fff', border: '1px solid #ddd', padding: '8px 16px', fontSize: '13px' }}
                        onClick={() => exportCampaignCSV(camp)}
                      >
                        Export CSV
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Creator Modal (Admin only) */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingCreator ? 'Edit Creator' : 'Add New Creator'}</h3>
              <button
                className="modal-close"
                onClick={() => setShowAddModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddCreator}>
              <div className="modal-body-scroll">
                {/* Error message */}
                {modalError && (
                  <div className="modal-error">{modalError}</div>
                )}

                {/* Profile URL with Fetch Button */}
                <div className="form-group" style={{ position: 'relative' }}>
                  <label>Instagram Profile URL *</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={newProfileUrl}
                      onChange={(e) => setNewProfileUrl(e.target.value)}
                      placeholder="e.g. https://instagram.com/siyauppall"
                      style={{ flex: 1 }}
                    />
                    <button 
                      type="button" 
                      className="modal-submit-btn" 
                      style={{ width: 'auto', margin: 0, padding: '0 16px' }}
                      onClick={handleFetchDetails}
                      disabled={isFetchingDetails}
                    >
                      {isFetchingDetails ? 'Fetching...' : 'Fetch Details'}
                    </button>
                  </div>
                </div>

                {/* Name */}
                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Siya Uppal"
                  />
                </div>

                {/* Followers */}
                <div className="form-group">
                  <label>Followers</label>
                  <input
                    type="text"
                    value={newFollowers}
                    onChange={(e) => setNewFollowers(e.target.value)}
                    placeholder="e.g. 12.6K"
                  />
                </div>

                {/* Niche pills */}
                <div className="form-group">
                  <label>Niches *</label>
                  <div className="niche-pills">
                    {NICHE_OPTIONS.map((niche) => (
                      <button
                        key={niche}
                        type="button"
                        className={`niche-pill-toggle ${newNiches.includes(niche) ? 'niche-pill-toggle--active' : ''}`}
                        onClick={() => toggleNiche(niche)}
                      >
                        {niche}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reels section */}
                <div className="form-group">
                  <label>Demo Reel URL *</label>
                  <div className="reel-entry">
                    <input
                      type="text"
                      value={newReels[0].videoUrl}
                      onChange={(e) => updateReel(0, 'videoUrl', e.target.value)}
                      placeholder="https://... or local .mp4 filename"
                      disabled={isUploadingVideo}
                    />
                    
                    <div style={{ marginTop: '8px', marginBottom: '8px', padding: '12px', background: '#222', borderRadius: '6px', border: '1px dashed #444', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <span style={{ color: '#ccc', fontSize: '13px' }}>
                        Or upload a video directly to Cloudinary:
                      </span>
                      <input 
                        type="file" 
                        accept="video/mp4,video/quicktime" 
                        onChange={handleFileUpload} 
                        disabled={isUploadingVideo}
                        style={{ fontSize: '14px' }}
                      />
                      {isUploadingVideo && <span style={{ color: '#6abf69', fontSize: '13px' }}>Uploading to Cloudinary... please wait...</span>}
                    </div>

                    <span className="reel-entry__helper">
                      Supports: direct Cloudinary links · direct .mp4
                    </span>
                    <div className="reel-entry__row" style={{ gridTemplateColumns: '1fr' }}>
                      <input
                        type="text"
                        value={newReels[0].label}
                        onChange={(e) => updateReel(0, 'label', e.target.value)}
                        placeholder="Label (e.g. Skincare Demo)"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit button outside scroll area */}
              <div style={{ padding: '0 20px 20px' }}>
                <button type="submit" className="modal-submit-btn" disabled={isSavingCreator}>
                  {isSavingCreator ? 'Downloading & Saving...' : 'Save Creator Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

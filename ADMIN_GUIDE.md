# FirstFrame Rooster: Admin & Content Guide

Welcome to the FirstFrame Rooster admin guide. This document explains how the admin side of your platform operates and how you can manage the creator roster.

## 1. Accessing the Admin Panel

The Admin panel is a secure environment where you can manage creators. 

- **How to access**: Add `?admin=true` to the end of the Vercel URL.
- **Example**: `https://firstframe-rooster-peach.vercel.app/?admin=true`

When you access the admin view, the UI changes slightly:
1. The page title changes to "Roster Management Console".
2. The "Add to Campaign" buttons disappear.
3. You gain access to the **"+ Add Creator"** button at the top right.
4. Each creator card displays a **"X"** delete button in the top left corner, and a pencil edit button in the top right.
5. You can see creator handles (e.g., `@username`) under their names.

---

## 2. Adding a New Creator

Adding a new creator is a highly automated process powered by Apify and Supabase. 

### Step-by-step Process:
1. Ensure you are in the Admin Panel (`?admin=true`).
2. Click the **"+ Add Creator"** button at the top right of the page.
3. A modal will pop up asking for the creator's **Instagram URL**.
   - *Example:* `https://www.instagram.com/ugcwithshiw/`
4. Choose the niche categories for this creator (e.g., *Fashion & Style*, *Beauty & Skincare*).
5. Click **"Save Creator Profile"**.

### What happens in the background?
The system will run a complex cloud workflow entirely on its own:
1. **Apify Scraper**: It contacts an Apify residential proxy scraper to bypass Instagram's strict bot protections.
2. **Data Extraction**: It automatically pulls the creator's:
   - Full Name
   - Exact Follower count
   - Their most recent Instagram Reels (Video URLs)
   - High-quality video cover thumbnails (so mobile browsers load them instantly)
3. **Cloud Sync**: It merges all of this extracted data with the niches you selected, and saves it directly to your `creators.json` database hosted in your Supabase Cloud Bucket.
4. **Live Update**: The app fetches the newly updated database from Supabase and instantly displays the new creator on the grid for all users globally.

---

## 3. Editing Existing Creators

You can modify details of existing creators directly from the grid:
- **Rename**: Click on the pencil icon in the top right of the creator's video thumbnail. You can change their display name, update their followers manually, or change their active niches. 
- **Delete**: Click the **"X"** icon in the top left of the video thumbnail to instantly remove them from the database. This action syncs to the cloud immediately.

---

## 4. Submitting Campaigns

For regular users (brands/clients viewing the standard page without `?admin=true`):
1. They can browse the creator grid.
2. They click **"+ Add to Campaign"** to shortlist their favorite creators.
3. They can add an unlimited number of creators; the shortlist is stored securely in their browser memory.
4. When they click **"Submit Campaign Request"** (the floating pill at the bottom), it sends their shortlisted creators securely to your integrated Google Sheets document for you to review.

---

## 5. Troubleshooting & Tips

- **Video Autoplay on Mobile**: Apple's iOS strictly blocks videos from autoplaying to save battery. The app mitigates this by automatically extracting "Poster" thumbnails from Instagram so users see a high-res image instantly instead of a black square. Users can just tap the video to force it to play.
- **Scraper Delays**: When adding a new creator, Apify takes roughly 15-30 seconds to bypass Instagram's security and scrape the profile. Do not close the window while the "Downloading & Saving..." button is spinning.
- **Private Accounts**: The scraper *cannot* scrape private Instagram accounts. Make sure the creator profile is fully public before pasting the URL.

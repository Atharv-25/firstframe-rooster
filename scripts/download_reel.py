import sys
import os
import json
import requests
import instaloader

def get_instagram_id(url_or_id):
    if "instagram.com" in url_or_id:
        try:
            parts = url_or_id.split('/')
            idx = -1
            for i, p in enumerate(parts):
                if p in ("reel", "p"):
                    idx = i
                    break
            if idx != -1 and idx + 1 < len(parts):
                return parts[idx + 1].split('?')[0]
        except Exception:
            pass
        return url_or_id.split('?')[0].split('/')[-1]
    return url_or_id

def download_video(url, output_path):
    response = requests.get(url, stream=True)
    response.raise_for_status()
    with open(output_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            if chunk:
                f.write(chunk)

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Missing Instagram Reel URL or ID"}))
        sys.exit(1)

    url_or_id = sys.argv[1]
    shortcode = get_instagram_id(url_or_id)
    if not shortcode:
        print(json.dumps({"success": False, "error": "Could not parse Instagram shortcode"}))
        sys.exit(1)

    # Output path
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    videos_dir = os.path.join(project_root, 'public', 'videos')
    
    if not os.path.exists(videos_dir):
        os.makedirs(videos_dir, exist_ok=True)
        
    filename = f"reel_{shortcode}.mp4"
    output_path = os.path.join(videos_dir, filename)

    # Check if already downloaded
    if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
        print(json.dumps({"success": True, "filename": filename}))
        sys.exit(0)

    try:
        L = instaloader.Instaloader()
        # Avoid creating files/dirs locally in the script directory during instaloader lookup
        L.dirname_pattern = '/tmp'
        
        post = instaloader.Post.from_shortcode(L.context, shortcode)
        
        if not post.is_video:
            print(json.dumps({"success": False, "error": "This Instagram post is not a video"}))
            sys.exit(1)
            
        video_url = post.video_url
        if not video_url:
            print(json.dumps({"success": False, "error": "Could not retrieve direct video URL"}))
            sys.exit(1)

        download_video(video_url, output_path)
        print(json.dumps({"success": True, "filename": filename}))
        
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()

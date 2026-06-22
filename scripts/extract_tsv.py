import csv
import re
import sys

def run():
    output = '# All Creators and Demo Reels\n\n'
    output += '| Creator Name | Instagram | First Reel URL |\n'
    output += '| :--- | :--- | :--- |\n'
    
    with open('scripts/new_creators.tsv', 'r', encoding='utf-8') as f:
        reader = csv.reader(f, delimiter='\t')
        header = next(reader)
        for row in reader:
            if not row or not any(row): continue
            
            if re.match(r'\d{4}-\d{2}-\d{2}T', row[0]):
                row = row[1:]
                
            while len(row) < 11:
                row.append('')
                
            first = row[0].strip()
            last = row[1].strip()
            name = f"{first} {last}".strip()
            if not name:
                continue
                
            ig = row[6].strip()
            reels = row[8] if len(row) > 8 else ''
            if not reels and len(row) > 10:
                reels = row[10]
                
            # Fallback if reels column is totally empty but we see links in the row
            if not reels:
               row_text = ' '.join(row)
               reels_match = re.findall(r'https://www\.instagram\.com/reel/[^\s",]+', row_text)
               if reels_match: reels = reels_match[0]
                
            match = re.search(r'https?://[^\s",<>]+', reels)
            first_reel = f"[Link]({match.group(0)})" if match else 'N/A'
            
            ig_match = re.search(r'instagram\.com/([a-zA-Z0-9._]+)', ig)
            if ig_match:
                handle = f"`{ig_match.group(1)}`"
            elif ig and not ig.startswith('http'):
                handle = f"`{ig}`"
            else:
                handle = ig if ig else 'N/A'
                
            output += f"| **{name}** | {handle} | {first_reel} |\n"
            
    with open(r'C:\Users\lenovo\.gemini\antigravity-ide\brain\4096ac7e-141c-4ad7-b8bd-92a17cf50d30\all_creators_reels.md', 'w', encoding='utf-8') as out:
        out.write(output)
        
if __name__ == '__main__':
    run()

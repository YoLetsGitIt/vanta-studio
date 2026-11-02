"""Build short website demos from the reviewed October 1 artist tutorial edits.

The existing edits already remove recording markers and include tap indicators.
Crop only their device area: keep the real app proportions, with no invented UI.
No account access or re-recording is needed. Requires ffmpeg / ffprobe.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / 'demo/artist-tutorial/clips'
OUTPUT = ROOT / 'public/studio/artist/demos'
OUTPUT.mkdir(parents=True, exist_ok=True)

# Times are in the reviewed, composed tutorial clips (not the raw recordings).
EDITS = {
    'portfolio': ('03', [(4.7, 13.5), (20, 32.3)], 'Upload, save and tag your work', [
        (0, 'Choose pieces from your gallery.'), (8.8, 'Keep unfinished uploads in drafts.'),
        (14.5, 'Review the suggested title and tags.')]),
    'discovery': ('04', [(0, 14.4)], 'From the feed to your work', [
        (0, 'Browse the tattoo feed.'), (6, 'Open a piece for a closer look.'),
        (11, 'See its style and placement tags.')]),
    'requests': ('07', [(2.5, 16.6)], 'Review a booking request', [
        (0, 'Open your incoming requests.'), (4.3, 'Read the design and session details.'),
        (8, 'Review the brief before proposing a time.')]),
    'proposals': ('08', [(2.7, 16)], 'Prepare a quote and time', [
        (0, 'Set the duration and estimated quote.'), (4.2, 'Check the client’s availability.'),
        (9.5, 'Choose a time for your proposal.')]),
    'schedule': ('06', [(3.3, 11.6)], 'Set your working hours', [
        (0, 'Review your weekly hours.'), (4.1, 'Add an override for a specific date.'),
        (5.5, 'Block a day off before saving.')]),
    'analytics': ('11', [(0.1, 7.4)], 'See your views and saves', [
        (0, 'See your portfolio totals.'), (2.4, 'Tap Views for the full count.'),
        (5.9, 'Return to your portfolio.')]),
}

catalogue = {}
for key, (scene, cuts, title, chapters) in EDITS.items():
    parts = [f'[0:v]trim=start={start}:end={end},setpts=PTS-STARTPTS[v{i}]'
             for i, (start, end) in enumerate(cuts)]
    parts.append(''.join(f'[v{i}]' for i in range(len(cuts))) +
                 f'concat=n={len(cuts)}:v=1:a=0,crop=432:966:1164:57,setsar=1,fps=30[out]')
    target = OUTPUT / f'{key}.mp4'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(SOURCE / f'{scene}.mp4'),
                    '-filter_complex', ';'.join(parts), '-map', '[out]', '-an',
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p',
                    '-movflags', '+faststart', str(target)], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', '0.2', '-i', str(target),
                    '-frames:v', '1', '-q:v', '2', str(OUTPUT / f'{key}-poster.jpg')], check=True)
    duration = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries',
                    'format=duration', '-of', 'csv=p=0', str(target)]))
    catalogue[key] = dict(src=f'/studio/artist/demos/{key}.mp4',
                         poster=f'/studio/artist/demos/{key}-poster.jpg',
                         duration=round(duration), title=title, portrait=True,
                         context='Recorded in the Vanta app',
                         chapters=[dict(at=at, title=caption) for at, caption in chapters])
    print(f'{key}: {duration:.1f}s / {target.stat().st_size // 1024} KB')

(ROOT / 'lib/artistFeatureDemos.js').write_text(
    '// Real artist-app footage. Regenerate with scripts/prepare-artist-demos.py.\n'
    'export const ARTIST_FEATURE_DEMOS = ' + json.dumps(catalogue, indent=2, ensure_ascii=False) + ';\n')

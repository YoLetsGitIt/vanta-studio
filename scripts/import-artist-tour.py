"""Import a reviewed narrated tour export for both studio and website players."""
import argparse
import json
import shutil
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('production', type=Path, help='Directory containing exports/ and poster.jpg')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
production = args.production.resolve()
video = production / 'exports/vanta-artist-app-tour-full-first-cut.mp4'
chapters = json.loads((production / 'exports/chapters.json').read_text())
probe = json.loads(subprocess.check_output([
    'ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(video)
]))
assert any(s['codec_type'] == 'audio' for s in probe['streams']), 'Narration is missing'
assets = root / 'public/studio/artist/demos'
assets.mkdir(parents=True, exist_ok=True)
shutil.copy2(video, assets / 'artist-app-tour.mp4')
shutil.copy2(production / 'poster.jpg', assets / 'artist-app-tour-poster.jpg')
tour = dict(
    src='/studio/artist/demos/artist-app-tour.mp4?v=20261030',
    poster='/studio/artist/demos/artist-app-tour-poster.jpg?v=20261030',
    title='The Vanta artist app tour',
    duration=int(float(probe['format']['duration'])),
    portrait=False, tour=True, narrated=True,
    context='Narrated by Matthew, founder of Vanta',
    chapters=[dict(at=c['seekSeconds'], title=c['title']) for c in chapters],
)
(root / 'lib/artistAppTour.js').write_text(
    '// Imported by scripts/import-artist-tour.py.\nexport const ARTIST_APP_TOUR = '
    + json.dumps(tour, indent=2) + ';\n'
)
print(f'Imported narrated tour: {tour["duration"]} seconds, {len(chapters)} chapters')

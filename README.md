# वंशज & अक्षमा · शुभ विवाह

A wedding invitation website, hosted on GitHub Pages.

It is a static site with no build step:

- `index.html` holds all the invitation text, with one `<section class="scene">` for each screen. Each scene's background photo is a `.photo` element near the top of the file.
- `assets/css/style.css` holds the design: colours, fonts, the frame and the animations.
- `assets/js/main.js` handles:
  - scene changes from the wheel, swipes and keys
  - the opening doors and countdown
  - background music, plus the synthesised bell and chimes
  - fireworks, sparkles and petals
  - the scratch-to-reveal date
- `assets/vanshaj-akshama.ics` is the calendar file behind the "कैलेंडर में सहेजें" link.

To change the text, edit `index.html` and push. GitHub Pages republishes in about a minute.

You can link to a single screen with its id, for example `…/#haldi`, `…/#mandha`, `…/#baraat` or `…/#sampark`.

## Credits

**Photos** are from [Unsplash](https://unsplash.com) under the [Unsplash License](https://unsplash.com/license), which allows free use without attribution. All files are in `assets/img/photos/`:

| File | Unsplash photo |
|---|---|
| `ganesha.webp` | photo-1598090216740-eb040d8c3f82 |
| `haldi-bowls.webp` | photo-1670774837214-21b88943a6bb |
| `bg-mangal.webp` | photo-1631556373338-52e31188effc |
| `bg-aamantran.webp` | photo-1577083753695-e010191bacb5 |
| `bg-couple.webp` | photo-1621801306185-8c0ccf9c8eb8 |
| `bg-shubh.webp` | photo-1756190564669-215843660e93 |
| `bg-haldi.webp` | photo-1699764681875-dd04ce36b1c3 |
| `bg-mandha.webp` | photo-1589463349208-95817c91f971 |
| `bg-baraat.webp` | photo-1574495780742-6d9523a0f42e |
| `bg-family.webp` | photo-1745573673416-66e829644ae9 |
| `bg-vishesh.webp` | photo-1637250750846-8247d2b1ea08 |
| `bg-sampark.webp` | photo-1731441326210-bfcb6595e93a |

**Music:** `assets/audio/shehnai.mp3` is "Traditional wedding_ceremonial vibe with shehna" by DesiFreeMusic on [Pixabay](https://pixabay.com/music/wedding-traditional-wedding-ceremonial-vibe-with-shehna-376293/), used under the [Pixabay Content License](https://pixabay.com/service/license-summary/).

# वंशज & अक्षमा · शुभ विवाह

A wedding invitation website, hosted on GitHub Pages.

It is a static site with no build step:

- `index.html` holds all the invitation text, with one `<section class="scene">` for each screen.
- `assets/css/style.css` holds the design: colours, fonts, the frame and the animations.
- `assets/js/main.js` handles scene changes from the wheel, swipes and keys, plus the opening doors, countdown and gold dust.
- `assets/vanshaj-akshama.ics` is the calendar file behind the "कैलेंडर में सहेजें" link.

To change the text, edit `index.html` and push. GitHub Pages republishes in about a minute.

You can link to a single screen with its id, for example `…/#haldi`, `…/#mandha`, `…/#baraat` or `…/#sampark`.

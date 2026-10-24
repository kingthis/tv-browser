# TV Browser

A [TizenBrew](https://github.com/reisxd/TizenBrew) module that opens any website on a Samsung (Tizen) TV, with a remote-controlled pointer, an address bar and a basic ad blocker.

## Install

1. Install TizenBrew on the TV and open it.
2. **Module Manager → Add GitHub module** and enter `FZ-Labz/tv-browser`.
3. Open **TV Browser** from TizenBrew's home screen.

## Remote

| Button | Does |
| --- | --- |
| Arrows | Move the pointer. Hold to speed up. Push against the top or bottom edge to scroll. |
| OK | Click under the pointer. Clicking a text box opens the TV keyboard. |
| Back | Go back a page, or close the address bar / leave a text box. |
| CH ▲ (or Red) | Address bar: type a website or a search. |
| CH ▼ | Start page with shortcuts. |
| Play/Pause | Play or pause the video on the page. |

The pointer hides after a few seconds so it doesn't sit over videos; any arrow brings it back.

## Ad blocking

Runs in every page and frame at document start, like a content-blocker extension:

- Scripts, frames, images, `fetch`, XHR and beacons to known ad, pop-under and tracking hosts never load.
- `window.open` is disabled (a TV has no tabs, so it is only ever a pop-up). Links that would open a new tab open in place.
- Common ad slots are hidden with generic element-hiding rules.
- Click-jacking overlays that link to ad hosts are removed when you click them.

It can't intercept requests at the network layer the way a desktop extension can, so some ads served from a site's own domain or inside video players may still appear. Pairing it with an ad-blocking DNS on the TV covers more.

The block list is `AD_HOSTS` in `browser.js`; the hiding rules are `HIDE`.

## Develop

`browser.js` is ES5 because Tizen 6 TVs run an old Chromium. Test pages in `test/` run in any desktop browser:

```sh
python3 -m http.server 4810
# open http://127.0.0.1:4810/test/ads.html and http://127.0.0.1:4810/test/remote.html
```

The start page (`index.html`) is served from GitHub Pages at the module's `websiteURL`. TizenBrew fetches the module through jsDelivr, which caches GitHub files for up to 12 hours; purge `https://purge.jsdelivr.net/gh/FZ-Labz/tv-browser/browser.js` after a change.

## Licence

MIT

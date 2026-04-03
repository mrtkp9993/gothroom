# gothroom

`gothroom` is a browser-based image filtering tool focused on dark, grunge, and cinematic photo effects. It runs entirely on the client with plain HTML, CSS, and JavaScript, using the Canvas API for rendering and export.

## Running Locally

This project does not require a build step.

1. Clone or download the repository.
2. Open `index.html` in a browser.

If your browser restricts some local file behavior, serve the folder with a simple static server instead.

Example with Python:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Customization

You can extend the look of the app in a few straightforward places:

- Add or edit presets in `presets.js`

## Notes

- Processing happens in the browser. No backend is required.
- Large images will take longer to render because effects are applied on full-resolution pixel data.

## License

This project is licensed under the Unlicense. See [LICENSE](LICENSE) for details.

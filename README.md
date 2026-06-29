<div align="center">

# Neo Web Control Panel

A futuristic, glassmorphism-driven web dashboard for viewing URLs with theme switching, history tracking, and smooth animations.

[![License: MIT](https://img.shields.io/badge/License-MIT-7c3aed.svg)](LICENSE)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)]()
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)]()
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)]()

</div>

---

## Features

- **URL Viewer** — Enter any URL and view it in a sandboxed iframe viewer
- **Dark / Light Themes** — Toggle between themes with animated switch, persisted in localStorage
- **URL History** — Tracks the last 10 visited URLs with one-click reopen
- **Loading Animation** — Phased status updates with typewriter effect and progress bar
- **Error Handling** — Graceful UI for invalid URLs, network errors, and blocked iframes
- **Particle Background** — Animated mesh of connected particles
- **Glassmorphism UI** — Modern frosted-glass panels with soft shadows
- **Clipboard Integration** — Paste from clipboard and copy URL buttons
- **Fully Responsive** — Optimized for mobile, tablet, and desktop
- **Accessible** — ARIA labels, keyboard navigation, focus indicators
- **Zero Dependencies** — Pure HTML, CSS, and vanilla JavaScript
- **XSS Prevention** — Input sanitization and iframe sandboxing

## Screenshots

<div align="center">

> _Add screenshots here after deployment_

</div>

## Quick Start

### Option 1: GitHub Pages (Recommended)

1. **Fork or clone** this repository
2. Go to **Settings → Pages**
3. Under **Source**, select "Deploy from a branch"
4. Choose `main` branch and `/ (root)` folder
5. Click **Save**
6. Your app will be live at `https://<username>.github.io/<repo-name>/`

### Option 2: Local Development

```bash
# Clone the repository
git clone https://github.com/<username>/neo-web-control-panel.git

# Navigate to the project
cd neo-web-control-panel

# Open in browser (no build step needed)
# Simply open index.html in your browser
# Or use a local server:
npx serve .
```

## How to Use

1. **Enter a URL** in the input field (e.g., `https://example.com`)
2. Click **Open** (or press Enter) to load the page in the viewer
3. Use **Stop** to abort loading
4. Click the **clock icon** to view history
5. Click any history item to reopen it
6. Use **paste** / **copy** buttons for clipboard operations
7. Toggle **dark/light mode** with the sun/moon button

## Tech Stack

| Layer    | Technology           |
| -------- | -------------------- |
| Markup   | Semantic HTML5       |
| Styling  | CSS3 (Custom Properties, Grid, Flexbox) |
| Logic    | Vanilla JavaScript (ES6+) |
| Fonts    | Inter, JetBrains Mono (Google Fonts) |
| Hosting  | GitHub Pages         |

## Project Structure

```
neo-web-control-panel/
├── index.html      # Main HTML structure
├── style.css       # All styles, themes, animations
├── script.js       # Application logic, particles, history
├── README.md       # This file
├── LICENSE         # MIT License
└── .gitignore      # Git ignore rules
```

## Browser Support

| Browser        | Status  |
| -------------- | ------- |
| Chrome 90+     | Full    |
| Firefox 88+    | Full    |
| Safari 14+     | Full    |
| Edge 90+       | Full    |
| Mobile Chrome  | Full    |
| Mobile Safari  | Full    |

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure your code follows the existing style and includes no external dependencies unless absolutely necessary.

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by futuristic UI/UX design patterns
- Built with modern CSS features (custom properties, backdrop-filter, container queries)
- Particle system based on canvas 2D API

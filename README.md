# HTB Academy Scraper

A modern, cross-platform desktop application for downloading HackTheBox Academy courses and sections with a beautiful GUI.

## 🚀 Features

- **Modern UI**: Built with React + TypeScript + Electron
- **Drag & Drop**: Easy cookie import from browser exports
- **Real-time Progress**: Live progress tracking with pause/resume
- **Multi-format Export**: Markdown, HTML, and plain text
- **Batch Processing**: Download multiple courses/sections
- **Dark/Light Theme**: Automatic theme switching
- **Cross-platform**: Windows, macOS, and Linux support
- **Rate Limiting**: Configurable request delays
- **Error Handling**: Robust error recovery and logging

## 📦 Installation

### Download Pre-built Binaries

1. Go to [Releases](https://github.com/Pyroxys/htb-academy-scraper/releases)
2. Download the appropriate version for your OS:
   - Windows: `HTB-Academy-Scraper-Setup-x.x.x.exe`
   - macOS: `HTB-Academy-Scraper-x.x.x.dmg`
   - Linux: `HTB-Academy-Scraper-x.x.x.AppImage`

### Build from Source

```bash
# Clone the repository
git clone https://github.com/Pyroxys/htb-academy-scraper.git
cd htb-academy-scraper

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Build for specific platform
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

## 🎯 Usage

### 1. Authentication Setup

**Option A: Cookie Import (Recommended)**
1. Login to HTB Academy in your browser
2. Export cookies using a browser extension like "Cookie-Editor"
3. Drag & drop the exported JSON file into the app
4. Or paste the cookie string directly

**Option B: Manual Cookie String**
1. Open Developer Tools (F12) on HTB Academy
2. Go to Application/Storage → Cookies
3. Copy the `htb_academy_session` and `XSRF-TOKEN` values
4. Format as: `htb_academy_session=...; XSRF-TOKEN=...`

### 2. Adding URLs

- **Single Section**: `https://academy.hackthebox.com/module/123/section/456`
- **Full Course**: `https://academy.hackthebox.com/course/123`
- **Batch Import**: Add multiple URLs, one per line

### 3. Configuration

- **Output Directory**: Choose where to save files
- **Rate Limit**: Delay between requests (recommended: 1-2 seconds)
- **Export Formats**: Select Markdown, HTML, or plain text
- **Include Images**: Download embedded images (if available)

### 4. Download Process

1. Click "Start" to begin downloading
2. Monitor real-time progress
3. Use "Pause/Resume" to control the process
4. Files are saved in the selected output directory

## 🛠️ Development

### Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI Library**: Mantine (modern React components)
- **Desktop**: Electron 28
- **State Management**: Zustand
- **HTTP Client**: Axios
- **HTML Parsing**: Cheerio
- **Markdown**: Turndown

### Project Structure

```
src/
├── main/           # Electron main process
│   ├── main.ts     # Main entry point
│   ├── preload.ts  # Preload script
│   └── services/   # Backend services
├── renderer/       # React frontend
│   ├── components/ # UI components
│   ├── store/      # State management
│   └── types/      # TypeScript types
└── shared/         # Shared utilities
```

### Available Scripts

```bash
npm run dev         # Start development server
npm run build       # Build for production
npm run lint        # Run ESLint
npm run format      # Format code with Prettier
npm run test        # Run tests
```

## 🔧 Configuration

### Custom Selectors

Create a `config.json` file to customize content extraction:

```json
{
  "selectors": {
    "content": [
      "div.module-content",
      "div.training-module",
      "article"
    ],
    "cleanup": [
      "#pwnboxSwitchWarningModal",
      ".footer",
      "canvas"
    ]
  }
}
```

### Environment Variables

```bash
# Development
NODE_ENV=development
VITE_DEV_SERVER_URL=http://localhost:5173

# Production
NODE_ENV=production
```

## 🚨 Important Notes

- **Rate Limiting**: Always use appropriate delays to avoid being blocked
- **Legal Use**: Only download content you have legitimate access to
- **Cookie Security**: Keep your authentication cookies secure
- **Terms of Service**: Ensure compliance with HTB Academy's terms

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Bug Reports

If you encounter any issues, please [create an issue](https://github.com/Pyroxys/htb-academy-scraper/issues) with:

- Operating system and version
- App version
- Steps to reproduce
- Error messages (if any)
- Screenshots (if relevant)

## 💡 Feature Requests

Have an idea for improvement? [Open an issue](https://github.com/Pyroxys/htb-academy-scraper/issues) with the "enhancement" label.

## 🙏 Acknowledgments

- [HackTheBox Academy](https://academy.hackthebox.com/) for providing excellent cybersecurity education
- [Electron](https://www.electronjs.org/) for cross-platform desktop apps
- [React](https://react.dev/) for the UI framework
- [Mantine](https://mantine.dev/) for beautiful components
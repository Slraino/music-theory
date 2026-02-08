# Fantasia Desktop

A desktop music theory education app with real-time chat, chord generators, and interactive learning tools.

## Features

- 🎹 **Chord Generator** - Interactive keyboard with Web Audio synthesis
- 🎵 **Chord Progressions** - Browse and learn common progressions
- 📚 **Music Theory** - Comprehensive theory lessons
- 💬 **Real-time Chat** - Connect with other music learners (WebSocket)
- 👤 **User Profiles** - Customizable avatars and progress tracking
- ⏱️ **Pomodoro Timer** - Built-in practice timer

## Download

Get the latest version from [Releases](https://github.com/YOUR-USERNAME/fantasia-desktop/releases)

**For Windows:** Download `Fantasia Setup.exe` and run the installer.

## Development

### Prerequisites
- Node.js 16+
- npm

### Setup
```bash
npm install
```

### Run in Development
```bash
npm run electron-dev
```

This starts the Node server and opens the Electron window.

### Build Installer
```bash
npm run electron-build
```

Outputs to `dist/` folder.

## Tech Stack

- **Frontend:** Vanilla JavaScript, HTML5, CSS3
- **Desktop:** Electron 27
- **Backend:** Express.js, WebSocket (ws)
- **Audio:** Web Audio API
- **Auth:** Firebase Authentication
- **Database:** Firestore

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed technical documentation.

## License

MIT

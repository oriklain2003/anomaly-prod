# ONYX Intelligence Operations Dashboard

A tactical intelligence dashboard built with React, TypeScript, and MapLibre.

## Features

- **Operations Control Panel** - History/Live feed toggle with real-time data stream
- **Interactive Map** - MapLibre-powered map with tactical overlays and aircraft markers
- **Tactical Chat** - AI-assisted chat interface with alert cards and recommendations

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
src/
├── components/
│   ├── Layout.tsx           # Main 3-column layout
│   ├── Header.tsx           # Top navigation bar
│   ├── OperationsSidebar.tsx # Left panel with controls
│   ├── DataStreamTable.tsx  # Event log table
│   ├── MapArea.tsx          # Map container with overlays
│   ├── MapComponent.tsx     # MapLibre map instance
│   ├── MapControls.tsx      # Layers/Filters controls
│   ├── TacticalChat.tsx     # Right chat panel
│   ├── ChatMessage.tsx      # Message bubble variants
│   └── AlertCard.tsx        # High priority alert card
├── hooks/
│   └── useDataStream.ts     # Real-time data hook
├── api.ts                   # Backend API client
├── types.ts                 # TypeScript interfaces
├── theme.ts                 # Theme configuration
├── index.css                # Tailwind + custom styles
├── App.tsx                  # Main app component
└── main.tsx                 # Entry point
```

## API Integration

The app connects to the FastAPI backend at `/api`. Configure the API URL via the `VITE_API_URL` environment variable:

```bash
VITE_API_URL=http://localhost:8000 npm run dev
```

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **MapLibre GL** - Map rendering
- **Lucide React** - Icons

## Design

Based on the ONYX Intelligence Operations Dashboard design featuring:
- Dark tactical theme
- JetBrains Mono / Inter fonts
- Blue/Red status indicators
- Scan line animations
- Tactical corner brackets

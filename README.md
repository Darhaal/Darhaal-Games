# Darhaal Game Dashboard

Interactive game dashboard with Supabase authentication and multi-language support.

## Description

Darhaal Game Dashboard is a modern web application built with Next.js and React.  
It allows users to log in, manage their profile, choose a language (English or Russian), and navigate a main menu with game-related actions.  
The dashboard features smooth animations, responsive design, and a clean user interface.

### Features

- User authentication via Supabase (email and anonymous)
- Profile management: username and avatar
- Language selection: English / Russian
- Main menu actions:
  - Play: Find a game
  - Create: Start a new room
  - Achievements: Track progress
  - Settings: Profile and app options
- Smooth animations and hover effects
- Responsive layout for mobile and desktop

### Tech Stack

- Next.js 13+ (App Router, client components)
- React (useState, useEffect)
- Supabase Auth
- Tailwind CSS
- Lucide React Icons

### Folder Structure

- `/components` — AuthForm, Settings
- `/lib` — Supabase client
- `/app/page.tsx` — main dashboard with menu

### Getting Started

1. Clone the repository:
   ```bash
   git clone <your-repo-url>

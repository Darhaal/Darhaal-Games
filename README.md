# Darhaal Games

Darhaal Games is a modern web platform for multiplayer board games in the browser.  
It combines an old-school board game feel with a reactive modern interface.

Currently, the popular bluffing game **Coup** is implemented.

---

## 🚀 Key Features

- **Real-time Multiplayer**: Instant game state synchronization powered by Supabase Realtime.
- **Account System**:
    - Login via Email/Password
    - Login via Google OAuth
    - Guest mode (anonymous)
- **Lobby System**:
    - Public and private rooms (password-protected)
    - Unique invitation codes
- **Profile Settings**:
    - Change avatar (DiceBear or custom upload)
    - Change language (RU/EN)
    - Sound control (Work In Progress)
- **Responsive Design**: Supports mobile, tablet, and desktop

---

## 🎮 Games

### Coup
- **Goal**: Be the last player standing
- **Roles**: Duke, Assassin, Captain, Ambassador, Contessa
- **Mechanics**: Income, Foreign Aid, Tax, Steal, Assassinate, Exchange, Coup
- **Implementation Features**:
    - 30-second turn timer with auto-skip
    - Interactive 3D role cards
    - Action log
    - Opponent state visualization (coins, cards)

---

## 🛠 Tech Stack

- **Frontend**: Next.js 14 (App Router), React
- **Styling**: Tailwind CSS, Lucide React
- **Backend / Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage (avatars)
- **Realtime**: Supabase Realtime

---

## ⚡ Installation & Setup

```bash
git clone https://github.com/your-username/darhaal-games.git
cd darhaal-games
npm install
```
## 🤝 Contributing

If you'd like to contribute, please create a Pull Request or open an Issue with suggestions or bug reports.

---

© 2026 Darhaal Games
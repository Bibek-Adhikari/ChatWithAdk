**ChatWithAdk** is a modern, real-time, full-stack chat application designed to empower seamless communication—tailored for the Nepali community and beyond. Combining robust authentication, intuitive UI/UX, and scalable backend technologies, it enables one-on-one and group conversations in a secure, responsive environment.

---

## 🌟 Features

- **Instant Messaging:**  
  Real-time one-on-one and group chats, with instant updates powered by efficient websockets.

- **User Authentication & Security:**  
  Secure login and registration with encryption; supports session management to safeguard user data.

- **Rich Message Support:**  
  Exchange text, emojis, images, and attachments; chat history is persistently stored for reliability.

- **User Presence Indicator:**  
  See who's online, typing, or away in real time.

- **Responsive & Mobile-First UI:**  
  Sleek interface built with modern frameworks, ensuring a smooth experience on desktop and mobile devices.

- **Profile Management:**  
  Upload avatars, edit personal info, and personalize your chat experience.

### 🖼️ On-device Photo studio

- **Remove BG runs on the device** — the image never leaves the browser and no cloud credits are spent.
- **Auto / Fast / High quality** engines:
  - *Fast* uses MediaPipe Selfie Segmenter (best for people and portraits, ~14 MB engine files cached once).
  - *High quality* uses `@imgly/background-removal` (any subject, ~40 MB model cached once).
  - *Auto* starts fast and escalates to high quality when the subject is unclear.
- **Cloud fallback** — if the local model fails, a “Retry with cloud” button uses the existing Picsart flow. The other studio tools (upscale, retouch, AI background, replace, crop) remain cloud-based.
- **Fully offline option** — run `npm run ondevice:assets`, then set `VITE_ONDEVICE_WASM_URL`, `VITE_ONDEVICE_SEGMENTER_URL` and `VITE_ONDEVICE_IMGLY_PATH` to serve the WASM/model files from `public/ondevice/` instead of public CDNs.

---

## 🛠️ Technology Stack

| Category | Technology |
|----------|-----------|
| **Frontend** | React.js, TypeScript, Tailwind CSS/Material-UI |
| **Backend** | Node.js, Express.js |
| **Real-Time Engine** | Socket.IO for live chat updates |
| **Database** | Firebase Firestore (NoSQL) |
| **Authentication** | Firebase Authentication |
| **Build Tool** | Vite |
| **Deployment** | Vercel |

---

## 📊 Language Composition

- **TypeScript**: 94.3%
- **JavaScript**: 3.7%
- **HTML**: 1.4%
- **Other**: 0.6%

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn package manager
- Firebase account (for Firestore & Authentication)

### 1. Clone the Repository

```bash
git clone https://github.com/Bibek-Adhikari/ChatWithAdk.git
cd ChatWithAdh
```
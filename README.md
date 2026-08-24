# D&D HOMEINVEST s.r.o. - Next.js Web

Moderní webové stránky pro rodinnou firmu D&D HOMEINVEST specializující se na rekonstrukce bytů a domů v jižních Čechách.

## Technologie

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Jazyk**: TypeScript
- **Deployment**: Cloudflare Pages (statický export)
- **API**: Cloudflare Functions (D1 Database, R2 Storage)

## Struktura projektu

```
/
├── app/                    # Next.js App Router
│   ├── api/               # API routes (for development)
│   ├── admin/             # Admin section
│   │   └── login/         # Admin login page
│   ├── builder/           # Builder panel
│   ├── obchodni-podminky/ # Business terms
│   ├── pravni-informace/  # Legal information
│   ├── 404/              # 404 page
│   ├── globals.css       # Global styles
│   ├── layout.tsx        # Root layout
│   ├── not-found.tsx    # Not found page
│   └── page.tsx          # Main page
├── public/               # Static assets
│   ├── images/           # Team images
│   ├── gallery/          # Project images
│   └── ...               # Favicons, manifest, etc.
├── src/                  # Cloudflare Functions
│   ├── admin-api.js      # Admin API (login, content, etc.)
│   └── default-content.js # Default content
├── functions/            # Cloudflare Pages Functions
│   └── _middleware.js    # Middleware for API routes
├── migrations/           # Database migrations
├── tests/                # Tests
├── next.config.js        # Next.js configuration
├── tailwind.config.js    # Tailwind configuration
├── tsconfig.json        # TypeScript configuration
├── postcss.config.js     # PostCSS configuration
└── package.json          # Dependencies
```

## Instalace

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```

## Environment Variables

For development:

```bash
ADMIN_PASSWORD=your_admin_password
```

## Vlastnosti

### Moderní standardy
- ✅ Semantic HTML5
- ✅ Accessibility (ARIA, keyboard navigation)
- ✅ Responsive design (mobile-first)
- ✅ Performance optimized animations
- ✅ Reduced motion support
- ✅ High refresh rate monitor support
- ✅ CSS variables for theming
- ✅ Proper error handling

### Animace optimalizované pro výkon
- ✅ Intersection Observer for scroll animations
- ✅ `will-change` for elements that will be animated
- ✅ Reduced motion support via `prefers-reduced-motion`
- ✅ Hardware-accelerated transforms
- ✅ Efficient CSS transitions
- ✅ No jank on high Hz monitors (60Hz, 120Hz, 144Hz+)

### Admin Login
- ✅ Clean URL: `/admin/login` (not `/admin/login/index.html`)
- ✅ Password-only authentication (username is hidden)
- ✅ Secure token-based sessions
- ✅ Error handling
- ✅ Loading states

### Cloudflare Integration
- ✅ Static export for Cloudflare Pages
- ✅ Cloudflare Functions for API routes
- ✅ D1 Database for data storage
- ✅ R2 Storage for media files
- ✅ Service Worker support

## Deployment

The project is configured for deployment on Cloudflare Pages with static export. The middleware in `functions/_middleware.js` handles dynamic API routes using Cloudflare Functions.

### Deployment Steps

1. Push changes to the `main` branch
2. Cloudflare Pages will automatically build and deploy
3. The static files will be served directly
4. API routes will be handled by Cloudflare Functions

## API Routes

### Development
- `POST /api/login` - Local development login (uses ADMIN_PASSWORD env var)

### Production (Cloudflare Functions)
- `POST /api/login` - Login with password (username is optional)
- `POST /api/logout` - Logout
- `GET /api/content` - Get website content
- `PUT /api/content` - Update website content
- `GET /api/theme` - Get theme settings
- `PUT /api/theme` - Update theme settings
- `POST /api/upload` - Upload media files
- `GET /api/contact-messages` - Get contact form messages
- `POST /api/contact` - Submit contact form

## Security

- ✅ CSRF protection via tokens
- ✅ Secure cookies (HttpOnly, Secure, SameSite=Strict)
- ✅ Password hashing (PBKDF2)
- ✅ Session expiration
- ✅ Input validation

## License

Private - All rights reserved by D&D HOMEINVEST s.r.o.

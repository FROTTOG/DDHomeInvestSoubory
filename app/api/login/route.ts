import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const password = body.password;
    
    // In development, we'll use a simple check
    // In production, this will be handled by Cloudflare Functions
    if (process.env.NODE_ENV === 'development') {
      // For development purposes only
      const devPassword = process.env.ADMIN_PASSWORD || 'admin123';
      
      if (password === devPassword) {
        // Generate a simple token for development
        const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
        return NextResponse.json({ ok: true, token });
      } else {
        return NextResponse.json({ error: 'Neplatné heslo.' }, { status: 401 });
      }
    }
    
    // For production, return an error since static export doesn't support API routes
    return NextResponse.json(
      { error: 'API routes are not supported in static export. Use Cloudflare Functions in production.' },
      { status: 500 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Chyba serveru.' },
      { status: 500 }
    );
  }
}

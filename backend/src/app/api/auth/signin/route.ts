import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    // Mock Authentication Logic
    if (email === "juan.delacruz@email.com" && password === "password123") {
      // In a real app, generate JWT and set cookies
      return NextResponse.json({ 
        status: 'success', 
        user: { id: 'user_1', name: 'Juan Dela Cruz', email },
        requires2FA: true // Trigger 2FA flow
      });
    }

    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

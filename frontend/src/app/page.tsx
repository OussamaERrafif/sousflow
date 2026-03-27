import { redirect } from 'next/navigation';

// Fallback: middleware should handle this redirect, but if it doesn't, redirect here.
export default function RootPage() {
  redirect('/ar');
}

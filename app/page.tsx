import { redirect } from 'next/navigation';

export default function Home() {
  // Sa ap fòse navigatè a ale sou paj login lan otomatikman
  redirect('/login');
}
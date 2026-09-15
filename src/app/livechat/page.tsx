import { redirect } from 'next/navigation';

export default function LivechatRedirectPage() {
  redirect('/dashboard/chats');
}


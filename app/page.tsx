import { requireChatGPTUser } from './chatgpt-auth';
import Planner from './planner';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const user = await requireChatGPTUser('/');
  return <Planner name={user.fullName?.split(' ')[0] || user.email.split('@')[0]} />;
}

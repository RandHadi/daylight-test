import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { planners } from '@/db/schema';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { stateSchema } from '@/lib/state-schema';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){
 const user=await getChatGPTUser();if(!user)return reply({error:'Please sign in to load your planner.'},401);
 try{const [row]=await getDb().select().from(planners).where(eq(planners.userId,user.userId)).limit(1);return reply({state:row?JSON.parse(row.payload):null,revision:row?.revision||0});}catch{return reply({error:'Your planner could not be loaded. Please try again.'},503);}
}
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return reply({error:'Please sign in to save your planner.'},401);
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Invalid request origin.'},403);
 try{
  const raw=await request.text();if(raw.length>2000000)return reply({error:'Planner exceeds the 2 MB limit. Export and archive older records.'},413);
  const body=JSON.parse(raw);const parsed=stateSchema.safeParse(body.state);
  if(!parsed.success||!Number.isSafeInteger(body.revision)||body.revision<0)return reply({error:'This planner contains invalid fields. Check dates, task durations, and work hours.'},400);
  const db=getDb(),payload=JSON.stringify(parsed.data),now=Date.now();
  if(body.revision===0){const rows=await db.insert(planners).values({userId:user.userId,payload,revision:1,updatedAt:now}).onConflictDoNothing().returning({revision:planners.revision});if(rows.length)return reply({revision:1});}
  else{const rows=await db.update(planners).set({payload,revision:body.revision+1,updatedAt:now}).where(and(eq(planners.userId,user.userId),eq(planners.revision,body.revision))).returning({revision:planners.revision});if(rows.length)return reply({revision:rows[0].revision});}
  return reply({error:'Your planner changed in another tab. Export your pending changes before reloading.'},409);
 }catch{return reply({error:'Changes have not synced. Your draft remains here; try saving again.'},503);}
}

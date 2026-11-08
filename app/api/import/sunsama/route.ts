import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { planners, plannerImports } from '@/db/schema';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { stateSchema } from '@/lib/state-schema';
import { initialState, type State } from '@/lib/planner-model';
import { mergeSunsama } from '@/lib/sunsama-import';
import {repairSunsamaImport} from '@/lib/sunsama-repair';
export const dynamic='force-dynamic';
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});

export async function GET(request:Request){
    const user=await getChatGPTUser();if(!user)return reply({error:'Please sign in.'},401);
    const url=new URL(request.url),db=getDb(),id=url.searchParams.get('id');
    if(!id){const rows=await db.select({id:plannerImports.id,createdAt:plannerImports.createdAt,report:plannerImports.report}).from(plannerImports).where(eq(plannerImports.userId,user.userId)).orderBy(desc(plannerImports.createdAt)).limit(20);return reply({imports:rows.map(r=>({...r,report:JSON.parse(r.report)}))});}
    const [row]=await db.select().from(plannerImports).where(and(eq(plannerImports.id,id),eq(plannerImports.userId,user.userId))).limit(1);
    if(!row)return reply({error:'Backup not found.'},404);
    const part=url.searchParams.get('part');const value=part==='source'?row.source:part==='draft'?row.draft:part==='before'?row.before:null;
    if(value===null)return reply({error:'Choose a backup.'},400);
    return new Response(value,{headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Content-Disposition':`attachment; filename="daylight-${part}-${row.createdAt}.json"`}});
}

export async function POST(request:Request){
    const user=await getChatGPTUser();if(!user)return reply({error:'Please sign in to import.'},401);
    if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Invalid request origin.'},403);
    try{
        const raw=await request.text();if(raw.length>4000000)return reply({error:'Choose an import smaller than 4 MB.'},413);
        const body=JSON.parse(raw),draft=stateSchema.safeParse(body.draft);
        if(!draft.success)return reply({error:'Your current draft could not be backed up. Nothing was imported.'},400);
        const db=getDb(),[current]=await db.select().from(planners).where(eq(planners.userId,user.userId)).limit(1);
        const before=current?stateSchema.parse(JSON.parse(current.payload)) as State:initialState(new Date().toISOString().slice(0,10));
        const repair=body.action==='repair'||body.action==='preview-repair';
        let source=body.source;
        if(repair){
            const [backup]=await db.select({source:plannerImports.source}).from(plannerImports).where(eq(plannerImports.userId,user.userId)).orderBy(desc(plannerImports.createdAt)).limit(1);
            if(!backup)return reply({error:'No original Sunsama import backup is available. Choose the original export first.'},400);
            source=JSON.parse(backup.source);
            if(body.action==='repair'&&body.revision!==current?.revision)return reply({error:'Daylight changed after the preview. Preview repairs again before applying them.'},409);
        }
        const repaired=repair?repairSunsamaImport(before,source):null;
        if(body.action==='preview-repair')return reply({repairReport:repaired!.report,revision:current?.revision||0});
        const result=repaired?{state:repaired.state,repairReport:repaired.report,report:{tasks:0,completed:0,backlog:0,channels:0,subtasks:0,sessions:0,timeboxes:0,skipped:0,recurrenceNotes:repaired.report.repeats,dateMarkers:0,warnings:[]}}:mergeSunsama(before,source);
        if(body.preview===true)return reply({report:result.report});
        const id=crypto.randomUUID(),now=Date.now(),revision=(current?.revision||0)+1;
        const write=current?db.update(planners).set({payload:JSON.stringify(result.state),revision,updatedAt:now}).where(and(eq(planners.userId,user.userId),eq(planners.revision,current.revision))).returning({revision:planners.revision}):db.insert(planners).values({userId:user.userId,payload:JSON.stringify(result.state),revision,updatedAt:now}).onConflictDoNothing().returning({revision:planners.revision});
        const [_,saved]=await db.batch([
            db.insert(plannerImports).values({id,userId:user.userId,source:JSON.stringify(source),before:JSON.stringify(before),draft:JSON.stringify(draft.data),report:JSON.stringify(repaired?.report||result.report),createdAt:now}),write,
        ]);
        if(!saved.length)return reply({error:'Daylight changed in another tab. Your backups are safe; preview and import again to merge with the latest version.'},409);
        return reply({...result,revision,backupId:id});
    }catch(e){return reply({error:e instanceof Error&&/No records were changed|export|storage limit/i.test(e.message)?e.message:'Import did not finish. Your existing planner has not been replaced. Try again.'},400);}
}

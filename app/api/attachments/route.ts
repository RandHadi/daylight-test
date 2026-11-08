import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
const limit=10*1024*1024;
export async function POST(request:Request){
    const user=await getChatGPTUser();if(!user)return reply({error:'Please sign in.'},401);
    if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Invalid request origin.'},403);
    if(!env.BUCKET)return reply({error:'File storage is unavailable. Please try again later.'},503);
    if(Number(request.headers.get('content-length')||0)>limit+65536)return reply({error:'Choose a file no larger than 10 MB.'},413);
    try{
        const form=await request.formData(),file=form.get('file');
        if(!(file instanceof File)||!file.size||file.size>limit)return reply({error:'Choose a nonempty file no larger than 10 MB.'},400);
        const id=crypto.randomUUID(),name=file.name.replace(/[\r\n\u0000]/g,'').slice(0,200)||'attachment';
        await env.BUCKET.put(`attachments/${encodeURIComponent(user.userId)}/${id}`,file.stream(),{customMetadata:{name},httpMetadata:{contentType:file.type||'application/octet-stream'}});
        return reply({id,name,size:file.size,type:file.type||'application/octet-stream'});
    }catch{return reply({error:'The attachment could not be uploaded. Try again.'},503);}
}
export async function GET(request:Request){
    const user=await getChatGPTUser();if(!user)return reply({error:'Please sign in.'},401);
    const id=new URL(request.url).searchParams.get('id')||'';
    if(!/^[0-9a-f-]{36}$/.test(id))return reply({error:'Invalid attachment.'},400);
    if(!env.BUCKET)return reply({error:'File storage is unavailable.'},503);
    const object=await env.BUCKET.get(`attachments/${encodeURIComponent(user.userId)}/${id}`);
    if(!object)return reply({error:'Attachment not found.'},404);
    return new Response(object.body,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(object.customMetadata?.name||'attachment')}`,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'}});
}

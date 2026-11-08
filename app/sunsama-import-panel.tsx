'use client';
import { useEffect, useRef, useState } from 'react';
import type { State } from '@/lib/planner-model';
import type { ImportReport } from '@/lib/sunsama-import';
export type ImportResult={repairReport?:import('@/lib/sunsama-repair').RepairReport;state:State;revision:number;backupId:string;report:ImportReport};
export function SunsamaImportPanel({draft,hasConflict,onImport}:{draft:State;hasConflict:boolean;onImport:(source:unknown)=>Promise<ImportResult>}){
    const [text,setText]=useState(''),[report,setReport]=useState<ImportReport|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[success,setSuccess]=useState(false);
    const [backups,setBackups]=useState<{id:string;createdAt:number}[]>([]),file=useRef<HTMLInputElement>(null);
    const loadBackups=()=>fetch('/api/import/sunsama',{cache:'no-store'}).then(r=>r.json()).then(r=>setBackups((r as {imports?:{id:string;createdAt:number}[]}).imports||[])).catch(()=>{});
    useEffect(()=>{void loadBackups();},[]);
    function edit(value:string){setText(value);setReport(null);setSuccess(false);setError('');}
    async function preview(){setBusy(true);setError('');try{const source=JSON.parse(text);const response=await fetch('/api/import/sunsama',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source,draft,preview:true})});const body=await response.json() as {report:ImportReport;error?:string};if(!response.ok)throw new Error(body.error);setReport(body.report);}catch(e){setReport(null);setError(e instanceof SyntaxError?'Choose or paste a Sunsama JSON export.':e instanceof Error?e.message:'Could not preview the export.');}finally{setBusy(false);}}
    async function commit(){setBusy(true);setError('');try{const result=await onImport(JSON.parse(text));setReport(result.report);setSuccess(true);setText('');await loadBackups();}catch(e){setError(e instanceof Error?e.message:'Import did not finish.');}finally{setBusy(false);}}
    return <section className="sunsama-import"><h3 className="settings-heading">Import from Sunsama</h3>
      <p className="muted">Import a JSON export from Sunsama’s Account Management settings. Existing Daylight tasks stay in place, and previously imported task IDs are skipped.</p>
      {hasConflict&&<p className="warning">Your local draft differs from the cloud. Importing uses the latest cloud version and saves this draft as a separate, downloadable backup.</p>}
      <input ref={file} hidden type="file" accept=".json,application/json" onChange={async e=>{const selected=e.target.files?.[0];e.target.value='';if(!selected)return;if(selected.size>2000000){setError('Choose a JSON export smaller than 2 MB.');return;}edit(await selected.text());}}/>
      <button className="secondary" disabled={busy} onClick={()=>file.current?.click()}>Choose Sunsama JSON</button>
      <details className="paste-calendar"><summary>Or paste export JSON</summary><label className="field">Sunsama export JSON<textarea aria-label="Sunsama export JSON" rows={5} value={text} maxLength={2000000} onChange={e=>edit(e.target.value)}/></label></details>
      <button className="secondary" disabled={busy||!text.trim()} onClick={()=>void preview()}>{busy?'Working…':'Preview Sunsama import'}</button>
      {error&&<p role="alert" className="warning">{error}</p>}
      {report&&<div className="import-summary" role="status"><strong>{success?'Imported and saved':'Ready to import'}: {report.tasks} tasks</strong><p>{report.completed} completed · {report.backlog} backlog · {report.subtasks} subtasks · {report.sessions} time entries · {report.timeboxes} timeboxes · {report.channels} new channels</p>{report.skipped>0&&<p>{report.skipped} previously imported tasks skipped.</p>}{report.warnings.map(w=><p key={w} className="muted">{w}</p>)}{!success&&<><p className="muted">The original export, current cloud planner, and your current draft are backed up before importing.</p><button className="primary" disabled={busy} onClick={()=>void commit()}>Import {report.tasks} tasks into Daylight</button></>}</div>}
      {backups.length>0&&<details className="paste-calendar" open={success}><summary>Import backups</summary>{backups.map(b=><div className="import-backup" key={b.id}><small>{new Date(b.createdAt).toLocaleString()}</small><div className="data-actions"><a href={`/api/import/sunsama?id=${encodeURIComponent(b.id)}&part=before`}>Cloud planner before import</a><a href={`/api/import/sunsama?id=${encodeURIComponent(b.id)}&part=draft`}>Preserved local draft</a><a href={`/api/import/sunsama?id=${encodeURIComponent(b.id)}&part=source`}>Original import data</a></div></div>)}</details>}
    </section>;
}

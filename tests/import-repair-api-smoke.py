"""Local-only import repair regression; leaves synthetic fixtures for browser QA.
Run with --cleanup afterward to move fixture tasks to recoverable trash.
"""
import copy, datetime, http.cookiejar, json, sys, urllib.error, urllib.request
base='http://127.0.0.1:5173'
client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
client.open(base+'/signin-with-chatgpt?return_to=/')
def req(path,body=None):
    r=urllib.request.Request(base+path,data=None if body is None else json.dumps(body).encode(),headers={'Content-Type':'application/json','Origin':base})
    try:
        with client.open(r) as response:return response.status,json.load(response)
    except urllib.error.HTTPError as error:return error.code,json.load(error)
_,original=req('/api/planner');assert original['state'],'Initialize the local planner first.'
if '--cleanup' in sys.argv:
    s=original['state'];ids={t['id'] for t in s['tasks'] if t['id'].startswith('sunsama:repair-qa-') or t.get('generatedFrom','').startswith('sunsama:repair-qa-')}
    for t in s['tasks']:
        if t['id'] in ids:t['deleted']='2026-11-08T00:00:00.000Z'
    for series in s.get('series',[]):
        if series['template']['id'] in ids:series['stopped']=True
    s['blocks']=[b for b in s['blocks'] if b.get('taskId') not in ids and not b['id'].startswith('google:repair-qa-')]
    status,_=req('/api/planner',original);assert status==200
    print('Synthetic browser fixtures moved to trash.');sys.exit()
day=datetime.date.today().isoformat()
meeting={'id':'repair-qa-meeting','text':'QA imported meeting','startDate':day,'timeEstimate':20,'channel':'Personal','context':'Personal','scheduledTime':[{'startDate':day+'T18:30:00-08:00','endDate':day+'T21:30:00-08:00','autoImported':True,'calendarId':'qa@example.test'}]}
rows=[meeting,{'id':'repair-qa-repeat1','text':'QA recurring reading','startDate':day,'timeEstimate':30,'channel':'Personal','context':'Personal','sequenceRule':'repeats every day'}, {'id':'repair-qa-repeat2','text':'QA recurring reading','startDate':(datetime.date.today()+datetime.timedelta(days=2)).isoformat(),'timeEstimate':30,'channel':'Personal','context':'Personal','sequenceRule':'repeats every day'}]
source={'format':'daylight-sunsama-export','version':1,'timezone':'America/Los_Angeles','tasks':rows}
status,imported=req('/api/import/sunsama',{'source':source,'draft':original['state']});assert status==200,(status,imported)
_,cloud=req('/api/planner');s=cloud['state'];t=next(t for t in s['tasks'] if t['id']=='sunsama:repair-qa-meeting');t['minutes']=20;t.pop('sunsamaImport',None);t.pop('calendarLink',None);t.pop('activity',None);t.pop('deleted',None)
s['blocks']=[b for b in s['blocks'] if b['id']!='google:repair-qa-event']
s['blocks'].append({'id':'google:repair-qa-event','provider':'google','externalEventId':'qa-event','externalCalendarId':'qa@example.test','title':'QA imported meeting','date':day,'start':1170,'minutes':180,'color':'#779bc1','busy':True})
status,_=req('/api/planner',cloud);assert status==200
_,before=req('/api/planner');status,preview=req('/api/import/sunsama',{'action':'preview-repair','draft':before['state']});assert status==200
assert preview['repairReport']['estimates']==[{'taskId':'sunsama:repair-qa-meeting','title':'QA imported meeting','before':20,'after':180}]
_,unchanged=req('/api/planner');assert unchanged==before
status,result=req('/api/import/sunsama',{'action':'repair','draft':before['state'],'revision':preview['revision']});assert status==200,(status,result)
assert next(t for t in result['state']['tasks'] if t['id']=='sunsama:repair-qa-meeting')['minutes']==180
assert result['repairReport']['linked']==[]
status,backup=req('/api/import/sunsama?id='+result['backupId']+'&part=before');assert status==200 and backup==before['state']
status,_=req('/api/import/sunsama',{'action':'repair','draft':before['state'],'revision':preview['revision']});assert status==409
_,latest=req('/api/planner');status,again=req('/api/import/sunsama',{'action':'preview-repair','draft':latest['state']});assert status==200 and not again['repairReport']['estimates']
print('PASS: preview read-only, repair persisted, pre-repair backup exact, stale revision rejected, second preview idempotent. Synthetic fixtures ready for browser QA.')

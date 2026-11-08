"""Regression checks against the LOCAL development account only (never production)."""
import copy, http.cookiejar, json, urllib.error, urllib.request

base = 'http://127.0.0.1:5173'
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
client.open(base + '/signin-with-chatgpt?return_to=/')
def req(body=None):
    request = urllib.request.Request(base + '/api/planner', data=None if body is None else json.dumps(body).encode(), headers={'Content-Type':'application/json','Origin':base})
    try:
        response=client.open(request);return response.status,json.load(response)
    except urllib.error.HTTPError as error:
        return error.code,json.load(error)

status, original = req();assert status == 200 and original['state']
fixture = copy.deepcopy(original['state'])
identifier = 'sync-regression-local-only'
fixture['tasks'] = [t for t in fixture['tasks'] if t['id'] != identifier]
record = copy.deepcopy(fixture['tasks'][0])
record.update(id=identifier,title='Local sync regression fixture',sample=False,done=False,archived=False)
record.pop('deleted',None)
fixture['tasks'].append(record)
status, result = req({'state':fixture,'revision':original['revision']});assert status==200,(status,result)
try:
    stale=copy.deepcopy(fixture);stale['tasks']=[t for t in stale['tasks'] if t['id']!=identifier]
    status,_=req({'state':stale,'revision':result['revision']});assert status==409,status
    _,saved=req();assert saved['revision']==result['revision'] and any(t['id']==identifier for t in saved['state']['tasks'])
    print('Matching-revision stale client cannot erase a saved task: PASS')
    edited=copy.deepcopy(saved['state']);edited['tasks'][-1]['title']='Verified normal save'
    status,result=req({'state':edited,'revision':saved['revision']});assert status==200,(status,result)
    status,_=req({'state':edited,'revision':saved['revision']});assert status==409,status
    print('Normal edit succeeds and stale concurrent save is rejected: PASS')
finally:
    _,latest=req()
    # Fixture cleanup uses the same recoverable trash operation as the app.
    for task in latest['state']['tasks']:
        if task['id']==identifier:task['deleted']='2026-11-08T00:00:00.000Z'
    status,result=req(latest);assert status==200,(status,result)
    print('Local fixture moved to recoverable trash: PASS')

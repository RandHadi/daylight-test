"""Read-only/invalid-write checks against the local Sites development identity."""
import urllib.request, urllib.error, http.cookiejar, json
base='http://127.0.0.1:5173'
client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def req(path,body=None,origin=None,auth=True):
    headers={'Content-Type':'application/json'}
    if origin: headers['Origin']=origin
    request=urllib.request.Request(base+path,data=json.dumps(body).encode() if body is not None else None,headers=headers)
    try:
        r=(client.open if auth else urllib.request.urlopen)(request);return r.status,json.load(r)
    except urllib.error.HTTPError as e:
        raw=e.read()
        try: body=json.loads(raw)
        except json.JSONDecodeError: body={}
        return e.code,body
def check(label,actual,expected):
    assert actual==expected,(label,actual,expected)
    print(label+': PASS')
check('Unauthenticated planner read',req('/api/planner',auth=False)[0],401)
client.open(base+'/signin-with-chatgpt?return_to=/')
status,current=req('/api/planner');check('Authenticated planner read',status,200)
check('Cross-origin planner write',req('/api/planner',{'state':current['state'],'revision':current['revision']},'https://invalid.example')[0],403)
check('Invalid planner write',req('/api/planner',{'state':{},'revision':current['revision']},base)[0],400)
check('Stale revision',req('/api/planner',{'state':current['state'],'revision':max(0,current['revision']-1)},base)[0],409)
check('Unauthenticated assistant read',req('/api/assistant',auth=False)[0],401)
check('Cross-origin assistant call',req('/api/assistant',{'prompt':'QA'},'https://invalid.example')[0],403)
check('Configured assistant',req('/api/assistant')[1].get('available'),True)

check('Unauthenticated Google status',req('/api/google-calendar',auth=False)[0],401)
check('Unauthenticated Google connect',req('/api/google-calendar/connect',{'mode':'read'},base,False)[0],401)
check('Cross-origin Google sync',req('/api/google-calendar',{'action':'sync'},'https://invalid.example')[0],403)
check('Cross-origin Google authorization',req('/api/google-calendar/connect',{'mode':'read'},'https://invalid.example')[0],403)
check('Invalid Google action',req('/api/google-calendar',{'action':'unknown'},base)[0],400)
check('Oversized Google window',req('/api/google-calendar',{'action':'sync','from':'2026-01-01','to':'2027-01-01','timezone':'UTC'},base)[0],400)
check('Invalid Google authorization mode',req('/api/google-calendar/connect',{'mode':'admin'},base)[0],400)
status,connection=req('/api/google-calendar');check('Google status endpoint',status,200)
assert not any(key in connection for key in ['accessToken','refreshToken','encryptedTokens','clientSecret'])
print('No Google credentials in status: PASS')

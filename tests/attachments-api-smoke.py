"""Local-only attachment checks; the small QA object remains in local R2."""
import urllib.request,urllib.error,http.cookiejar,json
base='http://127.0.0.1:5173'
client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
client.open(base+'/signin-with-chatgpt?return_to=/')
def call(path,body=None,auth=True,origin=base,content='application/json'):
    request=urllib.request.Request(base+path,data=body,headers={'Origin':origin,'Content-Type':content})
    try:
        r=(client.open if auth else urllib.request.urlopen)(request);return r.status,r.read(),r.headers
    except urllib.error.HTTPError as e:return e.code,e.read(),e.headers
assert call('/api/attachments?id=bad',auth=False)[0]==401
assert call('/api/attachments',b'',origin='https://invalid.example')[0]==403
assert call('/api/attachments?id=bad')[0]==400
boundary='daylight-attachment-test-boundary';content=b'Daylight attachment verification.\n'
body=('--'+boundary+'\r\nContent-Disposition: form-data; name="file"; filename="verification.txt"\r\nContent-Type: text/plain\r\n\r\n').encode()+content+('\r\n--'+boundary+'--\r\n').encode()
status,response,_=call('/api/attachments',body,content='multipart/form-data; boundary='+boundary)
assert status==200,(status,response)
file=json.loads(response);assert file['size']==len(content)
status,downloaded,headers=call('/api/attachments?id='+file['id']);assert status==200 and downloaded==content
assert headers['Content-Disposition'].startswith('attachment;') and headers['X-Content-Type-Options']=='nosniff'
assert call('/api/attachments?id='+file['id'],auth=False)[0]==401
assert call('/api/attachments?id=00000000-0000-4000-8000-000000000000')[0]==404
print('Attachment upload, byte-for-byte download, private authentication, origin, identifier and safe download headers: PASS')

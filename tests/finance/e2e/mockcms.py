import json, http.server, urllib.parse
USERS = {
 'tok_owner_123': {'role':'owner','uid':'','code':'owner','name':'Pae Owner','perms':['dash']},
 'tok_acc_12345': {'role':'staff','uid':'U1','code':'acc1','name':'Accountant A','perms':[]},
 'tok_appr_1234': {'role':'manager','uid':'U2','code':'appr','name':'Approver B','perms':[]},
 'tok_view_1234': {'role':'staff','uid':'U3','code':'view','name':'Viewer C','perms':[]},
 'tok_nobody_12': {'role':'staff','uid':'U4','code':'nob','name':'No Access','perms':[]},
 'tok_mgr_12345': {'role':'manager','uid':'U5','code':'mgr','name':'Manager M','perms':[]},
 'tok_staff_1234': {'role':'staff','uid':'U6','code':'stf','name':'Staff S','perms':[]},
 'tok_verifier_12': {'role':'staff','uid':'U7','code':'ver','name':'Partner Verifier','perms':[]},
}
CALLS = {'me':0,'bootstrap':0}
class H(http.server.BaseHTTPRequestHandler):
    def log_message(self,*a): pass
    def do_GET(self):
        q = dict(urllib.parse.parse_qsl(urllib.parse.urlparse(self.path).query))
        if self.path.startswith('/calls'):
            b=json.dumps(CALLS).encode(); self.send_response(200); self.end_headers(); self.wfile.write(b); return
        a, t, cb = q.get('action'), q.get('t',''), q.get('callback','cb')
        CALLS[a]=CALLS.get(a,0)+1
        me = USERS.get(t)
        if not me: res={'ok':False,'error':'หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบใหม่','code':'SESSION'}
        elif a=='me': res={'ok':True,'data':me}
        elif a=='bootstrap': res={'ok':True,'data':{'me':me,'tables':{'users':[{'id':'owner','username':'owner','name':'Owner','role':'owner','status':'active'}]+[{'id':v['uid'],'username':v['code'],'name':v['name'],'role':v['role'],'status':'active'} for k,v in USERS.items() if v['uid']]}}}
        else: res={'ok':False,'error':'unknown'}
        body=(cb+'('+json.dumps(res)+')').encode()
        self.send_response(200); self.send_header('content-type','application/javascript'); self.end_headers(); self.wfile.write(body)
http.server.ThreadingHTTPServer(('127.0.0.1',8799),H).serve_forever()

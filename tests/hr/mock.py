# mock หลังร้าน (backoffice) สำหรับทดสอบ HR ตำแหน่ง/สิทธิ์ — bootstrap + write(upsertMany) + ซิงก์ HR↔Users แบบเซิร์ฟเวอร์ (34_HrUserSync)
import json, http.server, urllib.parse, copy
PERMLIST=[['hr','HR บุคคล'],['payroll','เงินเดือน'],['time','เวลาทำงาน'],['schedule_view','ดูตารางงาน'],['stock','สต็อก'],['orders','Live Orders'],['catalog','Web Admin Portal'],['users','User Management'],['admin','ดูแลระบบ'],['dash','Dashboard',True]]
U = {
 'tok_owner': {'role':'owner','uid':'','code':'owner','name':'Owner','perms':[p[0] for p in PERMLIST],'scope':'*'},
 'tok_admin': {'role':'admin','uid':'A1','code':'adm','name':'Admin','perms':['users','admin']},
 'tok_hr':    {'role':'hr','uid':'H1','code':'hr1','name':'HR One','perms':['hr','payroll','time'],'branch':'B0001','scope':'*'},
 'tok_mgrhr': {'role':'manager','uid':'M1','code':'mgr','name':'Mgr HR','perms':['hr','stock'],'branch':'B0001','scope':['B0001']},
 'tok_staff': {'role':'staff','uid':'S1','code':'stf','name':'Staff','perms':['stock']},
}
SEED = {
 'branches':[{'id':'b1','code':'B0001','name':'สาขาตลาด','active':True}],
 'employees':[
  {'id':'E1','code':'E001','firstName':'สมชาย','lastName':'ใจดี','nickname':'ชาย','role':'manager','branch':'B0001','status':'ประจำ','position':'ผู้จัดการร้าน','positionCode':'MANAGER','payType':'monthly','rate':20000},
  {'id':'E2','code':'E002','firstName':'สมหญิง','lastName':'รักงาน','nickname':'หญิง','role':'staff','branch':'B0001','status':'ประจำ','position':'บาริสต้า','positionCode':'BARISTA','payType':'daily','rate':400},
  {'id':'E3','code':'E003','firstName':'มานะ','lastName':'ขยัน','nickname':'นะ','role':'staff','branch':'B0001','status':'ทดลองงาน','position':'บาริสต้า','payType':'daily','rate':400}],
 'users':[{'id':'owner','username':'owner','name':'Owner','role':'owner','status':'active','master':True},
  {'id':'U10','username':'mgr_somchai','name':'สมชาย','role':'manager','status':'active','empId':'E1','perms':''},
  {'id':'U11','username':'staff_somying','name':'สมหญิง','role':'staff','status':'active','empId':'E2','perms':'stock'}],
}
DB = copy.deepcopy(SEED); WRITES=[]
def upsert(t, rows):
    out=[]
    for r in rows:
        arr=DB.setdefault(t,[]); i=next((k for k,x in enumerate(arr) if x['id']==r['id']),-1)
        if i>=0: arr[i]={**arr[i],**r}; out.append(arr[i])
        else: arr.append(r); out.append(r)
        if t=='employees':   # เซิร์ฟเวอร์: Role พนักงานเปลี่ยน → บัญชีที่ผูกเปลี่ยนตาม + ล้างสิทธิ์เฉพาะคน
            for u in DB['users']:
                if u.get('empId')==r['id'] and r.get('role') and r['role']!=u['role'] and r['role']!='owner': u['role']=r['role']; u['perms']=''
        if t=='users' and r.get('empId'):
            for e in DB['employees']:
                if e['id']==r['empId'] and r.get('role'): e['role']=r['role']
    return out
class H(http.server.BaseHTTPRequestHandler):
    def log_message(self,*a): pass
    def send(self, body, ct='application/javascript'):
        self.send_response(200); self.send_header('content-type',ct); self.send_header('access-control-allow-origin','*'); self.end_headers(); self.wfile.write(body.encode())
    def do_GET(self):
        global DB
        u=urllib.parse.urlparse(self.path); q=dict(urllib.parse.parse_qsl(u.query))
        if u.path=='/reset': DB=copy.deepcopy(SEED); WRITES.clear(); return self.send('ok','text/plain')
        if u.path=='/state': return self.send(json.dumps({'db':DB,'writes':WRITES}),'application/json')
        me=U.get(q.get('t','')); a=q.get('action'); cb=q.get('callback','cb')
        if not me: res={'ok':False,'error':'หมดเวลาการใช้งาน','code':'SESSION'}
        elif a in ('bootstrap','me'):
            if a=='me': res={'ok':True,'data':me}
            else:
                tb={k:v for k,v in DB.items() if k!='users' or 'users' in me['perms'] or me['role']=='owner'}
                res={'ok':True,'data':{'me':me,'permList':PERMLIST,'settings':{'shopName':'Café Amazon'},'tables':copy.deepcopy(tb)}}
        elif a=='write':
            p=json.loads(q.get('p','{}')); WRITES.append({'by':me['code'],**p})
            if p.get('op')=='upsertMany':
                if p['table']=='users' and 'users' not in me['perms'] and me['role']!='owner': res={'ok':False,'error':'ไม่มีสิทธิ์ Users'}
                else: res={'ok':True,'data':{'rows':upsert(p['table'],p['rows'])}}
            else: res={'ok':True,'data':{}}
        else: res={'ok':True,'data':{}}
        self.send(cb+'('+json.dumps(res)+')')
http.server.ThreadingHTTPServer(('127.0.0.1',8798),H).serve_forever()

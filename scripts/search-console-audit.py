import json,os,datetime,argparse
import httplib2
from google_auth_httplib2 import AuthorizedHttp
p=argparse.ArgumentParser();p.add_argument('--submit',action='store_true');p.add_argument('--output',default='artifacts/operations/search-console.json');args=p.parse_args()
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
key=os.environ['GOOGLE_APPLICATION_CREDENTIALS']
creds=service_account.Credentials.from_service_account_file(key,scopes=['https://www.googleapis.com/auth/webmasters' if args.submit else 'https://www.googleapis.com/auth/webmasters.readonly'])
s=build('searchconsole','v1',http=AuthorizedHttp(creds,http=httplib2.Http(timeout=30)),cache_discovery=False)
site='sc-domain:recalledrides.com'
report={'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'site':site,'access':None,'sitemaps':None,'inspection':[]}
try:
 entries=s.sites().list().execute().get('siteEntry',[])
 report['access']=next((x for x in entries if x['siteUrl']==site),None)
 if args.submit:
  s.sitemaps().submit(siteUrl=site,feedpath='https://recalledrides.com/sitemap.xml').execute()
  report['sitemap_submitted_at']=datetime.datetime.now(datetime.timezone.utc).isoformat()
 report['sitemaps']=s.sitemaps().list(siteUrl=site).execute()
 end=datetime.date.today()-datetime.timedelta(days=3);start=end-datetime.timedelta(days=27)
 report['performance_period']={'start':str(start),'end':str(end)}
 report['performance']=s.searchanalytics().query(siteUrl=site,body={'startDate':str(start),'endDate':str(end),'rowLimit':1}).execute()
 report['top_pages']=s.searchanalytics().query(siteUrl=site,body={'startDate':str(start),'endDate':str(end),'dimensions':['page'],'rowLimit':10}).execute()
 for path in ['/','/ram','/ram/1500','/ram/1500/2019','/stats/ram/1500','/chevrolet/malibu/2023','/mercedes-benz/c-class','/mercedes-benz/cle/2000','/mercedes-benz/slr-mclaren/2027','/dodge/ram-1500/2008']:
  try:
   r=s.urlInspection().index().inspect(body={'inspectionUrl':'https://recalledrides.com'+path,'siteUrl':site}).execute()
   report['inspection'].append({'path':path,**r.get('inspectionResult',{})})
  except HttpError as e:report['inspection'].append({'path':path,'error_status':e.resp.status})
except HttpError as e:report['error_status']=e.resp.status;report['error_reason']=str(e)[:500]
os.makedirs(os.path.dirname(args.output) or '.',exist_ok=True)
with open(args.output,'w') as f:json.dump(report,f,indent=2)
print(json.dumps({'access':report['access'],'sitemaps':report['sitemaps'],'performance':report.get('performance'),'inspection':[{'path':r['path'],'indexStatusResult':r.get('indexStatusResult'),'error_status':r.get('error_status')} for r in report['inspection']],'error_status':report.get('error_status')}))

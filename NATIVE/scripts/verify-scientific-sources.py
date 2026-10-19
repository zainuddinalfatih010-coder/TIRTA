import json,urllib.request,urllib.parse,concurrent.futures,pathlib
seeds=['10.1016/j.watres.2017.02.056','10.1061/(ASCE)1084-0699(2008)13:2(90)','10.1016/j.jhydrol.2018.04.068','10.1016/j.envc.2026.101525','10.3390/su16229999','10.2489/jswc.61.3.117','10.1016/j.ecoleng.2009.12.014','10.1016/j.jhydrol.2011.11.035','10.1016/j.landurbplan.2005.02.010','10.1007/s11270-007-9484-z','10.1061/(ASCE)0733-9372(2009)135:3(109)','10.1007/s11270-012-1189-2','10.2166/wqrjc.2013.055','10.1061/(ASCE)0733-9437(2007)133:3(249)','10.1016/S0043-1354(03)00410-X','10.3390/w10060684','10.1016/j.jenvman.2015.12.026','10.3390/w6072018','10.1016/j.landurbplan.2012.01.012','10.1080/1573062X.2014.916314','10.2166/wst.2011.239','10.1061/(ASCE)HE.1943-5584.0000006','10.1016/S1618-8667(02)00049-X','10.1016/j.landurbplan.2017.02.017','10.1016/j.jenvman.2013.08.026','10.3390/w9080577','10.1016/j.ecoleng.2017.02.059']
def get(doi):
 try:
  req=urllib.request.Request('https://api.crossref.org/works/'+urllib.parse.quote(doi,safe=''),headers={'User-Agent':'TIRTA-scientific-reference-verification/1.0'})
  with urllib.request.urlopen(req,timeout=35) as r:m=json.load(r)['message']
  return {'doi':doi,'type':m.get('type'),'title':m.get('title',[''])[0],'authors':[a.get('given','')+' '+a.get('family','') for a in m.get('author',[])],'year':m.get('published',{}).get('date-parts',[[None]])[0][0],'journal':m.get('container-title',[''])[0],'abstract':m.get('abstract'),'url':m.get('URL'),'links':m.get('link',[])}
 except Exception as e:return {'doi':doi,'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: records=list(pool.map(get,seeds))
pathlib.Path('docs/scientific-revision/crossref-verification.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf8')
for r in records:print(r['doi'],r.get('title',r.get('error')),str(r.get('year')))

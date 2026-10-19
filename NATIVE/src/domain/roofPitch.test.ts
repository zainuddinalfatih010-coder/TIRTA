import { describe, it, expect } from 'vitest';
import { demoProject } from '../direction/productionBridge';
import { emptySurfaceContext, surfaceContextSchema } from './scientificContract';
import { observedNumber, updateScience } from './scientificAuthoring';
import { migrateProject } from './migration';
import { projectBackup } from '../persistence/portable';
import { productionBaseline } from './productionBaseline';

describe('roof pitch is sourced context, not a hidden volume correction',()=>{
  it('keeps old records importable and blank distinct from sourced 0 degrees',()=>{
    const old=emptySurfaceContext();delete old.roof.pitch;
    expect(surfaceContextSchema.parse(old).roof.pitch).toBeUndefined();
    const context=emptySurfaceContext();
    expect(context.roof.pitch?.value).toBeNull();
    context.roof.pitch=observedNumber('0','degrees','user_supplied','Declared flat roof');
    expect(surfaceContextSchema.parse(context).roof.pitch?.value).toBe(0);
    context.roof.pitch=observedNumber('','degrees','user_supplied','Discarded note');
    expect(surfaceContextSchema.parse(context).roof.pitch).toMatchObject({value:null,origin:'unknown',source:''});
  });
  it.each([-1,90,100,Number.NaN,Number.POSITIVE_INFINITY])('rejects invalid roof angle %s at import boundary',value=>{
    const context=emptySurfaceContext();context.roof.pitch={value,unit:'degrees',origin:'user_supplied',source:'Synthetic test',method:'',date:''};
    expect(surfaceContextSchema.safeParse(context).success).toBe(false);
  });
  it('requires source, measured method/date and degrees rather than another unit',()=>{
    const context=emptySurfaceContext();
    expect(()=>observedNumber('30','degrees','user_supplied','')).toThrow();
    expect(()=>observedNumber('30','degrees','measured','Test')).toThrow();
    context.roof.pitch=observedNumber('30','mm','user_supplied','Wrong unit');
    expect(surfaceContextSchema.safeParse(context).success).toBe(false);
  });
  it('roundtrips measured pitch and provenance without changing runoff',()=>{
    const p=demoProject(),before=productionBaseline(p,'r50');
    const next=updateScience(p,s=>{
      const context=emptySurfaceContext();context.roof.form='sloped';context.roof.material='Genteng';
      context.roof.pitch=observedNumber('30','degrees','measured','Synthetic measurement','Inclinometer','2026-10-05');
      s.surfaces.z0=context;
    });
    expect(productionBaseline(next,'r50')).toEqual(before);
    const imported=migrateProject(JSON.parse(projectBackup(next)).project,'2026-10-05');
    expect(imported.science?.surfaces.z0?.roof.pitch).toEqual(next.science?.surfaces.z0?.roof.pitch);
    expect(imported.science?.surfaces.z0?.roof.pitch).toMatchObject({value:30,source:'Synthetic measurement',method:'Inclinometer',date:'2026-10-05'});
    expect(p.science?.surfaces.z0).toBeUndefined();
  });
});

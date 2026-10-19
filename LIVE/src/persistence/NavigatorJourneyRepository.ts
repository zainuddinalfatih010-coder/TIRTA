import type {ProjectStorage} from './storage';
import {navigatorJourneySchema,type NavigatorJourney} from '../domain/navigatorJourney';
export class NavigatorJourneyRepository {
 constructor(private readonly storage:ProjectStorage){}
 async read(projectId:string):Promise<NavigatorJourney|null>{
 const result=navigatorJourneySchema.safeParse(await this.storage.readSetting(`navigator-journey:${projectId}`));
 return result.success&&result.data.projectId===projectId?result.data:null;
 }
 async write(projectId:string,journey:NavigatorJourney){
 const parsed=navigatorJourneySchema.parse(journey);if(parsed.projectId!==projectId)throw new Error('Progres milik proyek lain.');
 await this.storage.writeSetting(`navigator-journey:${projectId}`,parsed);
 }
 async clear(projectId:string){await this.storage.writeSetting(`navigator-journey:${projectId}`,null);}
}

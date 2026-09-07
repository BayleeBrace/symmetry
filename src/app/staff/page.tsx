import {BrandHeader} from '@/components/brand-header';
import {Diary} from './diary';
export const metadata={title:'For the lads',robots:{index:false,follow:false}};
export default function Page(){return <main className="staff-page"><BrandHeader compact/><Diary/></main>}

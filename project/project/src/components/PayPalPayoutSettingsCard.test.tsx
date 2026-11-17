import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({upsert:vi.fn(),saved:vi.fn(),refresh:vi.fn()}));
const rows=['SELLER','PARTNER','INFLUENCER'].map(role=>({user_id:'owner',role,paypal_email:'owner@example.com',is_verified:true}));
vi.mock('../contexts/AuthContextMultiRole',()=>({useAuth:()=>({profile:{id:'owner'},refreshProfile:mocks.refresh})}));
vi.mock('../lib/supabase',()=>({supabase:{from:()=>({select:()=>({eq:async()=>({data:rows,error:null})}),upsert:mocks.upsert})}}));
import Card from './PayPalPayoutSettingsCard';
let view:ReactTestRenderer;
beforeEach(async()=>{
 vi.useFakeTimers();vi.stubGlobal('window',{setTimeout});
 mocks.upsert.mockReset();mocks.saved.mockResolvedValue({data:rows,error:null});mocks.upsert.mockReturnValue({select:mocks.saved});
 mocks.refresh.mockResolvedValue(undefined);
 await act(async()=>{view=create(<Card/>)});
});
afterEach(async()=>{await act(async()=>view.unmount());vi.useRealTimers();vi.unstubAllGlobals()});
async function save(){
 const checkbox=view.root.findAllByType('input').find(x=>x.props.type==='checkbox')!;
 await act(async()=>checkbox.props.onChange({target:{checked:true}}));
 const save=view.root.findAllByType('button').find(x=>x.children.includes('Save'))!;
 await act(async()=>save.props.onClick());
}
describe('PayPal email Save',()=>{
 it('does not submit browser verification and preserves the returned verified status',async()=>{
  await save();expect(mocks.upsert.mock.calls[0][0].every((row:any)=>!('is_verified' in row))).toBe(true);
  expect(JSON.stringify(view.toJSON())).toContain('Your payout email is still verified.');
 });
 it('shows verification needed when the database returns an unverified changed email',async()=>{
  mocks.saved.mockResolvedValue({data:rows.map(row=>({...row,paypal_email:'other@example.com',is_verified:false})),error:null});
  await act(async()=>view.root.findAllByType('input').find(x=>x.props.type==='email')!.props.onChange({target:{value:'other@example.com'}}));
  await save();expect(JSON.stringify(view.toJSON())).toContain('Saved — verification needed');
  expect(JSON.stringify(view.toJSON())).not.toContain('still verified.');
 });
});

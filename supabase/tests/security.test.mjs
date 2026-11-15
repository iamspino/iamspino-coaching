import { createClient } from '@supabase/supabase-js';
const URL='http://127.0.0.1:54321', ANON=process.env.ANON;
const mk=()=>createClient(URL,ANON,{auth:{persistSession:false}});
let fails=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fails++;};
const rnd=Math.random().toString(36).slice(2,7);
async function signup(meta){const c=mk();const {data,error}=await c.auth.signUp({email:`${meta.role}${rnd}${Math.random().toString(36).slice(2,5)}@test.it`,password:'Password123!',options:{data:meta}});return {c,error,id:data.user?.id};}
const A=await signup({role:'trainer',full_name:'Coach A',business_name:'Studio A'});
const B=await signup({role:'trainer',full_name:'Coach B',business_name:'Studio B'});
ok(!A.error&&!B.error,'trainer signup '+(A.error?.message||''));
const {data:inv,error:ie}=await A.c.from('client_invites').insert({full_name:'Mario'}).select().single();
ok(!ie && inv.code.length===8,'invite created '+(ie?.message||inv?.code));
const anon=mk();
const {data:chk}=await anon.rpc('check_invite',{invite_code:inv.code.toLowerCase()});
ok(chk?.[0]?.business_name==='Studio A','check_invite anon works');
const bad=await signup({role:'client',full_name:'X',invite_code:'NOPE1234'});
ok(!!bad.error,'bad invite rejected: '+bad.error?.message);
const C=await signup({role:'client',full_name:'Mario Rossi',invite_code:inv.code});
ok(!C.error,'client signup '+(C.error?.message||''));
const again=await signup({role:'client',full_name:'Y',invite_code:inv.code});
ok(!!again.error,'invite single use');
// trainer A sees client, B doesn't
ok((await A.c.from('clients').select()).data.length===1,'A sees 1 client');
ok((await B.c.from('clients').select()).data.length===0,'B sees 0 clients');
ok((await B.c.from('profiles').select()).data.length===1,'B sees only own profile');
// exercises
const {data:lib}=await C.c.from('exercises').select('id,name');
ok(lib.length===85,'client sees library '+lib.length);
const {data:myEx}=await A.c.from('exercises').insert({name:'Curl segreto A',trainer_id:A.id,video_url:'https://youtu.be/x'}).select().single();
ok(!!myEx,'A creates exercise');
ok((await B.c.from('exercises').select().eq('id',myEx.id)).data.length===0,'B cannot see A exercise');
ok((await C.c.from('exercises').select().eq('id',myEx.id)).data.length===1,'A client sees A exercise');
const bEx=await B.c.from('exercises').insert({name:'hack',trainer_id:A.id});
ok(!!bEx.error,'B cannot insert as A');
// program
const {data:prog,error:pe}=await A.c.from('programs').insert({client_id:C.id,name:'Ipertrofia 1'}).select().single();
ok(!pe,'program created '+(pe?.message||''));
const bp=await B.c.from('programs').insert({client_id:C.id,name:'steal'});
ok(!!bp.error,'B cannot create program for A client');
const {data:w}=await A.c.from('workouts').insert({program_id:prog.id,name:'Giorno A'}).select().single();
const {data:we,error:wee}=await A.c.from('workout_exercises').insert({workout_id:w.id,exercise_id:lib[0].id,sets:4,reps:'8',week_overrides:{"2":{"reps":"6"}}}).select().single();
ok(!wee,'wex created '+(wee?.message||''));
ok((await C.c.from('programs').select()).data.length===0,'client cannot see draft');
ok((await C.c.from('workouts').select()).data.length===0,'client cannot see draft workouts');
await A.c.from('programs').update({status:'active',sent_at:new Date().toISOString()}).eq('id',prog.id);
ok((await C.c.from('programs').select('*,workouts(*,workout_exercises(*,exercises(*)))')).data[0]?.workouts[0]?.workout_exercises.length===1,'client sees sent program w/ nested');
ok((await B.c.from('workouts').select()).data.length===0,'B sees no workouts');
const cu=await C.c.from('programs').update({name:'hack'}).eq('id',prog.id).select();
ok(cu.data?.length===0,'client cannot edit program');
// logs
const {data:log,error:le}=await C.c.from('workout_logs').insert({program_id:prog.id,workout_id:w.id,workout_name:'Giorno A'}).select().single();
ok(!le,'client log '+(le?.message||''));
const {error:se}=await C.c.from('set_logs').insert([{log_id:log.id,workout_exercise_id:we.id,exercise_id:lib[0].id,exercise_name:lib[0].name,set_number:1,reps:8,load:60}]);
ok(!se,'set log '+(se?.message||''));
await C.c.from('workout_logs').update({completed_at:new Date().toISOString(),feeling:4}).eq('id',log.id);
ok((await A.c.from('set_logs').select()).data.length===1,'A sees set logs');
ok((await B.c.from('set_logs').select()).data.length===0,'B no set logs');
// messages
const m1=await C.c.from('messages').insert({client_id:C.id,body:'Ciao coach'});
const m2=await A.c.from('messages').insert({client_id:C.id,body:'Ciao Mario'});
ok(!m1.error&&!m2.error,'messages '+(m1.error?.message||m2.error?.message||''));
ok(!!(await B.c.from('messages').insert({client_id:C.id,body:'spam'})).error,'B cannot message A client');
const fake=await C.c.from('messages').insert({client_id:C.id,body:'x',sender_id:A.id});
ok(!!fake.error,'cannot spoof sender');
const mr=await A.c.from('messages').update({read_at:new Date().toISOString()}).eq('client_id',C.id).neq('sender_id',A.id).select();
ok(mr.data?.length===1,'A marks read');
const mb=await A.c.from('messages').update({body:'edited'}).eq('client_id',C.id).select();
ok(!!mb.error,'body not editable');
// check-in + storage
const {error:ce}=await C.c.from('check_ins').insert({weight:80.5,energy:4,notes:'ok'});
ok(!ce,'checkin '+(ce?.message||''));
ok((await A.c.from('check_ins').select()).data.length===1,'A sees checkin');
ok((await B.c.from('check_ins').select()).data.length===0,'B no checkin');
const up=await C.c.storage.from('progress').upload(`${C.id}/front.jpg`,new Blob([new Uint8Array([255,216,255])],{type:'image/jpeg'}),{contentType:'image/jpeg'});
ok(!up.error,'photo upload '+(up.error?.message||''));
const up2=await C.c.storage.from('progress').upload(`${A.id}/x.jpg`,new Blob([new Uint8Array([1])],{type:'image/jpeg'}),{contentType:'image/jpeg'});
ok(!!up2.error,'cannot upload in other folder');
ok(!(await A.c.storage.from('progress').createSignedUrl(`${C.id}/front.jpg`,60)).error,'A can view photo');
ok(!!(await B.c.storage.from('progress').createSignedUrl(`${C.id}/front.jpg`,60)).error,'B cannot view photo');
// privileges
const pl=await A.c.from('trainers').update({max_clients:9999}).eq('id',A.id).select();
ok(!!pl.error,'trainer cannot raise own limit');
ok(!(await A.c.from('trainers').update({business_name:'Studio A+'}).eq('id',A.id)).error,'trainer edits business name');
ok((await C.c.from('client_notes').select()).data.length===0,'client cannot read private notes');
ok((await A.c.from('client_notes').update({notes:'ginocchio dx'}).eq('client_id',C.id).select()).data.length===1,'A writes notes');
ok(!!(await C.c.from('clients').update({status:'active'}).eq('id',C.id).select()).data,'client update self ok');
const tr=await C.c.from('clients').update({trainer_id:B.id}).eq('id',C.id);
ok(!!tr.error,'client cannot change trainer');
// duplicate
const {data:dup,error:de}=await A.c.rpc('duplicate_program',{src:prog.id,target_client:null,new_name:'Modello'});
ok(!de && (await A.c.from('workout_exercises').select('id,workouts!inner(program_id)').eq('workouts.program_id',dup)).data.length===1,'duplicate '+(de?.message||''));
ok(!!(await B.c.rpc('duplicate_program',{src:prog.id})).error,'B cannot duplicate');
// questionario di fine scheda
const rv=await C.c.from('program_reviews').insert({program_id:prog.id,program_name:prog.name,overall:4,difficulty:3,next_goal:'Forza',days_per_week:4}).select().single();
ok(!rv.error,'client submits review '+(rv.error?.message||''));
ok((await A.c.from('program_reviews').select()).data.length===1,'A sees review');
ok((await B.c.from('program_reviews').select()).data.length===0,'B cannot see review');
ok((await A.c.from('program_reviews').update({overall:1}).eq('id',rv.data.id).select()).data.length===0,'trainer cannot alter review');
const {data:bProg}=await B.c.from('programs').insert({name:'di B'}).select().single();
ok(!!(await C.c.from('program_reviews').insert({program_id:bProg.id,program_name:'x'})).error,'client cannot review foreign program');
ok(!(await A.c.from('programs').update({review_requested_at:new Date().toISOString()}).eq('id',prog.id)).error,'A requests review');
await A.c.from('programs').delete().eq('id',prog.id);
const kept=(await A.c.from('program_reviews').select()).data;
ok(kept.length===1 && kept[0].program_id===null && kept[0].program_name==='Ipertrofia 1','review survives program deletion');
// delete account
const D=await signup({role:'trainer',full_name:'Del'});
ok(!(await D.c.rpc('delete_my_account')).error,'delete account');
console.log(fails? `\n${fails} FAILED`:'\nALL PASSED');

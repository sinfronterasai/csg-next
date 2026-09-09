// Private snapshot in, offline candidate out. No network or credentials handling.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const [input,output]=process.argv.slice(2);if(!input||!output)throw new Error('Usage: node package.cjs PRIVATE_SNAPSHOT PRIVATE_OUTPUT');
const w=JSON.parse(fs.readFileSync(input,'utf8'));
assert.equal(w.id,'041aea81bd395e74');assert.equal(w.versionId,'e2c11b21-272b-4181-9e1a-cffc8831367e');assert.equal(w.activeVersionId,w.versionId);
const original=structuredClone(w);const changes=[];
for(const n of w.nodes){const file=path.join(__dirname,'nodes',n.name+'.js');if(!fs.existsSync(file))continue;const code=fs.readFileSync(file,'utf8');new Function('$input','$','require',code);const baseline=path.join(__dirname,'baseline',n.name+'.js');if(fs.existsSync(baseline))assert.equal(n.parameters.jsCode,fs.readFileSync(baseline,'utf8'));else assert.equal(n.parameters.jsCode,original.nodes.find(n=>n.name==='Normalize Initial Placement Citations').parameters.jsCode);if(code!==n.parameters.jsCode){changes.push(n.name);n.parameters.jsCode=code;}}
assert.deepEqual(w.connections,original.connections);assert.deepEqual(w.settings,original.settings);
assert.deepEqual(w.nodes.find(n=>n.name==='Revision Attempts Remaining?'),original.nodes.find(n=>n.name==='Revision Attempts Remaining?'));
for(const n of w.nodes)if(n.parameters.jsCode)new Function('$input','$','require',n.parameters.jsCode);
fs.writeFileSync(output,JSON.stringify(w,null,2));
console.log(JSON.stringify({offlineOnly:true,sourceVersion:w.versionId,changedCodeNodes:changes,connectionsUnchanged:true,attemptCapUnchanged:true,sha256:crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex')},null,2));

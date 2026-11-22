// ---------- Config ----------
// Optional: drop a dissection-grade model here (see README for naming: system__region__Part_name)
// Which model files each system needs (files live in /models). Loaded the first time the system is ticked.
const SHOWN = ['bone','cartilage','muscle','nerve','artery','vein','organ'];   // systems with real models
const FILES = window.FILES_OVERRIDE || {bone:['skeleton.glb'], cartilage:['skeleton.glb'], muscle:['muscles_1.glb','muscles_2.glb','muscles_3.glb'],
  nerve:['nerves.glb'], artery:['arteries.glb'], vein:['veins.glb'], organ:['organs.glb']};
addEventListener('error', e => { const i = document.getElementById('info'); if (i) i.textContent = 'Error: ' + e.message; });
addEventListener('unhandledrejection', e => { const i = document.getElementById('info'); if (i) i.textContent = 'Error: ' + ((e.reason && e.reason.message) || e.reason); });

const SYS = {
  bone:   {n:'Bones',     c:0xe9e1cb},
  muscle: {n:'Muscles',   c:0xb4463b},
  nerve:  {n:'Nerves',    c:0xf3d23d},
  artery: {n:'Arteries',  c:0xd92b2b},
  vein:   {n:'Veins',     c:0x3b6fd9},
  cartilage:{n:'Cartilage & discs', c:0xc6dbe8},
  organ:  {n:'Organs',    c:0xc9857a}
};
const REG = {head:'Head', neck:'Neck', thorax:'Thorax', abdpelvis:'Abdomen & Pelvis', arm:'Upper limb', leg:'Lower limb'};

// ---------- Scene ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10151c);
const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 50);
const controls = new THREE.OrbitControls(camera, canvas);
controls.enableDamping = true;
function resetView(){ camera.position.set(0, 1.05, 3.6); controls.target.set(0, 0.95, 0); controls.update(); }
resetView();
scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 0.7));
const d1 = new THREE.DirectionalLight(0xffffff, 0.8); d1.position.set(2, 3, 3); scene.add(d1);
const d2 = new THREE.DirectionalLight(0x99bbff, 0.4); d2.position.set(-3, 1, -2); scene.add(d2);
const root = new THREE.Group(); scene.add(root);
const grid = new THREE.GridHelper(2, 20, 0x2a3544, 0x1d2631); scene.add(grid);

// ---------- Helpers (units are metres; standing height H = 1.75 m) ----------
const V = (x,y,z) => new THREE.Vector3(x,y,z);
const Y = V(0,1,0);
const parts = [];
const mats = {};
Object.keys(SYS).forEach(k => mats[k] = new THREE.MeshStandardMaterial({color:SYS[k].c, roughness:.65, metalness:.02, side:THREE.DoubleSide}));

function A(sys, reg, name, obj){
  const m = mats[sys].clone();
  obj.userData = {name, sys, reg, mat:m};
  obj.traverse(o => { if (o.isMesh){ o.material = m; o.userData.part = obj; if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals(); } });
  parts.push(obj); root.add(obj); return obj;
}
function orient(mesh, a, b){
  const d = b.clone().sub(a);
  mesh.position.copy(a.clone().add(b).multiplyScalar(.5));
  mesh.quaternion.setFromUnitVectors(Y, d.clone().normalize());
  return mesh;
}
const seg = (a,b,r0,r1=r0) => orient(new THREE.Mesh(new THREE.CylinderGeometry(r1,r0,a.distanceTo(b),12)), a, b);
function bone(a,b,r,ends=1.5){            // shaft with expanded epiphyses
  const g = new THREE.Group(); g.add(seg(a,b,r*.8,r*.8));
  [a,b].forEach(p => { const s = new THREE.Mesh(new THREE.SphereGeometry(r*ends,14,10)); s.position.copy(p); g.add(s); });
  return g;
}
function ell(c,rx,ry,rz,rot){
  const m = new THREE.Mesh(new THREE.SphereGeometry(1,24,16)); m.position.copy(c); m.scale.set(rx,ry,rz);
  if (rot) m.rotation.set(...rot); return m;
}
const tube = (pts,r) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, r, 8), undefined);
function spindle(a,b,r){
  const L = a.distanceTo(b), pr = [];
  for (let i=0;i<=16;i++){ const t=i/16; pr.push(new THREE.Vector2(Math.max(.002, r*Math.pow(Math.sin(Math.PI*t),.6)), (t-.5)*L)); }
  return orient(new THREE.Mesh(new THREE.LatheGeometry(pr,14)), a, b);
}
function both(fn){ [[1,'R'],[-1,'L']].forEach(([s,l]) => fn((x,y,z)=>V(s*x,y,z), n=>`${n} (${l})`)); }

// ---------- Spine: lordosis / kyphosis curvature ----------
const zS = y => -.06 + (y<1.17 ? .03*Math.sin((y-.99)/.18*Math.PI)
                : y<1.46 ? -.025*Math.sin((y-1.17)/.29*Math.PI)
                : .02*Math.sin((y-1.46)/.12*Math.PI));
const vert = [];
for (let i=0;i<7;i++)  vert.push(['C'+(i+1),'neck',1.58-.02*i,.011+.0008*i,.02]);
for (let i=0;i<12;i++) vert.push(['T'+(i+1),'thorax',1.44-.0227*i,.014+.0005*i,.0227]);
for (let i=0;i<5;i++)  vert.push(['L'+(i+1),'abdpelvis',1.165-.0425*i,.021+.0015*i,.0425]);
vert.forEach(([n,reg,y,r,step]) => {
  const g = new THREE.Group(), z = zS(y);
  const body = seg(V(0,y-step*.38,z), V(0,y+step*.38,z), r); g.add(body);
  g.add(seg(V(0,y,z-r*.9), V(0,y-step*.3,z-r*2.6), r*.25, r*.12));        // spinous process
  g.add(seg(V(-r*1.8,y,z-r*.7), V(r*1.8,y,z-r*.7), r*.12));               // transverse processes
  A('bone', reg, n==='C1'?'Atlas (C1)':n==='C2'?'Axis (C2)':n+' vertebra', g);
});
for (let i=0;i<vert.length-1;i++){          // intervertebral discs
  const a=vert[i], b=vert[i+1], y=(a[2]+b[2])/2, r=(a[3]+b[3])/2*1.05, h=Math.abs(a[2]-b[2])*.3;
  A('cartilage',b[1],`Disc ${a[0]}–${b[0]}`, seg(V(0,y-h/2,zS(y)),V(0,y+h/2,zS(y)),r));
}
// Sacrum + coccyx
A('bone','abdpelvis','Sacrum', ell(V(0,.93,-.075),.05,.07,.025,[.25,0,0]));
A('bone','abdpelvis','Coccyx', ell(V(0,.84,-.06),.012,.025,.01));

// ---------- Skull: cranial bones as sectors of the cranial vault ----------
const PI=Math.PI, CC=V(0,1.665,-.012);
function cran(p0,p1,t0,t1){ const m=new THREE.Mesh(new THREE.SphereGeometry(1,22,14,p0,p1-p0,t0,t1-t0)); m.position.copy(CC); m.scale.set(.077,.085,.097); return m; }
A('bone','head','Frontal bone', cran(PI/4,3*PI/4,0,.6*PI));
A('bone','head','Occipital bone', cran(5*PI/4,7*PI/4,0,.72*PI));
[[3*PI/4,5*PI/4,'R'],[-PI/4,PI/4,'L']].forEach(([a,b,l]) => {
  A('bone','head',`Parietal bone (${l})`, cran(a,b,0,.4*PI));
  A('bone','head',`Temporal bone (${l})`, cran(a,b,.4*PI,.64*PI));
});
A('bone','head','Nasal bone', ell(V(0,1.637,.094),.009,.017,.007));
A('bone','head','Maxilla', ell(V(0,1.598,.07),.032,.026,.026));
const jaw=[[-.06,1.625,-.03],[-.054,1.57,.0],[-.03,1.545,.06],[0,1.538,.087],[.03,1.545,.06],[.054,1.57,.0],[.06,1.625,-.03]].map(p=>V(...p));
A('bone','head','Mandible', tube(jaw,.009));
both((P,n) => { const g=new THREE.Group(); g.add(ell(P(.047,1.625,.072),.014,.011,.009)); g.add(tube([P(.05,1.628,.07),P(.073,1.626,.03),P(.077,1.62,-.005)],.004)); A('bone','head',n('Zygomatic bone'),g); });

// ---------- Thorax ----------
const Wd=[.05,.08,.10,.115,.125,.135,.14,.14,.135,.125,.11,.1], Dp=[.13,.145,.155,.16,.165,.17,.17,.165,.16,.15,.1,.06];
const sz = y => .09-(y-1.27)/.16*.025;
for (let i=0;i<12;i++){
  const y=1.44-.0227*i, z0=zS(y), W=Wd[i], D=Dp[i], drop=.025+.012*i;
  both((P,n) => {
    const pts=[P(.02,y,z0),P(W*.9,y-.015,z0-.005),P(W,y-.03,z0+D*.35),P(W*.85,y-drop*.6,z0+D*.7)];
    if (i>=10) pts.push(P(W*.7,y-drop*.8,z0+D*.85));
    A('bone','thorax',n(`Rib ${i+1}`), tube(pts,.0045));
    if (i<10){ const ey=y-drop; A('cartilage','thorax',n(`Costal cartilage ${i+1}`), tube([pts[3],P(W*.5,y-drop*.8,z0+D*.9),P(.02,ey,sz(ey))],.0042)); }
  });
}
A('bone','thorax','Manubrium', seg(V(0,1.43,.065),V(0,1.385,.075),.03,.025));
A('bone','thorax','Sternal body', seg(V(0,1.385,.075),V(0,1.27,.09),.022,.02));
A('bone','thorax','Xiphoid process', seg(V(0,1.27,.09),V(0,1.235,.093),.012,.003));

// ---------- Shoulder girdle & upper limb ----------
both((P,n) => {
  A('bone','arm',n('Clavicle'), tube([P(.02,1.435,.065),P(.07,1.45,.07),P(.13,1.455,.035),P(.195,1.45,-.005)],.007));
  { const g=new THREE.Group(); g.add(ell(P(.11,1.37,-.09),.055,.075,.01,[0,P(1,0,0).x*-.3,0]));
    g.add(seg(P(.06,1.43,-.09),P(.19,1.458,-.04),.006)); g.add(ell(P(.19,1.458,-.035),.016,.01,.014));
    A('bone','arm',n('Scapula'),g); }
  A('bone','arm',n('Humerus'), bone(P(.19,1.43,-.01),P(.205,1.12,-.01),.0115));
  A('bone','arm',n('Ulna'),    bone(P(.205,1.12,-.02),P(.225,.87,.03),.007,1.4));
  A('bone','arm',n('Radius'),  bone(P(.22,1.115,.01),P(.245,.87,.03),.007,1.4));
  A('bone','arm',n('Carpals'), ell(P(.235,.855,.035),.03,.016,.012));
  const fin = [[.212,.07,.04,.025,.02],[.229,.075,.045,.027,.021],[.246,.072,.043,.026,.02],[.263,.065,.035,.02,.018]];
  fin.forEach((f,k) => {
    let y = .865, p = P(f[0]+.0,y,.04);
    ['Metacarpal',null,null,null].forEach((_,j) => {
      const ny = y-f[1+j], q = P(f[0]+.003*j,ny,.04);
      A('bone','arm',n(`Finger ${k+1} ${['metacarpal','proximal phalanx','middle phalanx','distal phalanx'][j]}`), bone(p,q,.0045,1.15));
      p = q; y = ny;
    });
  });
  let p = P(.275,.86,.05), q;
  [.045,.032,.025].forEach((l,j) => { q = P(.275+.012*(j+1),p.y-l,.06+.01*j); A('bone','arm',n(`Thumb ${['metacarpal','proximal phalanx','distal phalanx'][j]}`), bone(p,q,.0055,1.15)); p = q; });
});

// ---------- Pelvis & lower limb ----------
both((P,n) => {
  A('bone','abdpelvis',n('Ilium'), ell(P(.125,1.015,-.015),.08,.07,.02,[0,P(1,0,0).x*.65,P(1,0,0).x*-.45]));
  A('bone','abdpelvis',n('Ischium'), tube([P(.09,.93,-.005),P(.085,.89,-.04),P(.07,.855,-.045),P(.05,.86,.0),P(.025,.88,.06)],.011));
  A('bone','abdpelvis',n('Pubis'), tube([P(.095,.935,.015),P(.07,.92,.05),P(.02,.89,.075)],.01));
  A('bone','leg',n('Femur'), (() => { const g = bone(P(.125,.9,0),P(.095,.5,.005),.0155,1.45);
        g.add(seg(P(.125,.9,0),P(.078,.925,0),.012)); const h = ell(P(.075,.925,0),.024,.024,.024); g.add(h); return g; })());
  A('bone','leg',n('Patella'), ell(P(.095,.495,.035),.022,.025,.01));
  A('bone','leg',n('Tibia'),   bone(P(.09,.49,0),P(.08,.075,0),.0145,1.45));
  A('bone','leg',n('Fibula'),  bone(P(.122,.47,-.012),P(.11,.075,-.01),.0065,1.3));
  A('bone','leg',n('Calcaneus'), ell(P(.08,.03,-.04),.02,.028,.035));
  A('bone','leg',n('Talus'), ell(P(.085,.065,-.005),.022,.02,.03));
  A('bone','leg',n('Navicular & cuneiforms'), ell(P(.072,.035,.04),.028,.016,.025));
  A('bone','leg',n('Cuboid'), ell(P(.105,.027,.025),.014,.015,.02));
  for (let k=0;k<5;k++){
    const x = .063+.0165*k, e = k===0?0:k*.003;
    A('bone','leg',n(`Metatarsal ${k+1}`), bone(P(x,.025,.04),P(x+(k-2)*.004,.016,.13-e),.0055,1.15));
    A('bone','leg',n(`Toe ${k+1} phalanges`), bone(P(x+(k-2)*.004,.016,.13-e),P(x+(k-2)*.007,.012,.17-e*2),.004,1.1));
  }
});

// ---------- Muscles (origin → insertion, radius) ----------
const M = [
 ['Pectoralis major','thorax',[.03,1.38,.09],[.19,1.41,.03],.035],
 ['Deltoid','arm',[.2,1.46,0],[.215,1.28,0],.045],
 ['Biceps brachii','arm',[.2,1.4,.035],[.215,1.14,.025],.026],
 ['Triceps brachii','arm',[.2,1.4,-.04],[.215,1.15,-.03],.028],
 ['Forearm flexors','arm',[.22,1.12,.02],[.24,.9,.03],.026],
 ['Forearm extensors','arm',[.22,1.12,-.01],[.245,.9,0],.022],
 ['Trapezius','neck',[.01,1.57,-.07],[.18,1.46,-.04],.03],
 ['Latissimus dorsi','thorax',[.03,1.17,-.1],[.17,1.36,-.07],.035],
 ['Erector spinae','thorax',[.04,1.0,-.1],[.04,1.45,-.1],.02],
 ['Rectus abdominis','abdpelvis',[.03,1.0,.1],[.03,1.27,.09],.03],
 ['External oblique','abdpelvis',[.13,1.25,.02],[.09,1.03,.08],.035],
 ['Gluteus maximus','abdpelvis',[.05,1.0,-.1],[.12,.85,-.05],.06],
 ['Rectus femoris','leg',[.085,.93,.05],[.09,.54,.045],.032],
 ['Vastus lateralis','leg',[.13,.9,.02],[.11,.53,.035],.037],
 ['Vastus medialis','leg',[.06,.78,.04],[.075,.52,.04],.03],
 ['Hamstrings','leg',[.09,.9,-.05],[.09,.5,-.045],.04],
 ['Gastrocnemius','leg',[.085,.5,-.045],[.07,.2,-.035],.04],
 ['Tibialis anterior','leg',[.095,.48,.03],[.075,.1,.03],.02],
 ['Sternocleidomastoid','neck',[.06,1.6,-.03],[.02,1.44,.05],.013],
 ['Masseter','head',[.06,1.62,.02],[.05,1.56,.03],.012]
];
M.forEach(([nm,reg,a,b,r]) => both((P,n) => A('muscle',reg,n(nm), spindle(P(...a),P(...b),r))));

// ---------- Nerves ----------
const cord = []; for (let y=1.6;y>=1.17;y-=.04) cord.push(V(0,y,zS(y)-.012));
A('nerve','thorax','Spinal cord', tube(cord,.006));
const cauda = [V(0,1.17,zS(1.17)-.012),V(0,1.05,-.075),V(0,.95,-.085)];
A('nerve','abdpelvis','Cauda equina', tube(cauda,.004));
const N = [
 ['Brachial plexus','neck',[[.04,1.52,-.06],[.15,1.45,-.02],[.19,1.4,0]],.004],
 ['Median nerve','arm',[[.19,1.4,0],[.2,1.25,0],[.215,1.12,.015],[.235,.9,.035],[.24,.86,.04]],.0025],
 ['Radial nerve','arm',[[.19,1.4,-.02],[.2,1.3,-.04],[.22,1.2,-.02],[.225,1.1,.01],[.255,.88,.01]],.0025],
 ['Ulnar nerve','arm',[[.19,1.4,-.005],[.2,1.25,-.015],[.2,1.13,-.03],[.222,.9,.02],[.23,.86,.045]],.0025],
 ['Vagus nerve','neck',[[.015,1.58,-.01],[.025,1.45,.01],[.03,1.3,.04]],.0025],
 ['Femoral nerve','leg',[[.05,1.05,0],[.06,.98,.03],[.08,.9,.045],[.085,.7,.05],[.085,.52,.05]],.003],
 ['Sciatic nerve','leg',[[.05,.96,-.08],[.08,.88,-.06],[.09,.7,-.05],[.09,.52,-.045]],.006],
 ['Tibial nerve','leg',[[.09,.52,-.045],[.08,.3,-.035],[.075,.08,-.02]],.004],
 ['Common peroneal nerve','leg',[[.09,.52,-.045],[.12,.5,-.01],[.1,.4,.02],[.085,.1,.03]],.003]
];
N.forEach(([nm,reg,pts,r]) => both((P,n) => A('nerve',reg,n(nm), tube(pts.map(p=>P(...p)),r))));

// ---------- Vessels ----------
A('artery','abdpelvis','Abdominal aorta', tube([V(.005,1.35,-.025),V(0,1.2,-.035),V(-.01,1.0,-.04)].map(p=>p),.011));
A('vein','abdpelvis','Inferior vena cava', tube([V(.02,1.38,-.03),V(.025,1.0,-.04)],.012));
both((P,n) => {
  A('artery','leg',n('Femoral–popliteal–tibial artery'), tube([P(0,1,-.04),P(.04,.95,0),P(.07,.9,.04),P(.085,.7,.045),P(.09,.52,.01),P(.085,.3,-.01),P(.08,.08,.02)],.005));
  A('vein','leg',n('Femoral–popliteal vein'), tube([P(.03,.95,0),P(.058,.9,.04),P(.073,.7,.045),P(.078,.52,.01),P(.073,.3,-.01),P(.068,.08,.02)],.0045));
  A('artery','arm',n('Subclavian–brachial–radial artery'), tube([P(.03,1.42,0),P(.18,1.43,0),P(.2,1.3,.01),P(.215,1.12,.02),P(.235,.87,.04)],.004));
});

// ---------- Real anatomical model (Z-Anatomy) ----------
let usingModel = false;
function onModel(scene){
  if (!usingModel){ parts.splice(0).forEach(p => root.remove(p)); grid.visible = true; usingModel = true; }
  scene.children.slice().forEach(o => {
    const [s, r, ...nm] = o.name.split('__');
    if (SYS[s] && REG[r]) A(s, r, nm.join(' ').replace(/_/g,' '), o);
  });
  apply(); buildList();
}
const gl = new THREE.GLTFLoader(), requested = new Set();
const infoEl = () => document.getElementById('info');
function b64buf(b64){ const bin = atob(b64), u = new Uint8Array(bin.length); for (let i=0;i<bin.length;i++) u[i] = bin.charCodeAt(i); return u.buffer; }
async function getFile(name){
  if (window.EMBED && window.EMBED[name]) return b64buf(window.EMBED[name]);   // preview page: data is inside the page
  const r = await fetch('models/' + name); if (!r.ok) throw new Error('HTTP ' + r.status + ' for models/' + name);
  return r.arrayBuffer();
}
let chain = Promise.resolve();
function ensure(sys){                                   // load a system's model files once, one at a time
  (FILES[sys] || []).forEach(f => {
    if (requested.has(f)) return; requested.add(f);
    chain = chain.then(async () => {
      infoEl().textContent = 'Loading ' + f + '…';
      try { const buf = await getFile(f); const g = await new Promise((ok, no) => gl.parse(buf, '', ok, no));
        onModel(g.scene); infoEl().textContent = `${parts.length} structures loaded. Click any structure to identify it.`; }
      catch (e) { requested.delete(f); infoEl().textContent = 'Could not load ' + f + ': ' + (e.message || e); }
    });
  });
}

// ---------- UI state ----------
const sysOn = {}, regOn = {}, opac = {}, sysEls = {};
Object.keys(SYS).forEach(k => { sysOn[k] = ['bone','cartilage'].includes(k); opac[k] = ['muscle','organ'].includes(k) ? .6 : 1; });
Object.keys(REG).forEach(k => regOn[k] = true);

function apply(){
  parts.forEach(p => {
    const u = p.userData;
    p.visible = sysOn[u.sys] && regOn[u.reg] && !u.off;
    u.mat.opacity = opac[u.sys]; u.mat.transparent = opac[u.sys] < 1; u.mat.depthWrite = opac[u.sys] >= .95;
  });
}
function syncChecks(){ document.querySelectorAll('input[data-reg]').forEach(i => i.checked = regOn[i.dataset.reg]); }

const sysBox = document.getElementById('systems'), regBox = document.getElementById('regions');
Object.entries(SYS).filter(([k]) => SHOWN.includes(k)).forEach(([k,s]) => {
  const d = document.createElement('div'); d.className = 'item';
  d.innerHTML = `<label><input type="checkbox" ${sysOn[k]?'checked':''}><span class="dot" style="background:#${s.c.toString(16).padStart(6,'0')}"></span>${s.n}</label><input type="range" min="0.1" max="1" step="0.05" value="${opac[k]}" aria-label="${s.n} opacity">`;
  sysEls[k] = d.querySelector('input[type=checkbox]');
  sysEls[k].onchange = e => { sysOn[k] = e.target.checked; if (e.target.checked) ensure(k); apply(); };
  d.querySelector('input[type=range]').oninput = e => { opac[k] = +e.target.value; apply(); };
  sysBox.appendChild(d);
});
Object.entries(REG).forEach(([k,n]) => {
  const d = document.createElement('div'); d.className = 'item';
  d.innerHTML = `<label><input type="checkbox" data-reg="${k}" checked>${n}</label><button>Only</button>`;
  d.querySelector('input').onchange = e => { regOn[k] = e.target.checked; apply(); };
  d.querySelector('button').onclick = () => { Object.keys(REG).forEach(r => regOn[r] = r === k); syncChecks(); apply(); focusRegion(k); };
  regBox.appendChild(d);
});
document.getElementById('allOn').onclick = () => { Object.keys(REG).forEach(r => regOn[r] = true); syncChecks(); apply(); };
document.getElementById('reset').onclick = resetView;

function setLayers(list){ SHOWN.forEach(k => { const on = list.includes(k); sysOn[k] = on; if (sysEls[k]) sysEls[k].checked = on; if (on) ensure(k); }); apply(); }
document.getElementById('allLayers').onclick = () => setLayers(SHOWN);
document.getElementById('boneOnly').onclick = () => setLayers(['bone','cartilage']);

// Frame the camera on the visible region
function focusRegion(k){
  const box = new THREE.Box3();
  parts.forEach(p => { if (p.userData.reg === k) box.expandByObject(p); });
  if (box.isEmpty()) return;
  const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3()).length();
  controls.target.copy(c); camera.position.set(c.x, c.y + s*.1, c.z + Math.max(s*1.5, .6)); controls.update();
}

// ---------- Part list & search ----------
const ALIAS = {wrist:'scaphoid|lunate|triquetrum|pisiform|trapez|capitate|hamate', skull:'frontal|parietal|occipital|temporal bone|sphenoid|ethmoid|maxilla|zygomatic|nasal bone|lacrimal|palatine|vomer|concha|mandible',
  hand:'metacarpal|of hand|scaphoid|lunate|triquetrum|pisiform|trapez|capitate|hamate', foot:'metatarsal|of foot|calcaneus|talus|cuboid|navicular|cuneiform|sesamoid',
  teeth:'tooth|canine|incisor|premolar|molar', ribs:'rib', spine:'vertebra|atlas|axis|sacrum|coccyx'};
const qEl = document.getElementById('q'), listEl = document.getElementById('parts');
function matches(p){
  const q = qEl.value.trim().toLowerCase(); if (!q) return true;
  const u = p.userData, hay = `${u.name} ${REG[u.reg]} ${SYS[u.sys].n}`.toLowerCase();
  return ALIAS[q] ? new RegExp(ALIAS[q]).test(hay) : q.split(/\s+/).every(w => hay.includes(w));
}
function buildList(){
  listEl.innerHTML = '';
  const ms = parts.filter(matches).sort((a,b) => a.userData.name.localeCompare(b.userData.name));
  document.getElementById('count').textContent = `(${ms.length})`;
  ms.slice(0,300).forEach(p => {
    const d = document.createElement('div'); d.className = 'item';
    d.innerHTML = `<label><input type="checkbox" ${p.userData.off?'':'checked'}><span class="pn"></span></label><button>Find</button>`;
    d.querySelector('.pn').textContent = p.userData.name;
    d.querySelector('input').onchange = e => { p.userData.off = !e.target.checked; if (e.target.checked){ const u = p.userData; sysOn[u.sys] = regOn[u.reg] = true; if (sysEls[u.sys]) sysEls[u.sys].checked = true; syncChecks(); } apply(); };
    d.querySelector('button').onclick = () => select(p, true);
    listEl.appendChild(d);
  });
}
qEl.oninput = buildList;
document.getElementById('onlyListed').onclick = () => { Object.keys(REG).forEach(r => regOn[r] = true); syncChecks(); parts.forEach(p => { p.userData.off = !matches(p); if (!p.userData.off){ const k = p.userData.sys; sysOn[k] = true; if (sysEls[k]) sysEls[k].checked = true; } }); apply(); buildList(); };
document.getElementById('showAllParts').onclick = () => { parts.forEach(p => p.userData.off = false); apply(); buildList(); };
buildList();

// ---------- Selection ----------
let sel = null; const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(); let down = null;
function select(p, focus){
  if (sel) sel.userData.mat.emissive.setHex(0);
  sel = p; const info = document.getElementById('info');
  if (!p){ info.textContent = 'Click any structure to identify it.'; return; }
  if (p.userData.off || !p.visible){ p.userData.off = false; sysOn[p.userData.sys] = true; regOn[p.userData.reg] = true; if (sysEls[p.userData.sys]) sysEls[p.userData.sys].checked = true; syncChecks(); apply(); buildList(); }
  p.userData.mat.emissive.setHex(0x554400);
  info.innerHTML = `<b></b> — ${SYS[p.userData.sys].n}, ${REG[p.userData.reg]}`; info.querySelector('b').textContent = p.userData.name;
  if (focus){
    const b = new THREE.Box3().setFromObject(p), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()).length();
    controls.target.copy(c); camera.position.copy(c).add(new THREE.Vector3(0, s*.2, Math.max(s*2.5, .25))); controls.update();
  }
}
canvas.addEventListener('pointerdown', e => down = [e.clientX, e.clientY]);
canvas.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX-down[0], e.clientY-down[1]) > 4) return;
  const r = canvas.getBoundingClientRect();
  mouse.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
  ray.setFromCamera(mouse, camera);
  const meshes = []; parts.forEach(p => p.visible && p.traverse(o => o.isMesh && meshes.push(o)));
  const hit = ray.intersectObjects(meshes)[0];
  select(hit ? hit.object.userData.part : null, false);
});

// ---------- Loop ----------
function resize(){ const m = canvas.parentElement; renderer.setSize(m.clientWidth, m.clientHeight, false); camera.aspect = m.clientWidth/m.clientHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
ensure('bone');
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });

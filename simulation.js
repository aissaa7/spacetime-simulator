// Canvas WebGL
const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl');
gl.getExtension('OES_element_index_uint');


// ═══════════════════════════════════════
//   CURSEUR SATURNE ANIMÉ
// ═══════════════════════════════════════
const cursorCanvas = document.createElement('canvas');
cursorCanvas.style.cssText = `
    position: fixed;
    top: 0; left: 0;
    width: 100vw; height: 100vh;
    pointer-events: none;
    z-index: 9999;
`;
document.body.appendChild(cursorCanvas);
const cursorCtx = cursorCanvas.getContext('2d');

let cursorX = -100, cursorY = -100;
let ring1X  = -100, ring1Y  = -100;
let ring2X  = -100, ring2Y  = -100;

// Suivre la souris / touchpad
document.addEventListener('mousemove', e => {
    cursorX = e.clientX;
    cursorY = e.clientY;
});

// ═══════════════════════════════════════
//   TOUCHPAD / TACTILE — 1 doigt = tourner
//   comme une tablette !
// ═══════════════════════════════════════
let touchStart    = null;
let lastTouchDist = 0;
let touchMoved    = false;
let touchTime     = 0;

canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    touchMoved = false;
    touchTime  = Date.now();

    if (e.touches.length === 1) {
        touchStart = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
        };
        // Mettre à jour position curseur
        cursorX = e.touches[0].clientX;
        cursorY = e.touches[0].clientY;
    }
    if (e.touches.length === 2) {
        const dx = e.touches[0].clientX
                 - e.touches[1].clientX;
        const dy = e.touches[0].clientY
                 - e.touches[1].clientY;
        lastTouchDist = Math.sqrt(dx*dx+dy*dy);
    }
}, {passive: false});

canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    touchMoved = true;

    // 1 doigt → tourner caméra (comme tablette)
    if (e.touches.length === 1 && touchStart) {
        const dx = e.touches[0].clientX
                 - touchStart.x;
        const dy = e.touches[0].clientY
                 - touchStart.y;
        angleY += dx * 0.4;
        angleX += dy * 0.4;
        angleX  = Math.max(10, Math.min(80, angleX));
        touchStart = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
        };
        // Mettre à jour curseur
        cursorX = e.touches[0].clientX;
        cursorY = e.touches[0].clientY;
    }

    // 2 doigts → zoom (pincer/écarter)
    if (e.touches.length === 2) {
        const dx = e.touches[0].clientX
                 - e.touches[1].clientX;
        const dy = e.touches[0].clientY
                 - e.touches[1].clientY;
        const dist = Math.sqrt(dx*dx+dy*dy);
        zoom -= (dist - lastTouchDist) * 0.01;
        zoom  = Math.max(1.5, Math.min(6, zoom));
        lastTouchDist = dist;
    }
}, {passive: false});

canvas.addEventListener('touchend', e => {
    e.preventDefault();
    const duree = Date.now() - touchTime;

    // Tap court (< 200ms) sans mouvement → placer
    if (!touchMoved && duree < 200
        && e.changedTouches.length === 1) {
        const fakeEvent = {
            clientX: e.changedTouches[0].clientX,
            clientY: e.changedTouches[0].clientY
        };
        placerObjet(fakeEvent);
    }
    touchStart = null;
}, {passive: false});

function dessinerCurseur() {
    cursorCanvas.width  = window.innerWidth;
    cursorCanvas.height = window.innerHeight;
    cursorCtx.clearRect(0, 0,
        cursorCanvas.width,
        cursorCanvas.height);

    // Lerp (interpolation douce)
    // Anneau 1 : rapide
    ring1X += (cursorX - ring1X) * 0.25;
    ring1Y += (cursorY - ring1Y) * 0.25;
    // Anneau 2 : lent
    ring2X += (cursorX - ring2X) * 0.10;
    ring2Y += (cursorY - ring2Y) * 0.10;

    const t = Date.now() / 1000;

    // ── Anneau 2 (lent, grand, transparent)
    cursorCtx.save();
    cursorCtx.translate(ring2X, ring2Y);
    cursorCtx.rotate(t * 0.8);
    cursorCtx.beginPath();
    cursorCtx.ellipse(0, 0, 22, 8, 0, 0, Math.PI*2);
    cursorCtx.strokeStyle = 'rgba(0,180,255,0.25)';
    cursorCtx.lineWidth = 4;
    cursorCtx.stroke();
    cursorCtx.restore();

    // ── Anneau 1 (rapide, moyen)
    cursorCtx.save();
    cursorCtx.translate(ring1X, ring1Y);
    cursorCtx.rotate(-t * 1.5);
    cursorCtx.beginPath();
    cursorCtx.ellipse(0, 0, 16, 6, 0, 0, Math.PI*2);
    cursorCtx.strokeStyle = 'rgba(0,212,255,0.45)';
    cursorCtx.lineWidth = 2.5;
    cursorCtx.stroke();
    cursorCtx.restore();

    // ── Planète centrale (suit le curseur exactement)
    // Ombre
    const grad = cursorCtx.createRadialGradient(
        cursorX-3, cursorY-3, 0,
        cursorX,   cursorY,   10);
    grad.addColorStop(0,   'rgba(100,200,255,0.9)');
    grad.addColorStop(0.5, 'rgba(0,100,200,0.7)');
    grad.addColorStop(1,   'rgba(0,30,80,0.4)');

    cursorCtx.beginPath();
    cursorCtx.arc(cursorX, cursorY, 8, 0, Math.PI*2);
    cursorCtx.fillStyle = grad;
    cursorCtx.fill();

    // Reflet
    cursorCtx.beginPath();
    cursorCtx.arc(cursorX-2, cursorY-2, 3, 0, Math.PI*2);
    cursorCtx.fillStyle = 'rgba(255,255,255,0.6)';
    cursorCtx.fill();

    requestAnimationFrame(dessinerCurseur);
}

// Cacher le curseur original
document.body.style.cursor = 'none';
dessinerCurseur();

// ═══════════════════════════════════════
//   FULLSCREEN (touche F)
// ═══════════════════════════════════════
document.addEventListener('keydown', e => {
    if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) {
            document.documentElement
                    .requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }
});

// Taille correcte
function redimensionner() {
    const sim = document.getElementById('simulation');
    const w = sim.offsetWidth;
    const h = sim.offsetHeight;
    if (w > 0 && h > 0) {
        canvas.width  = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
    }
}
redimensionner();
window.addEventListener('resize', redimensionner);

// ── Shaders
const VS = `
attribute vec3 aPos;
uniform mat4 uMVP;
void main() {
    gl_Position = uMVP * vec4(aPos, 1.0);
}`;

const FS = `
precision mediump float;
uniform vec3 uColor;
void main() {
    gl_FragColor = vec4(uColor, 1.0);
}`;

// Compiler shader
function makeShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        console.error(gl.getShaderInfoLog(s));
    return s;
}

// Créer programme
const prog = gl.createProgram();
gl.attachShader(prog, makeShader(gl.VERTEX_SHADER, VS));
gl.attachShader(prog, makeShader(gl.FRAGMENT_SHADER, FS));
gl.linkProgram(prog);
gl.useProgram(prog);

const aPos   = gl.getAttribLocation(prog, 'aPos');
const uMVP   = gl.getUniformLocation(prog, 'uMVP');
const uColor = gl.getUniformLocation(prog, 'uColor');

// ── Matrices
function perspective(fov, aspect, near, far) {
    const f  = 1.0 / Math.tan(fov * 0.5);
    const nf = 1.0 / (near - far);
    // Column-major order pour WebGL
    return new Float32Array([
        f/aspect, 0, 0,  0,
        0,        f, 0,  0,
        0,        0, (far+near)*nf, -1,
        0,        0, 2*far*near*nf,  0
    ]);
}

function lookAt(ex, ey, ez, cx, cy, cz) {
    // Direction Z
    let zx = ex-cx, zy = ey-cy, zz = ez-cz;
    let zl = Math.sqrt(zx*zx+zy*zy+zz*zz);
    zx/=zl; zy/=zl; zz/=zl;

    // Direction X (right)
    let xx = zy*0 - zz*1; // cross(z, up) up=(0,1,0)
    let xy = zz*0 - zx*0;
    let xz = zx*1 - zy*0;
    // Correction : cross(up, z)
    xx = 1*zz - 0*zy;
    xy = 0*zx - 0*zz;
    xz = 0*zy - 1*zx;
    let xl = Math.sqrt(xx*xx+xy*xy+xz*xz);
    xx/=xl; xy/=xl; xz/=xl;

    // Direction Y
    let yx = zy*xz - zz*xy;
    let yy = zz*xx - zx*xz;
    let yz = zx*xy - zy*xx;

    // Translation
    const tx = -(xx*ex + xy*ey + xz*ez);
    const ty = -(yx*ex + yy*ey + yz*ez);
    const tz = -(zx*ex + zy*ey + zz*ez);

    return new Float32Array([
        xx, yx, zx, 0,
        xy, yy, zy, 0,
        xz, yz, zz, 0,
        tx, ty, tz,  1
    ]);
}

function multiply(a, b) {
    const out = new Float32Array(16);
    for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
        let sum = 0;
        for (let k = 0; k < 4; k++)
            sum += a[i + k*4] * b[k + j*4];
        out[i + j*4] = sum;
    }
    return out;
}

// ── Caméra
let angleX = 40, angleY = 20, zoom = 2.5;
let dragging = false, lastX = 0, lastY = 0;

let altPressed = false;
document.addEventListener('keydown', e => {
    if (e.key === 'Alt') altPressed = true;
});
document.addEventListener('keyup', e => {
    if (e.key === 'Alt') altPressed = false;
});

canvas.addEventListener('mousedown', e => {
    // Tourner : clic droit OU milieu OU ALT+gauche
    if (e.button === 2 || e.button === 1 ||
       (e.button === 0 && altPressed)) {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
    }
    // Placer : clic gauche SANS ALT
    if (e.button === 0 && !altPressed) {
        placerObjet(e);
    }
});
canvas.addEventListener('mouseup',   () => dragging = false);
canvas.addEventListener('mousemove', e => {
    if (!dragging) return;
    angleY += (e.clientX - lastX) * 0.5;
    angleX += (e.clientY - lastY) * 0.5;
    angleX = Math.max(10, Math.min(80, angleX));
    lastX = e.clientX;
    lastY = e.clientY;
});
canvas.addEventListener('wheel', e => {
    zoom += e.deltaY * 0.005;
    zoom = Math.max(1.5, Math.min(6, zoom));
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
    if (e.key === 'r' || e.key === 'R') reset();
});

// ── Objets
let objets = [];
let typeSelectionne = 0;

const CONFIG = [
    // 0 - Étoile — très massive, fixe
    {
        masse:   0.15,
        couleur: [1.0, 0.85, 0.2],
        rayon:   0.12,
        nom:     'Étoile'
    },
    // 1 - Planète — mobile, moyenne
    {
        masse:   0.02,
        couleur: [0.2, 0.5, 1.0],
        rayon:   0.07,
        nom:     'Planète'
    },
    // 2 - Trou noir — extrêmement massif
    {
        masse:   0.45,
        couleur: [0.5, 0.0, 1.0],
        rayon:   0.0,
        nom:     'Trou Noir'
    },
    // 3 - Astéroïde — très léger
    {
        masse:   0.005,
        couleur: [0.6, 0.4, 0.2],
        rayon:   0.02,
        nom:     'Astéroïde'
    },
    // 4 - Trou de ver
    {
        masse:   0.05,
        couleur: [0.0, 1.0, 0.8],
        rayon:   0.06,
        nom:     'Trou de Ver'
    }
];
function selectionner(t) {
    typeSelectionne = t;
    document.querySelectorAll('.btn-objet')
            .forEach(b => b.classList.remove('actif'));
    const ids = ['btn-etoile','btn-planete',
             'btn-trou','btn-asteroide',
             'btn-trou-ver'];
    document.getElementById(ids[t])
            .classList.add('actif');
}

function reset() {
    objets = [];
    document.getElementById('info-objets')
            .textContent = 'Objets : 0';
}


// ── Placer objet avec Ray Casting
function placerObjet(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const W  = canvas.width;
    const H  = canvas.height;

    const ndcX = (mx / W) * 2 - 1;
    const ndcY = 1 - (my / H) * 2;

    const {proj, view} = getMatrices();
    const VP    = multiply(proj, view);
    const invVP = mat4Inverse(VP);

    function transform(m, v) {
        return [
            m[0]*v[0]+m[4]*v[1]+m[8]*v[2] +m[12]*v[3],
            m[1]*v[0]+m[5]*v[1]+m[9]*v[2] +m[13]*v[3],
            m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]*v[3],
            m[3]*v[0]+m[7]*v[1]+m[11]*v[2]+m[15]*v[3],
        ];
    }

    let near = transform(invVP, [ndcX,ndcY,-1,1]);
    let far  = transform(invVP, [ndcX,ndcY, 1,1]);
    for(let i=0;i<3;i++) near[i]/=near[3];
    for(let i=0;i<3;i++) far[i] /=far[3];

    const dx = far[0]-near[0];
    const dy = far[1]-near[1];
    const dz = far[2]-near[2];

    if (Math.abs(dy) < 0.0001) return;

    const t = -near[1] / dy;
    let wx = near[0] + dx*t;
    let wz = near[2] + dz*t;

    wx = Math.max(-0.95, Math.min(0.95, wx));
    wz = Math.max(-0.95, Math.min(0.95, wz));

    const cfg = CONFIG[typeSelectionne];
    objets.push({
        x: wx, y: wz,
        type: typeSelectionne,
        masse: cfg.masse,
        vx: 0, vy: 0
    });

    document.getElementById('info-objets')
            .textContent = `Objets : ${objets.length}`;
            
}

// ── Matrices caméra
function getMatrices() {
    const rx = angleX * Math.PI / 180;
    const ry = angleY * Math.PI / 180;
    const ex = zoom * Math.sin(ry) * Math.cos(rx);
    const ey = zoom * Math.sin(rx);
    const ez = zoom * Math.cos(ry) * Math.cos(rx);
    const view = lookAt(ex, ey, ez, 0, 0, 0);
    const proj = perspective(
        45*Math.PI/180,
        canvas.width/canvas.height,
        0.1, 100);
    return {proj, view};
}

// ── Inverse matrice 4x4
function mat4Inverse(m) {
    const inv = new Float32Array(16);
    inv[0]  =  m[5]*m[10]*m[15]-m[5]*m[11]*m[14]
              -m[9]*m[6]*m[15] +m[9]*m[7]*m[14]
              +m[13]*m[6]*m[11]-m[13]*m[7]*m[10];
    inv[4]  = -m[4]*m[10]*m[15]+m[4]*m[11]*m[14]
              +m[8]*m[6]*m[15] -m[8]*m[7]*m[14]
              -m[12]*m[6]*m[11]+m[12]*m[7]*m[10];
    inv[8]  =  m[4]*m[9]*m[15] -m[4]*m[11]*m[13]
              -m[8]*m[5]*m[15] +m[8]*m[7]*m[13]
              +m[12]*m[5]*m[11]-m[12]*m[7]*m[9];
    inv[12] = -m[4]*m[9]*m[14] +m[4]*m[10]*m[13]
              +m[8]*m[5]*m[14] -m[8]*m[6]*m[13]
              -m[12]*m[5]*m[10]+m[12]*m[6]*m[9];
    inv[1]  = -m[1]*m[10]*m[15]+m[1]*m[11]*m[14]
              +m[9]*m[2]*m[15] -m[9]*m[3]*m[14]
              -m[13]*m[2]*m[11]+m[13]*m[3]*m[10];
    inv[5]  =  m[0]*m[10]*m[15]-m[0]*m[11]*m[14]
              -m[8]*m[2]*m[15] +m[8]*m[3]*m[14]
              +m[12]*m[2]*m[11]-m[12]*m[3]*m[10];
    inv[9]  = -m[0]*m[9]*m[15] +m[0]*m[11]*m[13]
              +m[8]*m[1]*m[15] -m[8]*m[3]*m[13]
              -m[12]*m[1]*m[11]+m[12]*m[3]*m[9];
    inv[13] =  m[0]*m[9]*m[14] -m[0]*m[10]*m[13]
              -m[8]*m[1]*m[14] +m[8]*m[2]*m[13]
              +m[12]*m[1]*m[10]-m[12]*m[2]*m[9];
    inv[2]  =  m[1]*m[6]*m[15] -m[1]*m[7]*m[14]
              -m[5]*m[2]*m[15] +m[5]*m[3]*m[14]
              +m[13]*m[2]*m[7] -m[13]*m[3]*m[6];
    inv[6]  = -m[0]*m[6]*m[15] +m[0]*m[7]*m[14]
              +m[4]*m[2]*m[15] -m[4]*m[3]*m[14]
              -m[12]*m[2]*m[7] +m[12]*m[3]*m[6];
    inv[10] =  m[0]*m[5]*m[15] -m[0]*m[7]*m[13]
              -m[4]*m[1]*m[15] +m[4]*m[3]*m[13]
              +m[12]*m[1]*m[7] -m[12]*m[3]*m[5];
    inv[14] = -m[0]*m[5]*m[14] +m[0]*m[6]*m[13]
              +m[4]*m[1]*m[14] -m[4]*m[2]*m[13]
              -m[12]*m[1]*m[6] +m[12]*m[2]*m[5];
    inv[3]  = -m[1]*m[6]*m[11] +m[1]*m[7]*m[10]
              +m[5]*m[2]*m[11] -m[5]*m[3]*m[10]
              -m[9]*m[2]*m[7]  +m[9]*m[3]*m[6];
    inv[7]  =  m[0]*m[6]*m[11] -m[0]*m[7]*m[10]
              -m[4]*m[2]*m[11] +m[4]*m[3]*m[10]
              +m[8]*m[2]*m[7]  -m[8]*m[3]*m[6];
    inv[11] = -m[0]*m[5]*m[11] +m[0]*m[7]*m[9]
              +m[4]*m[1]*m[11] -m[4]*m[3]*m[9]
              -m[8]*m[1]*m[7]  +m[8]*m[3]*m[5];
    inv[15] =  m[0]*m[5]*m[10] -m[0]*m[6]*m[9]
              -m[4]*m[1]*m[10] +m[4]*m[2]*m[9]
              +m[8]*m[1]*m[6]  -m[8]*m[2]*m[5];
    let det = m[0]*inv[0]+m[1]*inv[4]
             +m[2]*inv[8]+m[3]*inv[12];
    if (det === 0) return new Float32Array(16);
    det = 1/det;
    for(let i=0;i<16;i++) inv[i]*=det;
    return inv;
}

// ── Grille 3D
function creerGrille(n) {
    const pts = [], idx = [];
    const N = n+1, pas = 2/n;
    for(let i=0;i<N;i++)
    for(let j=0;j<N;j++) {
        let x = -1+j*pas, z = -1+i*pas, y = 0;
        for(const o of objets) {
            const dx = x-o.x, dz = z-o.y;
            const d  = Math.max(Math.sqrt(dx*dx+dz*dz),0.01);
           let def = o.masse/(d*d);
// Courbure proportionnelle à la masse
const courbMax = o.masse * 25.0;
const courbAmp = o.masse * 15.0;
def = Math.min(def, Math.max(courbMax, 0.5));
y -= def * Math.max(courbAmp, 0.8) * 0.1;
        }
        pts.push(x,y,z);
    }
    for(let i=0;i<N;i++)
    for(let j=0;j<N-1;j++)
        idx.push(i*N+j, i*N+j+1);
    for(let i=0;i<N-1;i++)
    for(let j=0;j<N;j++)
        idx.push(i*N+j, (i+1)*N+j);
    return {pts, idx};
}

// ── Sphère 3D
function creerSphere(cx,cy,cz,r,seg) {
    const pts=[], PI=Math.PI;
    for(let i=1;i<seg;i++) {
        const phi=PI*i/seg, y=cy+r*Math.cos(phi),
              rr=r*Math.sin(phi);
        for(let j=0;j<=seg;j++) {
            const th=2*PI*j/seg;
            pts.push(cx+rr*Math.cos(th),y,
                     cz+rr*Math.sin(th));
        }
    }
    for(let j=0;j<seg;j++) {
        const th=2*PI*j/seg;
        for(let i=0;i<=seg;i++) {
            const phi=PI*i/seg;
            pts.push(cx+r*Math.sin(phi)*Math.cos(th),
                     cy+r*Math.cos(phi),
                     cz+r*Math.sin(phi)*Math.sin(th));
        }
    }
    return pts;
}

// ── Mélanger deux couleurs selon les masses
function melangerCouleurs(c1, c2, m1, m2) {
    const total = m1 + m2;
    return [
        (c1[0]*m1 + c2[0]*m2) / total,
        (c1[1]*m1 + c2[1]*m2) / total,
        (c1[2]*m1 + c2[2]*m2) / total,
    ];
}

// ── Système de flash d'absorption
let flashs = [];

function creerFlash(x, y) {
    flashs.push({
        x, y,
        rayon:  0.0,
        alpha:  1.0,
        vitesse: 0.05
    });
}

function mettreAJourFlashs() {
    flashs = flashs.filter(f => f.alpha > 0);
    for (const f of flashs) {
        f.rayon += f.vitesse;
        f.alpha -= 0.04;
        f.vitesse *= 0.95;
    }
}

// ═══════════════════════════════════════
//   AJOUTER UNE ORBITE AUTOMATIQUE
// ═══════════════════════════════════════
// function ajouterOrbite(typeSource, typeSatellite,
//                         distance) {
//     // Trouver l'objet source le plus massif
//     // du bon type
//     const source = objets.reduce((best, o) => {
//         if (o.type !== typeSource) return best;
//         if (!best) return o;
//         return o.masse > best.masse ? o : best;
//     }, null);

//     if (!source) {
//         alert('Place d\'abord une '
//               + CONFIG[typeSource].nom
//               + ' !');
//         return;
//     }

//     // Position : autour de la source
//     const angle = Math.random() * Math.PI * 2;
//     const sx    = source.x + Math.cos(angle)*distance;
//     const sy    = source.y + Math.sin(angle)*distance;

//     // Limiter dans la grille
//     if (Math.abs(sx) > 0.9 || Math.abs(sy) > 0.9) {
//         alert('Trop près du bord ! '
//               + 'Place la source plus au centre.');
//         return;
//     }

//     // ── Vitesse orbitale de Kepler
//     // v = √(G×M / r)
//     // Le petit tourne autour du grand !
//     const G           = 0.0008;
//     const vitOrbitale = Math.sqrt(
//         G * source.masse / distance);

//     // Direction perpendiculaire au rayon
//     // (pour une orbite circulaire)
//     const vx = -Math.sin(angle) * vitOrbitale;
//     const vy =  Math.cos(angle) * vitOrbitale;

//     const cfg = CONFIG[typeSatellite];
//     objets.push({
//         x:       sx,
//         y:       sy,
//         type:    typeSatellite,
//         masse:   cfg.masse,
//         vx:      vx + source.vx, // hérite vitesse source
//         vy:      vy + source.vy,
//         couleur: null
//     });

//     console.log('Orbite créée !',
//                 'v =', vitOrbitale.toFixed(4));
// }

// ═══════════════════════════════════════
//   TROU DE VER
// ═══════════════════════════════════════

// Trouver les paires de trous de ver
function getTrousDeVer() {
    return objets.filter(o => o.type === 4);
}

// Téléporter les objets proches
function gererTrouDeVer() {
    const vers = objets.filter(o => o.type === 4);
    if (vers.length < 2) return;

    for (const obj of objets) {
        if (obj.type === 4) continue;
        if (obj.enTeleportation) continue;

        for (let i = 0; i < vers.length; i++) {
            const v1   = vers[i];
            const dx   = obj.x - v1.x;
            const dz   = obj.y - v1.y;
            const dist = Math.sqrt(dx*dx + dz*dz);

            if (dist < 0.06) {
                // Trouver le partenaire
                let v2   = null;
                let minD = 999;
                for (let j=0; j<vers.length; j++) {
                    if (vers[j] === v1) continue;
                    const d = Math.sqrt(
                        Math.pow(vers[j].x-v1.x,2)+
                        Math.pow(vers[j].y-v1.y,2));
                    if (d < minD) {
                        minD = d;
                        v2   = vers[j];
                    }
                }

                if (v2) {
                    // Bloquer pendant traversée
                    obj.enTeleportation = true;
                    obj.tunnelProgress  = 0.0;
                    obj.vx = 0;
                    obj.vy = 0;

                    // Destination de sortie
                    const angleSort = Math.random()
                                    * Math.PI * 2;
                    obj.tunnelDest = {
                        x:     v2.x,
                        y:     v2.y,
                        angle: angleSort
                    };

                    creerFlash(v1.x, v1.y);

                    // Téléporter après traversée
                    setTimeout(() => {
                        if (!obj.tunnelDest) return;

                        const a = obj.tunnelDest.angle;

                        // Éjecter avec force suffisante
                        // pour s'éloigner avant que
                        // la gravité reprenne !
                        const vitSort = 0.025;
                        obj.x  = obj.tunnelDest.x
                                + Math.cos(a)*0.12;
                        obj.y  = obj.tunnelDest.y
                                + Math.sin(a)*0.12;
                        obj.vx = Math.cos(a)*vitSort;
                        obj.vy = Math.sin(a)*vitSort;

                        obj.tunnelDest      = undefined;
                        obj.tunnelProgress  = undefined;
                        obj.enTeleportation = false;

                        creerFlash(
                            obj.tunnelDest?.x || obj.x,
                            obj.tunnelDest?.y || obj.y);
                    }, 1000);
                }
                break;
            }
        }
    }
}
// ── Physique
function physique() {
    const dt = 0.0005;

    // Rayons de collision pour tous les types
    // incluant trou noir et trou de ver !
    const rayons = [0.12, 0.07, 0.10, 0.02, 0.06];

    const del = new Array(objets.length).fill(false);

    // ── Collisions
    for(let i=0; i<objets.length; i++)
    for(let j=i+1; j<objets.length; j++) {
        if(del[i] || del[j]) continue;

        // Les trous de ver ne fusionnent pas
        if(objets[i].type===4 ||
           objets[j].type===4) continue;

        const dx = objets[j].x - objets[i].x;
        const dz = objets[j].y - objets[i].y;
        const d  = Math.sqrt(dx*dx + dz*dz);
        const s  = rayons[objets[i].type]
                 + rayons[objets[j].type];

        if(d < s * 0.5) {
            // Le plus massif absorbe le plus léger
            if(objets[i].masse >= objets[j].masse) {
                objets[i].couleur = melangerCouleurs(
                    CONFIG[objets[i].type].couleur,
                    CONFIG[objets[j].type].couleur,
                    objets[i].masse, objets[j].masse);
                objets[i].masse += objets[j].masse*0.5;
                del[j] = true;
                creerFlash(objets[i].x, objets[i].y);
            } else {
                objets[j].couleur = melangerCouleurs(
                    CONFIG[objets[j].type].couleur,
                    CONFIG[objets[i].type].couleur,
                    objets[j].masse, objets[i].masse);
                objets[j].masse += objets[i].masse*0.5;
                del[i] = true;
                creerFlash(objets[j].x, objets[j].y);
            }
        }
    }
    objets = objets.filter((_,i) => !del[i]);

    // ── Forces gravitationnelles
    const ax = new Array(objets.length).fill(0);
    const az = new Array(objets.length).fill(0);

    for(let i=0; i<objets.length; i++)
    for(let j=i+1; j<objets.length; j++) {
        const ti = objets[i].type;
        const tj = objets[j].type;

        // Deux trous de ver ne s'attirent pas
        if(ti===4 && tj===4) continue;

        const dx = objets[j].x - objets[i].x;
        const dz = objets[j].y - objets[i].y;
        const d  = Math.max(
                   Math.sqrt(dx*dx+dz*dz), 0.05);

        // F = M1 × M2 / d²
        const f  = objets[i].masse
                 * objets[j].masse / (d*d);
        const nx = dx/d;
        const nz = dz/d;

        // Accélération = F / masse
        // → petit objet accélère BEAUCOUP plus !
        // Trou de ver : attire mais n'est pas attiré
        if(ti !== 4) {
            // amax proportionnel à 1/masse
            // → léger accélère plus que lourd !
            const amaxI = 0.008 /
                  Math.sqrt(objets[i].masse);
            const accI  = Math.min(
                  f/objets[i].masse, amaxI);
            ax[i] += accI * nx;
            az[i] += accI * nz;
        }
        if(tj !== 4) {
            const amaxJ = 0.008 /
                  Math.sqrt(objets[j].masse);
            const accJ  = Math.min(
                  f/objets[j].masse, amaxJ);
            ax[j] -= accJ * nx;
            az[j] -= accJ * nz;
        }
    }

    // ── Appliquer les accélérations
    for(let i=0; i<objets.length; i++) {
        // Objet en téléportation → immobile
        if(objets[i].enTeleportation) continue;

        objets[i].vx += ax[i] * dt;
        objets[i].vy += az[i] * dt;

        // Vitesse max inversement proportionnelle
        // à la masse → léger va plus vite !
        const vmax = 0.012 /
              Math.sqrt(objets[i].masse * 5);
        objets[i].vx = Math.max(-vmax,
                       Math.min(vmax, objets[i].vx));
        objets[i].vy = Math.max(-vmax,
                       Math.min(vmax, objets[i].vy));

        objets[i].x += objets[i].vx;
        objets[i].y += objets[i].vy;

        // Bords
        if(objets[i].x < -0.95) {
            objets[i].x  = -0.95;
            objets[i].vx *= -0.6;
        }
        if(objets[i].x >  0.95) {
            objets[i].x  =  0.95;
            objets[i].vx *= -0.6;
        }
        if(objets[i].y < -0.95) {
            objets[i].y  = -0.95;
            objets[i].vy *= -0.6;
        }
        if(objets[i].y >  0.95) {
            objets[i].y  =  0.95;
            objets[i].vy *= -0.6;
        }
    }

    document.getElementById('info-objets')
            .textContent = `Objets : ${objets.length}`;
}

// ── Dessiner buffer
function drawBuffer(pts, mode, r, g, b, count) {
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER,
                  new Float32Array(pts),
                  gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(aPos,3,gl.FLOAT,false,12,0);
    gl.enableVertexAttribArray(aPos);
    gl.uniform3f(uColor, r, g, b);
    gl.drawArrays(mode, 0, count || pts.length/3);
}

// ── Boucle principale
let dernierT = 0;
function boucle(t) {
    const fps = Math.round(1000/(t-dernierT)||60);
    dernierT = t;
    document.getElementById('info-fps')
            .textContent = `FPS : ${fps}`;

    // ── Physique
    physique();
    gererTrouDeVer();
    mettreAJourFlashs(); // ← AJOUT étape 4

    gl.clearColor(0.01,0.01,0.03,1);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    const {proj,view} = getMatrices();
    const MVP = multiply(proj,view);
    gl.useProgram(prog);
    gl.uniformMatrix4fv(uMVP,false,MVP);

    // ── Grille
    const {pts,idx} = creerGrille(20);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
    gl.bufferData(gl.ARRAY_BUFFER,
                  new Float32Array(pts),gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(aPos,3,gl.FLOAT,false,12,0);
    gl.enableVertexAttribArray(aPos);

    const ebo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ebo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,
                  new Uint32Array(idx),gl.DYNAMIC_DRAW);

    gl.uniform3f(uColor,0,0.5,0.9);
    gl.drawElements(gl.LINES,idx.length,
                    gl.UNSIGNED_INT,0);

   // ── Objets
for(const o of objets) {
    const cfg = CONFIG[o.type];
    const mb  = cfg.masse;
    const col = o.couleur || cfg.couleur;

    // Y position sur la grille
    let oy = 0;
    for(const s of objets) {
        const dx = o.x-s.x, dz = o.y-s.y;
        const d  = Math.max(
                   Math.sqrt(dx*dx+dz*dz),0.01);
        let def  = s.masse/(d*d);
        def = Math.min(def,
              Math.max(s.masse*20,0.5));
        oy -= def*Math.max(s.masse*12,0.8)*0.08;
    }

    // ── Trou noir = pas de sphère !
    // Juste des anneaux de courbure lumineux
    if (o.type === 2) {
        for (let k = 0; k < 5; k++) {
            const rk  = 0.06 + k * 0.04;
            const pts = [];
            for (let i = 0; i <= 64; i++) {
                const a = 2*Math.PI*i/64;
                pts.push(
                    o.x + Math.cos(a)*rk,
                    oy + 0.01,
                    o.y + Math.sin(a)*rk
                );
            }
            const intensity = 1.0 - k*0.18;
            drawBuffer(pts, gl.LINE_LOOP,
                col[0]*intensity,
                col[1]*intensity,
                col[2]*intensity,
                pts.length/3);
        }
        continue; // pas de sphère !
    }
    // ── Trou de ver = deux entonnoirs lumineux
if (o.type === 4) {
    const t2 = Date.now() / 1000;

    // Anneaux concentriques qui tournent
    for (let k = 0; k < 5; k++) {
        const rk    = 0.03 + k * 0.018;
        const alpha = 1.0 - k * 0.15;
        const pts   = [];
        const segs  = 48;

        for (let i = 0; i <= segs; i++) {
            const a = 2*Math.PI*i/segs
                    + t2 * (k%2===0 ? 1 : -1);
            // Entonnoir : plus on est loin
            // plus on monte
            const yy = oy + k * 0.015;
            pts.push(
                o.x + Math.cos(a)*rk,
                yy,
                o.y + Math.sin(a)*rk
            );
        }
        drawBuffer(pts, gl.LINE_LOOP,
            0.0 * alpha,
            1.0 * alpha,
            0.8 * alpha,
            pts.length/3);
    }

    // Rayon central lumineux vertical
    const ptsRayon = [];
    for (let k = 0; k <= 20; k++) {
        const yy = oy - 0.3 + k * 0.03;
        const rr = 0.02 * Math.sin(
                   k * Math.PI / 20);
        const a  = Date.now()/200 + k*0.5;
        ptsRayon.push(
            o.x + Math.cos(a)*rr,
            yy,
            o.y + Math.sin(a)*rr
        );
    }
    drawBuffer(ptsRayon, gl.LINE_STRIP,
        0.0, 1.0, 0.8,
        ptsRayon.length/3);

    continue;
}

    // ── Rayon dynamique selon masse
    const r = Math.min(
        cfg.rayon * Math.sqrt(o.masse/mb),
        0.30);

    // ── Sphère normale
    const sp  = creerSphere(
                o.x, oy+r+0.01, o.y, r, 10);
    const seg = 10, pbc = seg+1;

    drawBuffer(sp, gl.LINE_LOOP,
               col[0], col[1], col[2], pbc);
    for(let i = 1; i < seg; i++)
        drawBuffer(
            sp.slice(i*pbc*3,(i+1)*pbc*3),
            gl.LINE_LOOP,
            col[0], col[1], col[2], pbc);
}

    // ── Flashs d'absorption ← AJOUT étape 4
    for (const f of flashs) {
        const pts2 = [];
        const seg2 = 32;
        for (let i = 0; i <= seg2; i++) {
            const a = 2*Math.PI*i/seg2;
            pts2.push(
                f.x + Math.cos(a)*f.rayon,
                0.05,
                f.y + Math.sin(a)*f.rayon
            );
        }
        drawBuffer(pts2, gl.LINE_LOOP,
                   f.alpha,
                   f.alpha*0.8,
                   0.2,
                   pts2.length/3);
    }
// ── Tunnel entre trous de ver
const vers = objets.filter(o => o.type === 4);
if (vers.length >= 2) {
    for (let i = 0; i < vers.length-1; i++) {
        for (let j = i+1; j < vers.length; j++) {
            const v1 = vers[i];
            const v2 = vers[j];

            // Y des deux trous
            let oy1 = 0, oy2 = 0;
            for(const s of objets) {
                const dx1=v1.x-s.x, dz1=v1.y-s.y;
                const d1=Math.max(
                    Math.sqrt(dx1*dx1+dz1*dz1),0.01);
                let def1=s.masse/(d1*d1);
                def1=Math.min(def1,
                     Math.max(s.masse*20,0.5));
                oy1-=def1*Math.max(
                     s.masse*12,0.8)*0.08;

                const dx2=v2.x-s.x, dz2=v2.y-s.y;
                const d2=Math.max(
                    Math.sqrt(dx2*dx2+dz2*dz2),0.01);
                let def2=s.masse/(d2*d2);
                def2=Math.min(def2,
                     Math.max(s.masse*20,0.5));
                oy2-=def2*Math.max(
                     s.masse*12,0.8)*0.08;
            }

            const t2    = Date.now()/1000;
            const segT  = 30;
            const nbAnn = 20;

            // ── Fonction courbure du tunnel
            // Courbe vers le bas au milieu
            // comme un vrai trou de ver !
            function tunnelPos(alpha) {
                const px = v1.x+(v2.x-v1.x)*alpha;
                const pz = v1.y+(v2.y-v1.y)*alpha;

                // Courbure vers le bas
                // (parabole au milieu)
                const courbure = 0.25 *
                    Math.sin(alpha*Math.PI);
                const py = oy1+(oy2-oy1)*alpha
                         - courbure;

                // Rayon : petit aux extrémités,
                // plus large au milieu
                const r = 0.02 +
                    0.04*Math.sin(alpha*Math.PI);

                return {px, py, pz, r};
            }

            // ── Anneaux du tunnel
            for (let k = 0; k <= nbAnn; k++) {
                const alpha = k/nbAnn;
                const {px,py,pz,r} = tunnelPos(alpha);

                const ptsAnn = [];
                for (let a = 0; a <= segT; a++) {
                    const angle = 2*Math.PI*a/segT
                                + t2*1.5;
                    ptsAnn.push(
                        px+Math.cos(angle)*r,
                        py,
                        pz+Math.sin(angle)*r
                    );
                }

                const pulse = 0.4+0.4*Math.sin(
                    t2*3+alpha*Math.PI*4);
                const bright = 0.4+pulse*0.5;

                drawBuffer(ptsAnn, gl.LINE_LOOP,
                    0.0, bright, bright*0.8,
                    ptsAnn.length/3);
            }

            // ── Lignes longitudinales
            const nbLignes = 8;
            for (let l = 0; l < nbLignes; l++) {
                const angleL = 2*Math.PI*l/nbLignes
                             + t2*0.3;
                const ptsLigne = [];

                for (let k = 0; k <= nbAnn; k++) {
                    const alpha = k/nbAnn;
                    const {px,py,pz,r} =
                          tunnelPos(alpha);
                    ptsLigne.push(
                        px+Math.cos(angleL)*r,
                        py,
                        pz+Math.sin(angleL)*r
                    );
                }

                const pulse = 0.25+0.2*Math.sin(
                    t2*2+l*0.8);
                drawBuffer(ptsLigne, gl.LINE_STRIP,
                    0.0, pulse, pulse*0.8,
                    ptsLigne.length/3);
            }

            // ── Objet en traversée du tunnel
            // Quand un objet est téléporté,
            // on l'anime dans le tunnel !
            for (const obj of objets) {
                if (!obj.enTeleportation) continue;
                if (obj.type === 4) continue;

                // Progression dans le tunnel
                if (obj.tunnelProgress === undefined)
                    obj.tunnelProgress = 0;

                obj.tunnelProgress += 0.02;

                if (obj.tunnelProgress <= 1.0) {
                    const {px,py,pz} = tunnelPos(
                        obj.tunnelProgress);

                    // Dessiner l'objet dans le tunnel
                    const cfg = CONFIG[obj.type];
                    const col = obj.couleur||cfg.couleur;
                    const r   = cfg.rayon * 0.6;
                    const sp  = creerSphere(
                                px,py,pz,r,8);

                    const seg2=8, pbc2=seg2+1;
                    drawBuffer(sp,gl.LINE_LOOP,
                        col[0],col[1],col[2],pbc2);
                } else {
                    obj.tunnelProgress = undefined;
                }
            }
        }
    }
}
    requestAnimationFrame(boucle);
}

// ── Einstein animé
// function dessinerEinstein() {
//     const ec  = document.getElementById('einstein-canvas');
//     const ctx = ec.getContext('2d');
//     const t   = Date.now() / 1000;
//     const cx  = 60, cy = 58;

//     ctx.clearRect(0, 0, 120, 140);
//     ctx.lineCap  = 'round';
//     ctx.lineJoin = 'round';

//     // ── Cheveux ébouriffés (DERRIÈRE la tête)
//     ctx.strokeStyle = '#d0e0f0';
//     ctx.lineWidth   = 2.5;
//     const hairPoints = [
//         [-22, -30], [-18, -38], [-10, -42],
//         [ -5, -45], [  5, -44], [ 12, -40],
//         [ 20, -35], [ 24, -28]
//     ];
//     for (let i = 0; i < hairPoints.length; i++) {
//         const wave = Math.sin(t*1.5 + i*0.6) * 2.5;
//         const [hx, hy] = hairPoints[i];
//         ctx.beginPath();
//         ctx.moveTo(cx + hx, cy + hy + 8);
//         ctx.quadraticCurveTo(
//             cx + hx + wave,
//             cy + hy - 5 + wave,
//             cx + hx*1.3 + wave,
//             cy + hy - 12 + wave*0.5
//         );
//         ctx.stroke();
//     }

//     // ── Tête (ovale)
//     ctx.strokeStyle = '#b8d0e8';
//     ctx.lineWidth   = 1.8;
//     ctx.beginPath();
//     ctx.ellipse(cx, cy, 24, 30, 0, 0, Math.PI*2);
//     ctx.fillStyle = 'rgba(5,20,40,0.8)';
//     ctx.fill();
//     ctx.stroke();

//     // ── Rides du front (3 lignes)
//     ctx.strokeStyle = 'rgba(160,200,224,0.4)';
//     ctx.lineWidth   = 0.8;
//     for (let i = 0; i < 3; i++) {
//         ctx.beginPath();
//         ctx.moveTo(cx - 14 + i*2, cy - 18 + i*4);
//         ctx.quadraticCurveTo(
//             cx, cy - 20 + i*4,
//             cx + 14 - i*2, cy - 18 + i*4
//         );
//         ctx.stroke();
//     }

//     // ── Sourcils épais et expressifs
//     ctx.strokeStyle = '#c0d8f0';
//     ctx.lineWidth   = 2.8;

//     // Sourcil gauche (légèrement levé)
//     ctx.beginPath();
//     ctx.moveTo(cx - 20, cy - 10);
//     ctx.quadraticCurveTo(
//         cx - 10, cy - 15,
//         cx - 2,  cy - 11
//     );
//     ctx.stroke();

//     // Sourcil droit (légèrement levé)
//     ctx.beginPath();
//     ctx.moveTo(cx + 2,  cy - 11);
//     ctx.quadraticCurveTo(
//         cx + 10, cy - 15,
//         cx + 20, cy - 10
//     );
//     ctx.stroke();

//     // ── Yeux expressifs
//     ctx.lineWidth = 1.5;
//     ctx.strokeStyle = '#a0c8e0';

//     // Paupières supérieures
//     ctx.beginPath();
//     ctx.ellipse(cx-11, cy-3, 7, 5, -0.1,
//                 Math.PI, 0, true);
//     ctx.stroke();

//     ctx.beginPath();
//     ctx.ellipse(cx+11, cy-3, 7, 5, 0.1,
//                 0, Math.PI);
//     ctx.stroke();

//     // Yeux complets
//     ctx.beginPath();
//     ctx.ellipse(cx-11, cy-3, 7, 5, 0, 0, Math.PI*2);
//     ctx.stroke();
//     ctx.beginPath();
//     ctx.ellipse(cx+11, cy-3, 7, 5, 0, 0, Math.PI*2);
//     ctx.stroke();

//     // Iris
//     ctx.fillStyle = '#1a4060';
//     ctx.beginPath();
//     ctx.arc(cx-11, cy-3, 3.5, 0, Math.PI*2);
//     ctx.fill();
//     ctx.beginPath();
//     ctx.arc(cx+11, cy-3, 3.5, 0, Math.PI*2);
//     ctx.fill();

//     // Pupilles
//     ctx.fillStyle = '#001020';
//     ctx.beginPath();
//     ctx.arc(cx-11, cy-3, 2, 0, Math.PI*2);
//     ctx.fill();
//     ctx.beginPath();
//     ctx.arc(cx+11, cy-3, 2, 0, Math.PI*2);
//     ctx.fill();

//     // Reflets
//     ctx.fillStyle = 'rgba(200,240,255,0.9)';
//     ctx.beginPath();
//     ctx.arc(cx-9, cy-5, 1.2, 0, Math.PI*2);
//     ctx.fill();
//     ctx.beginPath();
//     ctx.arc(cx+13, cy-5, 1.2, 0, Math.PI*2);
//     ctx.fill();

//     // ── Nez réaliste
//     ctx.strokeStyle = '#90b8d0';
//     ctx.lineWidth   = 1.3;

//     // Arête du nez
//     ctx.beginPath();
//     ctx.moveTo(cx, cy - 2);
//     ctx.lineTo(cx - 2, cy + 10);
//     ctx.stroke();

//     // Base du nez
//     ctx.beginPath();
//     ctx.moveTo(cx - 2, cy + 10);
//     ctx.quadraticCurveTo(cx, cy + 13, cx + 2, cy + 10);
//     ctx.stroke();

//     // Narines
//     ctx.beginPath();
//     ctx.arc(cx - 6, cy + 12, 2.5, 0.2, Math.PI - 0.2);
//     ctx.stroke();
//     ctx.beginPath();
//     ctx.arc(cx + 6, cy + 12, 2.5, 0.2, Math.PI - 0.2);
//     ctx.stroke();

//     // ── Moustache épaisse signature d'Einstein !
//     ctx.strokeStyle = '#d8eaf8';
//     ctx.lineWidth   = 3;
//     const mWave = Math.sin(t * 1.2) * 1.2;

//     // Côté gauche
//     ctx.beginPath();
//     ctx.moveTo(cx - 2, cy + 16);
//     ctx.bezierCurveTo(
//         cx - 8,  cy + 14 + mWave,
//         cx - 16, cy + 16 + mWave,
//         cx - 22, cy + 14 + mWave * 0.5
//     );
//     ctx.stroke();

//     // Côté droit
//     ctx.beginPath();
//     ctx.moveTo(cx + 2, cy + 16);
//     ctx.bezierCurveTo(
//         cx + 8,  cy + 14 + mWave,
//         cx + 16, cy + 16 + mWave,
//         cx + 22, cy + 14 + mWave * 0.5
//     );
//     ctx.stroke();

//     // Milieu moustache (creux)
//     ctx.lineWidth = 1.5;
//     ctx.beginPath();
//     ctx.moveTo(cx - 2, cy + 16);
//     ctx.quadraticCurveTo(cx, cy + 18, cx + 2, cy + 16);
//     ctx.stroke();

//     // ── Bouche avec sourire subtil
//     ctx.strokeStyle = '#80a8c0';
//     ctx.lineWidth   = 1.5;
//     ctx.beginPath();
//     ctx.moveTo(cx - 8, cy + 22);
//     ctx.quadraticCurveTo(cx, cy + 26, cx + 8, cy + 22);
//     ctx.stroke();

//     // ── Joues avec rides
//     ctx.strokeStyle = 'rgba(140,180,210,0.25)';
//     ctx.lineWidth   = 1;
//     for (let i = 0; i < 2; i++) {
//         ctx.beginPath();
//         ctx.arc(cx - 19, cy + 5 + i*4, 4, -0.4, 0.4);
//         ctx.stroke();
//         ctx.beginPath();
//         ctx.arc(cx + 19, cy + 5 + i*4, 4,
//                 Math.PI - 0.4, Math.PI + 0.4);
//         ctx.stroke();
//     }

//     // ── Oreilles
//     ctx.strokeStyle = '#a0c0d8';
//     ctx.lineWidth   = 1.3;
//     ctx.beginPath();
//     ctx.ellipse(cx - 25, cy - 2, 4, 7, 0.2,
//                 0, Math.PI*2);
//     ctx.stroke();
//     ctx.beginPath();
//     ctx.ellipse(cx + 25, cy - 2, 4, 7, -0.2,
//                 0, Math.PI*2);
//     ctx.stroke();

//     // ── Cou
//     ctx.strokeStyle = '#90b0c8';
//     ctx.lineWidth   = 1.5;
//     ctx.beginPath();
//     ctx.moveTo(cx - 10, cy + 28);
//     ctx.lineTo(cx - 10, cy + 42);
//     ctx.stroke();
//     ctx.beginPath();
//     ctx.moveTo(cx + 10, cy + 28);
//     ctx.lineTo(cx + 10, cy + 42);
//     ctx.stroke();

//     // ── Col et veste
//     ctx.beginPath();
//     ctx.moveTo(cx - 10, cy + 42);
//     ctx.lineTo(cx - 4,  cy + 46);
//     ctx.lineTo(cx,      cy + 52);
//     ctx.lineTo(cx + 4,  cy + 46);
//     ctx.lineTo(cx + 10, cy + 42);
//     ctx.stroke();

//     // Épaules
//     ctx.beginPath();
//     ctx.moveTo(cx - 4, cy + 46);
//     ctx.lineTo(cx - 36, cy + 58);
//     ctx.stroke();
//     ctx.beginPath();
//     ctx.moveTo(cx + 4, cy + 46);
//     ctx.lineTo(cx + 36, cy + 58);
//     ctx.stroke();

//     requestAnimationFrame(dessinerEinstein);
// }
// Démarrer !
requestAnimationFrame(boucle);
// dessinerEinstein();
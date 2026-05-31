// ═══════════════════════════════════════
//   SHADERS WEBGL
//   Même logique que nos shaders C++/OpenGL
// ═══════════════════════════════════════

// ── Vertex Shader 3D ──────────────────
const VS_3D = `
    attribute vec3 position;
    uniform mat4 MVP;
    void main() {
        gl_Position = MVP * vec4(position, 1.0);
        gl_PointSize = 3.0;
    }
`;

// ── Fragment Shader 3D ────────────────
const FS_3D = `
    precision mediump float;
    uniform vec3 couleur;
    void main() {
        gl_FragColor = vec4(couleur, 1.0);
    }
`;

// ── Vertex Shader 2D (menu overlay) ──
const VS_2D = `
    attribute vec2 position;
    void main() {
        gl_Position = vec4(position, 0.0, 1.0);
    }
`;

// ── Fragment Shader 2D ────────────────
const FS_2D = `
    precision mediump float;
    uniform vec3 couleur;
    uniform float alpha;
    void main() {
        gl_FragColor = vec4(couleur, alpha);
    }
`;

// ═══════════════════════════════════════
//   FONCTION : compiler un shader
// ═══════════════════════════════════════
function compilerShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader,
                               gl.COMPILE_STATUS))
    {
        console.error('Erreur shader:',
                      gl.getShaderInfoLog(shader));
        return null;
    }
    return shader;
}

// ═══════════════════════════════════════
//   FONCTION : créer un programme shader
// ═══════════════════════════════════════
function creerProgramme(gl, vs, fs) {
    const vertexShader   = compilerShader(
                           gl, gl.VERTEX_SHADER, vs);
    const fragmentShader = compilerShader(
                           gl, gl.FRAGMENT_SHADER, fs);

    const programme = gl.createProgram();
    gl.attachShader(programme, vertexShader);
    gl.attachShader(programme, fragmentShader);
    gl.linkProgram(programme);

    if (!gl.getProgramParameter(programme,
                                gl.LINK_STATUS))
    {
        console.error('Erreur programme:',
                      gl.getProgramInfoLog(programme));
        return null;
    }
    return programme;
}

// ═══════════════════════════════════════
//   MATRICES (comme GLM en C++)
// ═══════════════════════════════════════

// Matrice identité
function mat4Identity() {
    return new Float32Array([
        1,0,0,0,
        0,1,0,0,
        0,0,1,0,
        0,0,0,1
    ]);
}

// Multiplication de matrices 4x4
function mat4Multiply(a, b) {
    const r = new Float32Array(16);
    for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
        r[i*4+j] = 0;
        for (let k = 0; k < 4; k++)
            r[i*4+j] += a[i*4+k] * b[k*4+j];
    }
    return r;
}

// Matrice de perspective
function mat4Perspective(fov, aspect, near, far) {
    const f = 1.0 / Math.tan(fov / 2);
    const nf = 1 / (near - far);
    return new Float32Array([
        f/aspect, 0,  0,                    0,
        0,        f,  0,                    0,
        0,        0,  (far+near)*nf,        -1,
        0,        0,  2*far*near*nf,        0
    ]);
}

// Matrice lookAt (caméra)
function mat4LookAt(eye, center, up) {
    // Vecteur Z (direction inverse)
    let zx = eye[0]-center[0];
    let zy = eye[1]-center[1];
    let zz = eye[2]-center[2];
    let zl = Math.sqrt(zx*zx+zy*zy+zz*zz);
    zx/=zl; zy/=zl; zz/=zl;

    // Vecteur X (droite)
    let xx = up[1]*zz - up[2]*zy;
    let xy = up[2]*zx - up[0]*zz;
    let xz = up[0]*zy - up[1]*zx;
    let xl = Math.sqrt(xx*xx+xy*xy+xz*xz);
    xx/=xl; xy/=xl; xz/=xl;

    // Vecteur Y (haut)
    let yx = zy*xz - zz*xy;
    let yy = zz*xx - zx*xz;
    let yz = zx*xy - zy*xx;

    return new Float32Array([
        xx, yx, zx, 0,
        xy, yy, zy, 0,
        xz, yz, zz, 0,
        -(xx*eye[0]+xy*eye[1]+xz*eye[2]),
        -(yx*eye[0]+yy*eye[1]+yz*eye[2]),
        -(zx*eye[0]+zy*eye[1]+zz*eye[2]),
        1
    ]);
}

// Inverser une matrice 4x4
function mat4Inverse(m) {
    const inv = new Float32Array(16);
    inv[0]  =  m[5]*m[10]*m[15] - m[5]*m[11]*m[14]
             - m[9]*m[6]*m[15]  + m[9]*m[7]*m[14]
             + m[13]*m[6]*m[11] - m[13]*m[7]*m[10];
    inv[4]  = -m[4]*m[10]*m[15] + m[4]*m[11]*m[14]
             + m[8]*m[6]*m[15]  - m[8]*m[7]*m[14]
             - m[12]*m[6]*m[11] + m[12]*m[7]*m[10];
    inv[8]  =  m[4]*m[9]*m[15]  - m[4]*m[11]*m[13]
             - m[8]*m[5]*m[15]  + m[8]*m[7]*m[13]
             + m[12]*m[5]*m[11] - m[12]*m[7]*m[9];
    inv[12] = -m[4]*m[9]*m[14]  + m[4]*m[10]*m[13]
             + m[8]*m[5]*m[14]  - m[8]*m[6]*m[13]
             - m[12]*m[5]*m[10] + m[12]*m[6]*m[9];
    inv[1]  = -m[1]*m[10]*m[15] + m[1]*m[11]*m[14]
             + m[9]*m[2]*m[15]  - m[9]*m[3]*m[14]
             - m[13]*m[2]*m[11] + m[13]*m[3]*m[10];
    inv[5]  =  m[0]*m[10]*m[15] - m[0]*m[11]*m[14]
             - m[8]*m[2]*m[15]  + m[8]*m[3]*m[14]
             + m[12]*m[2]*m[11] - m[12]*m[3]*m[10];
    inv[9]  = -m[0]*m[9]*m[15]  + m[0]*m[11]*m[13]
             + m[8]*m[1]*m[15]  - m[8]*m[3]*m[13]
             - m[12]*m[1]*m[11] + m[12]*m[3]*m[9];
    inv[13] =  m[0]*m[9]*m[14]  - m[0]*m[10]*m[13]
             - m[8]*m[1]*m[14]  + m[8]*m[2]*m[13]
             + m[12]*m[1]*m[10] - m[12]*m[2]*m[9];
    inv[2]  =  m[1]*m[6]*m[15]  - m[1]*m[7]*m[14]
             - m[5]*m[2]*m[15]  + m[5]*m[3]*m[14]
             + m[13]*m[2]*m[7]  - m[13]*m[3]*m[6];
    inv[6]  = -m[0]*m[6]*m[15]  + m[0]*m[7]*m[14]
             + m[4]*m[2]*m[15]  - m[4]*m[3]*m[14]
             - m[12]*m[2]*m[7]  + m[12]*m[3]*m[6];
    inv[10] =  m[0]*m[5]*m[15]  - m[0]*m[7]*m[13]
             - m[4]*m[1]*m[15]  + m[4]*m[3]*m[13]
             + m[12]*m[1]*m[7]  - m[12]*m[3]*m[5];
    inv[14] = -m[0]*m[5]*m[14]  + m[0]*m[6]*m[13]
             + m[4]*m[1]*m[14]  - m[4]*m[2]*m[13]
             - m[12]*m[1]*m[6]  + m[12]*m[2]*m[5];
    inv[3]  = -m[1]*m[6]*m[11]  + m[1]*m[7]*m[10]
             + m[5]*m[2]*m[11]  - m[5]*m[3]*m[10]
             - m[9]*m[2]*m[7]   + m[9]*m[3]*m[6];
    inv[7]  =  m[0]*m[6]*m[11]  - m[0]*m[7]*m[10]
             - m[4]*m[2]*m[11]  + m[4]*m[3]*m[10]
             + m[8]*m[2]*m[7]   - m[8]*m[3]*m[6];
    inv[11] = -m[0]*m[5]*m[11]  + m[0]*m[7]*m[9]
             + m[4]*m[1]*m[11]  - m[4]*m[3]*m[9]
             - m[8]*m[1]*m[7]   + m[8]*m[3]*m[5];
    inv[15] =  m[0]*m[5]*m[10]  - m[0]*m[6]*m[9]
             - m[4]*m[1]*m[10]  + m[4]*m[2]*m[9]
             + m[8]*m[1]*m[6]   - m[8]*m[2]*m[5];

    let det = m[0]*inv[0]+m[1]*inv[4]
             +m[2]*inv[8]+m[3]*inv[12];
    if (det === 0) return mat4Identity();
    det = 1.0 / det;
    for (let i = 0; i < 16; i++) inv[i] *= det;
    return inv;
}
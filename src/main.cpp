#include <glad/glad.h>
#include <GLFW/glfw3.h>
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>
#include <glm/gtc/matrix_inverse.hpp>
#include <iostream>
#include <vector>
#include <cmath>
#include <string>
#include <fstream>

#define STB_TRUETYPE_IMPLEMENTATION
#include <stb_truetype.h>

// ─────────────────────────────────────────
// SHADER 3D
// ─────────────────────────────────────────
const char* vertexShader3D = R"(
    #version 330 core
    layout (location = 0) in vec3 position;
    uniform mat4 MVP;
    void main()
    {
        gl_Position = MVP * vec4(position, 1.0);
    }
)";

const char* fragmentShader3D = R"(
    #version 330 core
    uniform vec3 couleur;
    out vec4 fragColor;
    void main()
    {
        fragColor = vec4(couleur, 1.0);
    }
)";

// ─────────────────────────────────────────
// SHADER TEXTE (2D)
// ─────────────────────────────────────────
const char* vertexTexteCode = R"(
    #version 330 core
    layout (location = 0) in vec2 position;
    layout (location = 1) in vec2 texCoord;
    out vec2 TexCoord;
    void main()
    {
        gl_Position = vec4(position, 0.0, 1.0);
        TexCoord = texCoord;
    }
)";

const char* fragmentTexteCode = R"(
    #version 330 core
    in vec2 TexCoord;
    uniform sampler2D textureTexte;
    uniform vec3 couleurTexte;
    out vec4 fragColor;
    void main()
    {
        float alpha = texture(textureTexte, TexCoord).r;
        fragColor = vec4(couleurTexte, alpha);
    }
)";

// ─────────────────────────────────────────
// STRUCTURE : objet
// ─────────────────────────────────────────
struct Objet
{
    float x, y;
    int   type;
    float masse;
    // Mouvement
    float vx = 0.0f;  // vitesse X
    float vy = 0.0f;  // vitesse Z
    bool  fixe = false; // fixe ou mobile ?
};

// ─────────────────────────────────────────
// VARIABLES GLOBALES
// ─────────────────────────────────────────
std::vector<Objet> objets;
int   typeSelectionne = 0;
float temps  = 0.0f;
int   LARGEUR = 1100;
int   HAUTEUR = 800;
float LIMITE_MENU = 160.0f;

// Caméra
float camAngleX =  30.0f;  // rotation verticale
float camAngleY =   0.0f;  // rotation horizontale
float camZoom   =   3.0f;  // distance
bool  sourisPressee = false;
double sourisLastX = 0, sourisLastY = 0;

// Police
stbtt_fontinfo             police;
std::vector<unsigned char> policeBuffer;
unsigned int               textureAtlas;
stbtt_bakedchar            charData[96];

// ─────────────────────────────────────────
// CONVERSIONS
// ─────────────────────────────────────────
float pixelVersGLx(float px)
{ return (px / LARGEUR) * 2.0f - 1.0f; }

float pixelVersGLy(float py)
{ return 1.0f - (py / HAUTEUR) * 2.0f; }

// ─────────────────────────────────────────
// CHARGER POLICE
// ─────────────────────────────────────────
bool chargerPolice(const std::string& chemin, float taille)
{
    std::ifstream f(chemin,
                    std::ios::binary | std::ios::ate);
    if (!f.is_open()) return false;
    int sz = f.tellg(); f.seekg(0);
    policeBuffer.resize(sz);
    f.read((char*)policeBuffer.data(), sz);
    f.close();

    std::vector<unsigned char> bitmap(512*512);
    stbtt_BakeFontBitmap(policeBuffer.data(), 0,
                         taille, bitmap.data(),
                         512, 512, 32, 96, charData);
    glGenTextures(1, &textureAtlas);
    glBindTexture(GL_TEXTURE_2D, textureAtlas);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RED,
                 512, 512, 0, GL_RED,
                 GL_UNSIGNED_BYTE, bitmap.data());
    glTexParameteri(GL_TEXTURE_2D,
                    GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D,
                    GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    return true;
}

// ─────────────────────────────────────────
// AFFICHER TEXTE
// ─────────────────────────────────────────
void afficherTexte(const std::string& texte,
                   float px, float py,
                   unsigned int shader,
                   unsigned int VAOt,
                   unsigned int VBOt)
{
    glUseProgram(shader);
    glBindTexture(GL_TEXTURE_2D, textureAtlas);
    glBindVertexArray(VAOt);
    float x = px, y = py;

    for (char c : texte)
    {
        if (c < 32 || c > 127) continue;
        stbtt_aligned_quad q;
        stbtt_GetBakedQuad(charData, 512, 512,
                           c-32, &x, &y, &q, 1);
        float x0=pixelVersGLx(q.x0), y0=pixelVersGLy(q.y0);
        float x1=pixelVersGLx(q.x1), y1=pixelVersGLy(q.y1);
        float v[] = {
            x0,y0, q.s0,q.t0,  x1,y0, q.s1,q.t0,
            x1,y1, q.s1,q.t1,  x0,y0, q.s0,q.t0,
            x1,y1, q.s1,q.t1,  x0,y1, q.s0,q.t1,
        };
        glBindBuffer(GL_ARRAY_BUFFER, VBOt);
        glBufferData(GL_ARRAY_BUFFER,
                     sizeof(v), v, GL_DYNAMIC_DRAW);
        glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE,
                              4*sizeof(float), (void*)0);
        glEnableVertexAttribArray(0);
        glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE,
                              4*sizeof(float),
                              (void*)(2*sizeof(float)));
        glEnableVertexAttribArray(1);
        glDrawArrays(GL_TRIANGLES, 0, 6);
    }
}

// ─────────────────────────────────────────
// CRÉER GRILLE 3D
// ─────────────────────────────────────────
void creerGrille3D(std::vector<float>& points,
                   std::vector<unsigned int>& indices,
                   int n)
{
    points.clear();
    indices.clear();
    float pas = 2.0f / n;
    int N = n + 1;

    for (int i = 0; i < N; i++)
    for (int j = 0; j < N; j++)
    {
        float x = -1.0f + j * pas;
        float z = -1.0f + i * pas;
        float y  = 0.0f;

        // Déformation vers le bas pour chaque objet
        for (const auto& obj : objets)
        {
            float dx = x - obj.x;
            float dz = z - obj.y;
            float dist = sqrt(dx*dx + dz*dz);
            if (dist < 0.01f) dist = 0.01f;
            float def = obj.masse / (dist * dist);

// Trou noir → courbure sans limite !
// Courbure proportionnelle à la masse !
float courbureMax = obj.masse * 20.0f;
float courbureAmp = obj.masse * 12.0f;

if (courbureMax < 0.5f) courbureMax = 0.5f;
if (courbureAmp < 0.8f) courbureAmp = 0.8f;
if (courbureMax > 3.0f) courbureMax = 3.0f;
if (courbureAmp > 2.5f) courbureAmp = 2.5f;

if (def > courbureMax) def = courbureMax;
y -= def * courbureAmp;
        }

        points.push_back(x);
        points.push_back(y);
        points.push_back(z);
    }

    // Lignes horizontales
    for (int i = 0; i < N; i++)
    for (int j = 0; j < N-1; j++)
    {
        indices.push_back(i*N+j);
        indices.push_back(i*N+j+1);
    }

    // Lignes verticales
    for (int i = 0; i < N-1; i++)
    for (int j = 0; j < N; j++)
    {
        indices.push_back(i*N+j);
        indices.push_back((i+1)*N+j);
    }
}

// ─────────────────────────────────────────
// CRÉER CERCLE 2D (pour le menu)
// ─────────────────────────────────────────
std::vector<float> creerCercle2D(float cx, float cy,
                                  float r, int seg)
{
    std::vector<float> pts;
    for (int i = 0; i <= seg; i++)
    {
        float a = 2.0f * 3.14159f * i / seg;
        pts.push_back(cx + cos(a)*r);
        pts.push_back(cy + sin(a)*r);
    }
    return pts;
}

// ─────────────────────────────────────────
// CRÉER RECTANGLE 2D
// ─────────────────────────────────────────
std::vector<float> creerRect(float x1, float y1,
                              float x2, float y2)
{
    return {x1,y1, x2,y1, x2,y2, x1,y2};
}

// ─────────────────────────────────────────
// PORTRAIT EINSTEIN
// ─────────────────────────────────────────
std::vector<float> creerEinstein(float cx, float cy,
                                  float scale, float t)
{
    std::vector<float> pts;
    float PI = 3.14159f;

    // Tête
    for (int i = 0; i <= 60; i++)
    {
        float a = 2.0f*PI*i/60;
        pts.push_back(cx + cos(a)*0.050f*scale);
        pts.push_back(cy + sin(a)*0.065f*scale);
    }

    // Cheveux animés
    for (int i = 0; i <= 20; i++)
    {
        float a = PI + PI*i/20;
        float w = sin(t*2.0f+i*0.4f)*0.008f*scale;
        pts.push_back(cx + cos(a)*0.050f*scale + w);
        pts.push_back(cy + sin(a)*0.065f*scale
                      + 0.025f*scale + w);
    }

    // Oeil gauche
    for (int i = 0; i <= 12; i++)
    {
        float a = 2.0f*PI*i/12;
        pts.push_back(cx - 0.028f*scale + cos(a)*0.010f*scale);
        pts.push_back(cy + 0.008f*scale + sin(a)*0.007f*scale);
    }

    // Oeil droit
    for (int i = 0; i <= 12; i++)
    {
        float a = 2.0f*PI*i/12;
        pts.push_back(cx + 0.028f*scale + cos(a)*0.010f*scale);
        pts.push_back(cy + 0.008f*scale + sin(a)*0.007f*scale);
    }

    // Moustache animée
    float w = sin(t*1.5f)*0.003f*scale;
    for (int i = 0; i <= 30; i++)
    {
        float a = PI*i/30;
        pts.push_back(cx + (cos(a)-0.5f)*0.050f*scale);
        pts.push_back(cy - 0.030f*scale
                      + sin(a)*0.014f*scale + w);
    }

    // Cou + épaules
    pts.push_back(cx - 0.012f*scale);
    pts.push_back(cy - 0.065f*scale);
    pts.push_back(cx - 0.012f*scale);
    pts.push_back(cy - 0.085f*scale);
    pts.push_back(cx - 0.060f*scale);
    pts.push_back(cy - 0.105f*scale);
    pts.push_back(cx + 0.060f*scale);
    pts.push_back(cy - 0.105f*scale);
    pts.push_back(cx + 0.012f*scale);
    pts.push_back(cy - 0.085f*scale);
    pts.push_back(cx + 0.012f*scale);
    pts.push_back(cy - 0.065f*scale);

    return pts;
}

// ─────────────────────────────────────────
// GESTION CLAVIER
// ─────────────────────────────────────────
void gererClavier(GLFWwindow* window, int touche,
                  int sc, int action, int mods)
{
    if (action != GLFW_PRESS) return;
    if (touche == GLFW_KEY_1) typeSelectionne = 0;
    if (touche == GLFW_KEY_2) typeSelectionne = 1;
    if (touche == GLFW_KEY_3) typeSelectionne = 2;
    if (touche == GLFW_KEY_4) typeSelectionne = 3;
    if (touche == GLFW_KEY_R) objets.clear();
    if (touche == GLFW_KEY_ESCAPE)
        glfwSetWindowShouldClose(window, true);
}

// ─────────────────────────────────────────
// GESTION SOURIS — CLIC
// ─────────────────────────────────────────
void gererClic(GLFWwindow* window, int bouton,
               int action, int mods)
{
    double mx, my;
    glfwGetCursorPos(window, &mx, &my);

    // Zones boutons en pixels
    float btns[4][4] = {
        {5,  0,   155, 55},
        {5,  75,  155, 135},
        {5,  165, 155, 225},
        {5,  258, 155, 318},
    };

    // ── Clic GAUCHE
    if (bouton == GLFW_MOUSE_BUTTON_LEFT
        && action == GLFW_PRESS)
    {
        // Vérifier boutons menu
        bool clicBouton = false;
        for (int i = 0; i < 4; i++)
        {
            if (mx >= btns[i][0] &&
                mx <= btns[i][2] &&
                my >= btns[i][1] &&
                my <= btns[i][3])
            {
                typeSelectionne = i;
                clicBouton = true;
                break;
            }
        }

        // Placer objet — DANS le même if !
        if (!clicBouton && mx > LIMITE_MENU)
        {
            float PI = 3.14159f;
            float ndcX = ((mx - LIMITE_MENU) /
             (LARGEUR - LIMITE_MENU))
             * 2.0f - 1.0f;
float ndcY = 1.0f - (my / HAUTEUR) * 2.0f;

// Correction du décalage menu
ndcX = ndcX * (float)(LARGEUR) /
              (float)(LARGEUR - LIMITE_MENU);

            float radX = camAngleX * PI / 180.0f;
            float radY = camAngleY * PI / 180.0f;
            glm::vec3 camPos = glm::vec3(
                camZoom*sin(radY)*cos(radX),
                camZoom*sin(radX),
                camZoom*cos(radY)*cos(radX));

            glm::mat4 view = glm::lookAt(
                camPos,
                glm::vec3(0,0,0),
                glm::vec3(0,1,0));
            glm::mat4 proj = glm::perspective(
                glm::radians(45.0f),
                (float)(LARGEUR-LIMITE_MENU)/HAUTEUR,
                0.1f, 100.0f);

            glm::mat4 invVP = glm::inverse(
                              proj * view);

            glm::vec4 rayNear = invVP *
                glm::vec4(ndcX, ndcY, -1.0f, 1.0f);
            glm::vec4 rayFar  = invVP *
                glm::vec4(ndcX, ndcY,  1.0f, 1.0f);

            rayNear /= rayNear.w;
            rayFar  /= rayFar.w;

            glm::vec3 rayDir = glm::normalize(
                glm::vec3(rayFar) -
                glm::vec3(rayNear));

            float t = -rayNear.y / rayDir.y;
            float worldX = rayNear.x + t*rayDir.x;
            float worldZ = rayNear.z + t*rayDir.z;

            // Correction du décalage (-0.30)
worldX += 0.30f;
worldZ += 0.17f;

worldX = glm::clamp(worldX,-0.95f,0.95f);
worldZ = glm::clamp(worldZ,-0.95f,0.95f);

            Objet obj;
            obj.x    = worldX;
            obj.y    = worldZ;
            obj.type = typeSelectionne;
            if (obj.type==0) // Étoile → fixe, très massive
{
    obj.masse = 0.08f;
    obj.fixe  = true;
}
if (obj.type==1) // Planète → mobile
{
    obj.masse = 0.01f;
    obj.fixe  = false;
}
if (obj.type==2) // Trou noir → fixe, extrêmement massif
{
    obj.masse = 0.25f;
    obj.fixe  = true;
}
if (obj.type==3) // Astéroïde → mobile, léger
{
    obj.masse = 0.003f;
    obj.fixe  = false;
}
            objets.push_back(obj);

        }
    } // ← fermeture du if GAUCHE

    // ── Clic DROIT → rotation caméra
    if (bouton == GLFW_MOUSE_BUTTON_RIGHT)
    {
        if (action == GLFW_PRESS)
        {
            sourisPressee = true;
            sourisLastX   = mx;
            sourisLastY   = my;
        }
        else if (action == GLFW_RELEASE)
            sourisPressee = false;
    }
}

void gererMouvement(GLFWwindow* window,
                    double mx, double my)
{
    if (!sourisPressee) return;

    float dx = mx - sourisLastX;
    float dy = my - sourisLastY;

    camAngleY += dx * 0.4f;
    camAngleX += dy * 0.4f;

    if (camAngleX < 10.0f) camAngleX = 10.0f;
    if (camAngleX > 80.0f) camAngleX = 80.0f;

    sourisLastX = mx;
    sourisLastY = my;
}

// ─────────────────────────────────────────
// GESTION SCROLL (zoom)
// ─────────────────────────────────────────
void gererScroll(GLFWwindow* window,
                 double dx, double dy)
{
    camZoom -= dy * 0.2f;
    if (camZoom < 1.0f) camZoom = 1.0f;
    if (camZoom > 6.0f) camZoom = 6.0f;
}

// ─────────────────────────────────────────
// COMPILER SHADER
// ─────────────────────────────────────────
unsigned int compilerShader(const char* vs,
                             const char* fs)
{
    unsigned int v = glCreateShader(GL_VERTEX_SHADER);
    glShaderSource(v,1,&vs,NULL); glCompileShader(v);
    unsigned int f = glCreateShader(GL_FRAGMENT_SHADER);
    glShaderSource(f,1,&fs,NULL); glCompileShader(f);
    unsigned int p = glCreateProgram();
    glAttachShader(p,v); glAttachShader(p,f);
    glLinkProgram(p);
    glDeleteShader(v); glDeleteShader(f);
    return p;
}

// ─────────────────────────────────────────
// CRÉER UNE SPHÈRE 3D
// ─────────────────────────────────────────
std::vector<float> creerSphere(float cx, float cy,
                                float cz, float rayon,
                                int segments)
{
    std::vector<float> pts;
    float PI = 3.14159f;

    // Cercles horizontaux (latitudes)
    for (int i = 1; i < segments; i++)
    {
        float phi = PI * i / segments;
        float y   = cy + rayon * cos(phi);
        float r   = rayon * sin(phi);

        for (int j = 0; j <= segments; j++)
        {
            float theta = 2.0f * PI * j / segments;
            pts.push_back(cx + r * cos(theta));
            pts.push_back(y);
            pts.push_back(cz + r * sin(theta));
        }
    }

    // Cercles verticaux (longitudes)
    for (int j = 0; j < segments; j++)
    {
        float theta = 2.0f * PI * j / segments;

        for (int i = 0; i <= segments; i++)
        {
            float phi = PI * i / segments;
            pts.push_back(cx + rayon*sin(phi)*cos(theta));
            pts.push_back(cy + rayon*cos(phi));
            pts.push_back(cz + rayon*sin(phi)*sin(theta));
        }
    }

    return pts;
}

// ─────────────────────────────────────────
// MISE À JOUR PHYSIQUE
// ─────────────────────────────────────────
void mettreAJourPhysique()
{
    float dt = 0.0008f;

    // ── Rayon de collision par type
    auto rayonCollision = [](int type) -> float {
        if (type == 0) return 0.08f; // étoile
        if (type == 1) return 0.05f; // planète
        if (type == 2) return 0.12f; // trou noir
        return 0.03f;                // astéroïde
    };

    // ── ÉTAPE 1 : Détecter collisions
    std::vector<bool> aSupprimer(objets.size(), false);

    for (int i = 0; i < (int)objets.size(); i++)
    for (int j = i+1; j < (int)objets.size(); j++)
    {
        if (aSupprimer[i] || aSupprimer[j]) continue;

        float dx   = objets[j].x - objets[i].x;
        float dz   = objets[j].y - objets[i].y;
        float dist = sqrt(dx*dx + dz*dz);
        float seuilCollision = rayonCollision(objets[i].type)
                             + rayonCollision(objets[j].type);

        if (dist < seuilCollision)
        {
            // L'objet le plus massif absorbe l'autre !
            if (objets[i].masse >= objets[j].masse)
            {
                // i absorbe j → i grossit
                objets[i].masse += objets[j].masse * 0.5f;
                aSupprimer[j] = true;
                std::cout << "Absorption !" << std::endl;
            }
            else
            {
                // j absorbe i → j grossit
                objets[j].masse += objets[i].masse * 0.5f;
                aSupprimer[i] = true;
                std::cout << "Absorption !" << std::endl;
            }
        }
    }

    // Supprimer les objets absorbés
    for (int i = objets.size()-1; i >= 0; i--)
        if (aSupprimer[i])
            objets.erase(objets.begin()+i);

    // ── ÉTAPE 2 : Calculer forces
    std::vector<float> accX(objets.size(), 0.0f);
    std::vector<float> accZ(objets.size(), 0.0f);

    for (int i = 0; i < (int)objets.size(); i++)
    for (int j = i+1; j < (int)objets.size(); j++)
    {
        float dx   = objets[j].x - objets[i].x;
        float dz   = objets[j].y - objets[i].y;
        float dist = sqrt(dx*dx + dz*dz);
        if (dist < 0.05f) dist = 0.05f;

        // F = M1 × M2 / d²
        float force = (objets[i].masse *
                       objets[j].masse)
                      / (dist * dist);

        float nx = dx / dist;
        float nz = dz / dist;

        // Accélération = F / M
        accX[i] += force * nx / objets[i].masse;
        accZ[i] += force * nz / objets[i].masse;
        accX[j] -= force * nx / objets[j].masse;
        accZ[j] -= force * nz / objets[j].masse;
    }

    // ── ÉTAPE 3 : Appliquer + amortissement
    for (int i = 0; i < (int)objets.size(); i++)
    {
        // Amortissement naturel
        // (simule perte d'énergie progressive)
        float amorti = 0.995f;

        // Amortissement plus fort près d'un trou noir
        for (const auto& src : objets)
        {
            if (src.type != 2) continue;
            float dx   = objets[i].x - src.x;
            float dz   = objets[i].y - src.y;
            float dist = sqrt(dx*dx + dz*dz);
            if (dist < 0.3f)
                amorti *= 0.98f; // ralentit près du trou noir
        }

        float accMax = 0.015f;
        accX[i] = glm::clamp(accX[i],-accMax,accMax);
        accZ[i] = glm::clamp(accZ[i],-accMax,accMax);

        objets[i].vx = (objets[i].vx + accX[i]*dt)
                       * amorti;
        objets[i].vy = (objets[i].vy + accZ[i]*dt)
                       * amorti;

        // Vitesse max proportionnelle à la masse
        float vitMax = 0.006f /
                       sqrt(objets[i].masse * 8.0f);
        objets[i].vx = glm::clamp(
                        objets[i].vx,-vitMax,vitMax);
        objets[i].vy = glm::clamp(
                        objets[i].vy,-vitMax,vitMax);

        objets[i].x += objets[i].vx;
        objets[i].y += objets[i].vy;

        // Bords
        if (objets[i].x < -0.95f)
        { objets[i].x=-0.95f; objets[i].vx*=-0.3f; }
        if (objets[i].x >  0.95f)
        { objets[i].x= 0.95f; objets[i].vx*=-0.3f; }
        if (objets[i].y < -0.95f)
        { objets[i].y=-0.95f; objets[i].vy*=-0.3f; }
        if (objets[i].y >  0.95f)
        { objets[i].y= 0.95f; objets[i].vy*=-0.3f; }
    }
}
// ─────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────
int main()
{
    if (!glfwInit()) return -1;
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
    glfwWindowHint(GLFW_OPENGL_PROFILE,
                   GLFW_OPENGL_CORE_PROFILE);

    GLFWwindow* window = glfwCreateWindow(
        LARGEUR, HAUTEUR,
        "Space-Time Simulator 3D - Einstein",
        NULL, NULL);
    if (!window) { glfwTerminate(); return -1; }

    glfwMakeContextCurrent(window);
    glfwSetKeyCallback(window, gererClavier);
    glfwSetMouseButtonCallback(window, gererClic);
    glfwSetCursorPosCallback(window, gererMouvement);
    glfwSetScrollCallback(window, gererScroll);

    if (!gladLoadGLLoader(
        (GLADloadproc)glfwGetProcAddress)) return -1;

    glEnable(GL_BLEND);
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
    glEnable(GL_DEPTH_TEST);

    // Shaders
    unsigned int shader3D    = compilerShader(
                               vertexShader3D,
                               fragmentShader3D);
    unsigned int shaderTexte = compilerShader(
                               vertexTexteCode,
                               fragmentTexteCode);
    unsigned int shader2D    = compilerShader(
        // Shader 2D simple pour le menu
        R"(#version 330 core
           layout(location=0) in vec2 position;
           void main(){
               gl_Position=vec4(position,0.0,1.0);})",
        R"(#version 330 core
           uniform vec3 couleur;
           out vec4 fragColor;
           void main(){
               fragColor=vec4(couleur,1.0);})");

    int locMVP      = glGetUniformLocation(shader3D,
                                           "MVP");
    int locCol3D    = glGetUniformLocation(shader3D,
                                           "couleur");
    int locCol2D    = glGetUniformLocation(shader2D,
                                           "couleur");
    int locColTxt   = glGetUniformLocation(shaderTexte,
                                           "couleurTexte");

    chargerPolice("arial.ttf", 14.0f);

    // ── VAO grille 3D
    std::vector<float>        gPoints;
    std::vector<unsigned int> gIndices;
    unsigned int VAO, VBO, EBO;
    glGenVertexArrays(1,&VAO);
    glGenBuffers(1,&VBO);
    glGenBuffers(1,&EBO);
    glBindVertexArray(VAO);
    glBindBuffer(GL_ARRAY_BUFFER, VBO);
    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, EBO);
    glVertexAttribPointer(0,3,GL_FLOAT,GL_FALSE,
                          3*sizeof(float),(void*)0);
    glEnableVertexAttribArray(0);

    // ── VAO menu 2D
    unsigned int VAO2, VBO2;
    glGenVertexArrays(1,&VAO2);
    glGenBuffers(1,&VBO2);
    glBindVertexArray(VAO2);
    glBindBuffer(GL_ARRAY_BUFFER, VBO2);
    glVertexAttribPointer(0,2,GL_FLOAT,GL_FALSE,
                          2*sizeof(float),(void*)0);
    glEnableVertexAttribArray(0);

    // ── VAO texte
    unsigned int VAOt, VBOt;
    glGenVertexArrays(1,&VAOt);
    glGenBuffers(1,&VBOt);

    float menuX1 = -1.0f;
    float menuX2 = pixelVersGLx(LIMITE_MENU);

    float btns[4][4] = {
        {menuX1+0.03f, 0.80f, menuX2-0.03f, 0.90f},
        {menuX1+0.03f, 0.57f, menuX2-0.03f, 0.67f},
        {menuX1+0.03f, 0.34f, menuX2-0.03f, 0.44f},
        {menuX1+0.03f, 0.11f, menuX2-0.03f, 0.21f},
    };

    float coulsBtns[4][3] = {
        {1.0f,0.8f,0.2f},
        {0.2f,0.5f,1.0f},
        {0.6f,0.0f,1.0f},
        {0.6f,0.4f,0.2f},
    };

    std::string nomsBtns[] = {
        "ETOILE","PLANETE","TROU NOIR","ASTEROIDE"
    };

    float labelsY[] = {96, 182, 268, 354};

    auto dessiner2D = [&](std::vector<float>& v,
                          GLenum mode,
                          float r,float g,float b)
    {
        glUseProgram(shader2D);
        glBindVertexArray(VAO2);
        glBindBuffer(GL_ARRAY_BUFFER, VBO2);
        glBufferData(GL_ARRAY_BUFFER,
                     v.size()*sizeof(float),
                     v.data(), GL_DYNAMIC_DRAW);
        glUniform3f(locCol2D, r, g, b);
        glDrawArrays(mode, 0, v.size()/2);
    };

    std::cout << "=== SPACE-TIME 3D ===" << std::endl;
    std::cout << "Clic gauche + glisser = tourner"
              << std::endl;
    std::cout << "Scroll = zoom" << std::endl;
    std::cout << "R = reset | Echap = quitter"
              << std::endl;

    // ── Boucle principale
    while (!glfwWindowShouldClose(window))
    {
        temps += 0.02f;
        mettreAJourPhysique();

        // ── Matrice MVP (caméra 3D)
        float PI = 3.14159f;
        float radX = camAngleX * PI / 180.0f;
        float radY = camAngleY * PI / 180.0f;

        glm::vec3 camPos = glm::vec3(
            camZoom * sin(radY) * cos(radX),
            camZoom * sin(radX),
            camZoom * cos(radY) * cos(radX));

        glm::mat4 view = glm::lookAt(
            camPos,
            glm::vec3(0,0,0),
            glm::vec3(0,1,0));

        glm::mat4 proj = glm::perspective(
            glm::radians(45.0f),
            (float)(LARGEUR-LIMITE_MENU)/HAUTEUR,
            0.1f, 100.0f);

        glm::mat4 model = glm::mat4(1.0f);
        glm::mat4 MVP   = proj * view * model;

        // ── Recalculer grille
        creerGrille3D(gPoints, gIndices, 30);
        glBindVertexArray(VAO);
        glBindBuffer(GL_ARRAY_BUFFER, VBO);
        glBufferData(GL_ARRAY_BUFFER,
                     gPoints.size()*sizeof(float),
                     gPoints.data(), GL_DYNAMIC_DRAW);
        glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, EBO);
        glBufferData(GL_ELEMENT_ARRAY_BUFFER,
                     gIndices.size()*sizeof(unsigned int),
                     gIndices.data(), GL_DYNAMIC_DRAW);

        // ── Effacer
        glClearColor(0.02f,0.02f,0.08f,1.0f);
        glClear(GL_COLOR_BUFFER_BIT|GL_DEPTH_BUFFER_BIT);

        // ── Viewport simulation (droite)
        glViewport(0, 0, LARGEUR, HAUTEUR);

        // ── Dessiner grille 3D
        glUseProgram(shader3D);
        glUniformMatrix4fv(locMVP, 1, GL_FALSE,
                           glm::value_ptr(MVP));
        glUniform3f(locCol3D, 0.0f, 0.5f, 0.9f);
        glBindVertexArray(VAO);
        glDrawElements(GL_LINES, gIndices.size(),
                       GL_UNSIGNED_INT, 0);

        // ── Dessiner objets 3D
for (const auto& obj : objets)
{
    float r, g, b, rayon;

    // Masse de base par type
float masseBase;
if (obj.type==0)
{ r=1.0f; g=0.8f; b=0.2f; masseBase=0.08f; }
else if (obj.type==1)
{ r=0.2f; g=0.5f; b=1.0f; masseBase=0.01f; }
else if (obj.type==2)
{ r=0.6f; g=0.0f; b=1.0f; masseBase=0.25f; }
else
{ r=0.6f; g=0.4f; b=0.2f; masseBase=0.003f; }

// Rayon proportionnel à la masse actuelle !
rayon = 0.03f * sqrt(obj.masse / masseBase)
        + 0.01f;

// Limiter taille maximale
if (rayon > 0.25f) rayon = 0.25f;

    // Trouver Y de la grille sous l'objet
    float objY = 0.0f;
    for (const auto& o : objets)
    {
        float dx = obj.x - o.x;
        float dz = obj.y - o.y;
        float dist = sqrt(dx*dx + dz*dz);
        if (dist < 0.01f) dist = 0.01f;
        float def = o.masse / (dist*dist);
        if (def > 0.5f) def = 0.5f;
        objY -= def * 0.8f;
    }

    // Dessiner la sphère au-dessus de la grille
    auto sphere = creerSphere(
        obj.x,
        objY + rayon + 0.02f,
        obj.y,
        rayon, 12);

    glBindVertexArray(VAO);
    glBindBuffer(GL_ARRAY_BUFFER, VBO);
    glBufferData(GL_ARRAY_BUFFER,
                 sphere.size()*sizeof(float),
                 sphere.data(), GL_DYNAMIC_DRAW);
    glVertexAttribPointer(0, 3, GL_FLOAT,
                          GL_FALSE,
                          3*sizeof(float),
                          (void*)0);
    glUniform3f(locCol3D, r, g, b);

    // Dessiner les cercles de la sphère
    int seg = 12;
    int ptsByCircle = seg + 1;

    // Latitudes
    for (int i = 1; i < seg; i++)
    {
        glDrawArrays(GL_LINE_LOOP,
                     (i-1) * ptsByCircle,
                     ptsByCircle);
    }

    // Longitudes
    int offset = (seg-1) * ptsByCircle;
    for (int j = 0; j < seg; j++)
    {
        glDrawArrays(GL_LINE_STRIP,
                     offset + j * ptsByCircle,
                     ptsByCircle);
    }

    // Halo lumineux pour trou noir
    if (obj.type == 2)
    {
        for (int k = 0; k < 3; k++)
        {
            auto halo = creerSphere(
                obj.x,
                objY + rayon + 0.02f,
                obj.y,
                rayon + k*0.03f, 8);

            glBufferData(GL_ARRAY_BUFFER,
                         halo.size()*sizeof(float),
                         halo.data(),
                         GL_DYNAMIC_DRAW);

            float intensity = 1.0f - k*0.3f;
            glUniform3f(locCol3D,
                        intensity*0.6f,
                        0.0f,
                        intensity*1.0f);

            for (int i = 1; i < 8; i++)
                glDrawArrays(GL_LINE_LOOP,
                             (i-1)*9, 9);
        }
    }
}

        // ── Viewport menu (gauche)
        glViewport(0, 0, LARGEUR, HAUTEUR);
        glDisable(GL_DEPTH_TEST);

        // Fond menu
        auto fond = creerRect(menuX1,-1.0f,
                              menuX2, 1.0f);
        dessiner2D(fond, GL_TRIANGLE_FAN,
                   0.05f,0.05f,0.15f);

        // Séparateur
        std::vector<float> sep = {
            menuX2,-1.0f, menuX2,1.0f};
        dessiner2D(sep, GL_LINES,
                   0.4f,0.4f,0.8f);

        // Boutons
        for (int i=0; i<4; i++)
        {
            auto btn = creerRect(
                btns[i][0],btns[i][1],
                btns[i][2],btns[i][3]);

            float bright = (i==typeSelectionne) ?
                           0.4f : 0.12f;
            dessiner2D(btn, GL_TRIANGLE_FAN,
                       coulsBtns[i][0]*bright,
                       coulsBtns[i][1]*bright,
                       coulsBtns[i][2]*bright);
            dessiner2D(btn, GL_LINE_LOOP,
                       coulsBtns[i][0],
                       coulsBtns[i][1],
                       coulsBtns[i][2]);

            // Icône
            float cx2 = (btns[i][0]+btns[i][2])/2.0f;
            float cy2 = (btns[i][1]+btns[i][3])/2.0f;
            float ray[]={0.020f,0.014f,0.018f,0.008f};
            int   seg[]={32,32,32,8};
            auto  ico = creerCercle2D(cx2,cy2,
                                      ray[i],seg[i]);
            dessiner2D(ico, GL_LINE_LOOP,
                       coulsBtns[i][0],
                       coulsBtns[i][1],
                       coulsBtns[i][2]);

            if (i==typeSelectionne)
            {
                auto sel = creerRect(
                    btns[i][0]-0.01f,btns[i][1]-0.01f,
                    btns[i][2]+0.01f,btns[i][3]+0.01f);
                dessiner2D(sel,GL_LINE_LOOP,
                           1.0f,1.0f,1.0f);
            }
        }

        // Einstein
        auto ein = creerEinstein(
            (menuX1+menuX2)/2.0f,
            -0.38f, 1.3f, temps);
        glUseProgram(shader2D);
        glBindVertexArray(VAO2);
        glBindBuffer(GL_ARRAY_BUFFER, VBO2);
        glBufferData(GL_ARRAY_BUFFER,
                     ein.size()*sizeof(float),
                     ein.data(), GL_DYNAMIC_DRAW);
        glUniform3f(locCol2D, 0.9f,0.85f,0.7f);
        glDrawArrays(GL_LINE_STRIP, 0,
                     ein.size()/2);

        // ── Viewport complet pour le texte
        glViewport(0, 0, LARGEUR, HAUTEUR);

        // Titre
        glUseProgram(shaderTexte);
        glUniform3f(locColTxt, 1.0f,1.0f,1.0f);
        afficherTexte("SPACE-TIME SIMULATOR 3D",
                      180, 28, shaderTexte,
                      VAOt, VBOt);
        glUniform3f(locColTxt, 0.4f,0.7f,1.0f);
        afficherTexte("Einstein General Relativity",
                      240, 50, shaderTexte,
                      VAOt, VBOt);

        // Labels boutons
        for (int i=0; i<4; i++)
        {
            glUniform3f(locColTxt,
                        coulsBtns[i][0],
                        coulsBtns[i][1],
                        coulsBtns[i][2]);
            afficherTexte(nomsBtns[i], 8,
                          labelsY[i],
                          shaderTexte, VAOt, VBOt);
        }

        // Instructions
        glUniform3f(locColTxt, 0.5f,0.5f,0.5f);
        afficherTexte("Click: place",
              5, 410, shaderTexte,VAOt,VBOt);
afficherTexte("Right: rotate",
              5, 428, shaderTexte,VAOt,VBOt);
afficherTexte("Scroll: zoom",
              5, 446, shaderTexte,VAOt,VBOt);
afficherTexte("R: reset",
              5, 464, shaderTexte,VAOt,VBOt);

        // Einstein label
        glUniform3f(locColTxt, 0.6f,0.6f,0.5f);
        afficherTexte("Einstein",
                      30, 580, shaderTexte,VAOt,VBOt);
        glUniform3f(locColTxt, 0.5f,0.5f,0.4f);
        afficherTexte("E=mc2",
                      38, 597, shaderTexte,VAOt,VBOt);

        glEnable(GL_DEPTH_TEST);
        glfwSwapBuffers(window);
        glfwPollEvents();
    }

    // Nettoyer
    glDeleteVertexArrays(1,&VAO);
    glDeleteBuffers(1,&VBO);
    glDeleteBuffers(1,&EBO);
    glDeleteVertexArrays(1,&VAO2);
    glDeleteBuffers(1,&VBO2);
    glDeleteVertexArrays(1,&VAOt);
    glDeleteBuffers(1,&VBOt);
    glDeleteTextures(1,&textureAtlas);
    glDeleteProgram(shader3D);
    glDeleteProgram(shader2D);
    glDeleteProgram(shaderTexte);
    glfwTerminate();
    return 0;
}
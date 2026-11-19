// Semplificazione QEM (half-edge collapse) con vertici bloccati (cuciture UV / bordi).
// uso: qem in.bin out.bin targetFaces
// in.bin: int32 nv, int32 nf, float32 pos[nv*3], uint8 lock[nv], int32 idx[nf*3]
// out.bin: int32 nv, int32 nf, int32 remap[nv_old] (indice nuovo o -1), int32 idx[nf*3]
#include <cstdio>
#include <cstdlib>
#include <cmath>
#include <vector>
#include <queue>
#include <algorithm>
#include <cstdint>
using namespace std;
struct Q { double a[10]; Q() { for (auto &x : a) x = 0; }
  void add(const Q &o) { for (int i = 0; i < 10; i++) a[i] += o.a[i]; }
  double eval(const float *p) const { double x = p[0], y = p[1], z = p[2];
    return a[0]*x*x + 2*a[1]*x*y + 2*a[2]*x*z + 2*a[3]*x + a[4]*y*y + 2*a[5]*y*z + 2*a[6]*y + a[7]*z*z + 2*a[8]*z + a[9]; } };
static Q plane(double a, double b, double c, double d, double w) { Q q; q.a[0]=a*a*w; q.a[1]=a*b*w; q.a[2]=a*c*w; q.a[3]=a*d*w; q.a[4]=b*b*w; q.a[5]=b*c*w; q.a[6]=b*d*w; q.a[7]=c*c*w; q.a[8]=c*d*w; q.a[9]=d*d*w; return q; }
struct E { double cost; int from, to; unsigned ver; bool operator<(const E &o) const { return cost > o.cost; } };
int main(int argc, char **argv) {
  FILE *f = fopen(argv[1], "rb"); int nv, nf; fread(&nv, 4, 1, f); fread(&nf, 4, 1, f);
  vector<float> P(nv * 3); fread(P.data(), 4, nv * 3, f); vector<uint8_t> lock(nv); fread(lock.data(), 1, nv, f);
  vector<int> F(nf * 3); fread(F.data(), 4, nf * 3, f); fclose(f);
  int target = atoi(argv[3]);
  vector<Q> q(nv); vector<vector<int>> vf(nv); vector<char> dead(nf, 0);
  auto fnormal = [&](int t, double *n) { const float *a = &P[F[t*3]*3], *b = &P[F[t*3+1]*3], *c = &P[F[t*3+2]*3];
    double u[3] = {b[0]-a[0], b[1]-a[1], b[2]-a[2]}, v[3] = {c[0]-a[0], c[1]-a[1], c[2]-a[2]};
    n[0] = u[1]*v[2]-u[2]*v[1]; n[1] = u[2]*v[0]-u[0]*v[2]; n[2] = u[0]*v[1]-u[1]*v[0]; double l = sqrt(n[0]*n[0]+n[1]*n[1]+n[2]*n[2]); if (l > 0) { n[0]/=l; n[1]/=l; n[2]/=l; } return l * 0.5; };
  for (int t = 0; t < nf; t++) { double n[3]; double ar = fnormal(t, n); const float *a = &P[F[t*3]*3];
    Q pq = plane(n[0], n[1], n[2], -(n[0]*a[0]+n[1]*a[1]+n[2]*a[2]), ar);
    for (int k = 0; k < 3; k++) { q[F[t*3+k]].add(pq); vf[F[t*3+k]].push_back(t); } }
  vector<unsigned> ver(nv, 0); vector<int> rep(nv); for (int i = 0; i < nv; i++) rep[i] = i;
  priority_queue<E> heap;
  auto push = [&](int a, int b) { if (lock[a]) return; Q s = q[a]; s.add(q[b]); heap.push({s.eval(&P[b*3]), a, b, ver[a]}); };
  auto pushV = [&](int a) { for (int t : vf[a]) if (!dead[t]) for (int k = 0; k < 3; k++) { int b = F[t*3+k]; if (b != a) push(a, b); } };
  for (int i = 0; i < nv; i++) pushV(i);
  int alive = nf;
  vector<int> mark(nv, -1); int stamp = 0;
  while (alive > target && !heap.empty()) {
    E e = heap.top(); heap.pop();
    if (e.ver != ver[e.from] || lock[e.from]) continue;
    int a = e.from, b = e.to; if (a == b) continue;
    // a e b devono essere ancora vicini
    bool adj = false; for (int t : vf[a]) if (!dead[t]) for (int k = 0; k < 3; k++) if (F[t*3+k] == b) adj = true;
    if (!adj) continue;
    // condizione di link (evita mesh non-manifold): vicini comuni = 2 (o 1 sul bordo)
    stamp++; for (int t : vf[a]) if (!dead[t]) for (int k = 0; k < 3; k++) mark[F[t*3+k]] = stamp;
    int common = 0, shared = 0; stamp++; int st2 = stamp;
    for (int t : vf[b]) if (!dead[t]) { bool hasA = false; for (int k = 0; k < 3; k++) if (F[t*3+k] == a) hasA = true; if (hasA) shared++;
      for (int k = 0; k < 3; k++) { int c = F[t*3+k]; if (c != a && c != b && mark[c] == st2 - 1) { mark[c] = st2; common++; } } }
    if (common != shared) continue;
    // niente triangoli ribaltati
    bool flip = false;
    for (int t : vf[a]) { if (dead[t]) continue; bool hasB = false; for (int k = 0; k < 3; k++) if (F[t*3+k] == b) hasB = true; if (hasB) continue;
      double n0[3]; fnormal(t, n0); int sv[3] = {F[t*3], F[t*3+1], F[t*3+2]}; for (int k = 0; k < 3; k++) if (F[t*3+k] == a) F[t*3+k] = b;
      double n1[3]; double ar = fnormal(t, n1); for (int k = 0; k < 3; k++) F[t*3+k] = sv[k];
      if (ar < 1e-12 || n0[0]*n1[0]+n0[1]*n1[1]+n0[2]*n1[2] < 0.3) { flip = true; break; } }
    if (flip) { continue; }
    // collassa a -> b
    for (int t : vf[a]) { if (dead[t]) continue; bool hasB = false; for (int k = 0; k < 3; k++) if (F[t*3+k] == b) hasB = true;
      if (hasB) { dead[t] = 1; alive--; continue; }
      for (int k = 0; k < 3; k++) if (F[t*3+k] == a) F[t*3+k] = b; vf[b].push_back(t); }
    vf[a].clear(); q[b].add(q[a]); rep[a] = b; ver[a]++; ver[b]++;
    // pulisci lista di b
    vector<int> nb; for (int t : vf[b]) if (!dead[t]) nb.push_back(t); sort(nb.begin(), nb.end()); nb.erase(unique(nb.begin(), nb.end()), nb.end()); vf[b] = nb;
    pushV(b); for (int t : vf[b]) for (int k = 0; k < 3; k++) { int c = F[t*3+k]; if (c != b) { ver[c]++; pushV(c); } }
  }
  vector<int> remap(nv, -1); int n2 = 0; vector<int> out;
  for (int t = 0; t < nf; t++) if (!dead[t]) for (int k = 0; k < 3; k++) { int v = F[t*3+k]; if (remap[v] < 0) remap[v] = n2++; out.push_back(remap[v]); }
  FILE *o = fopen(argv[2], "wb"); int nf2 = out.size() / 3; fwrite(&n2, 4, 1, o); fwrite(&nf2, 4, 1, o); fwrite(remap.data(), 4, nv, o); fwrite(out.data(), 4, out.size(), o); fclose(o);
  fprintf(stderr, "faces %d -> %d, verts %d -> %d\n", nf, nf2, nv, n2);
}

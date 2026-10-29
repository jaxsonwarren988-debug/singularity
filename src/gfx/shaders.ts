/* GLSL ES 1.00 — runs on both WebGL1 and WebGL2 contexts. */

const HEAD = `
precision highp float;
uniform vec2 u_res; uniform float u_time; uniform vec3 u_c1; uniform vec3 u_c2;
uniform float u_speed; uniform float u_intensity; uniform float u_scale;
uniform float u_aber; uniform float u_pulse; uniform vec2 u_mouse; uniform vec4 u_flags;
#define PI 3.141592653589793
#define T (u_time * u_speed)

float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec2 hash22(vec2 p){ float n = hash21(p); return vec2(n, hash21(p + n)); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  float a = hash21(i), b = hash21(i+vec2(1.,0.)), c = hash21(i+vec2(0.,1.)), d = hash21(i+vec2(1.,1.));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}
float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v += a*noise(p); p = p*2.03 + 17.1; a *= 0.5; } return v; }
mat2 rot(float a){ float s=sin(a), c=cos(a); return mat2(c,-s,s,c); }
vec3 pal(float t, vec3 a, vec3 b){ return mix(a, b, 0.5+0.5*cos(6.28318*t)); }

vec3 post(vec3 col, vec2 uv){
  float r = length(uv);
  // shockwave from reactor clicks
  float w = u_pulse;
  if (w > 0.001) {
    float ring = smoothstep(0.035, 0.0, abs(r - (1.0 - w) * 1.15));
    col += mix(u_c1, u_c2, 0.4) * ring * w * 1.6;
    col *= 1.0 + w * 0.25;
  }
  if (u_aber > 0.001) {
    float ab = smoothstep(0.1, 0.85, r) * 0.06 * u_aber;
    col.r *= 1.0 + ab; col.b *= 1.0 + ab * 1.4; col.g *= 1.0 - ab * 0.25;
  }
  col *= 1.0 - 0.42 * r * r;
  return col * u_intensity;
}
vec2 mousePar(){ return u_mouse * 0.035 * u_flags.w; }
`;

const bodies: Record<string, string> = {
  blackhole: `
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*u_res)/u_res.y;
  vec2 p = uv * (2.0 - u_scale) - mousePar();
  float r = length(p); vec2 dir = p/max(r,1e-5);
  vec2 lp = p;
  if (u_flags.y > 0.5) { float bend = 0.020/(r*r+0.010); lp = p - dir*bend*0.05*smoothstep(1.1,0.02,r); }
  vec3 col = vec3(0.0);
  if (u_flags.z > 0.5) {
    for (int i=0;i<3;i++){
      float s = float(i);
      vec2 sp = lp*(4.0+s*5.0) + vec2(s*23.1, s*11.7);
      vec2 id = floor(sp); vec2 gv = fract(sp)-0.5;
      float h = hash21(id+s*37.0);
      float tw = 0.5+0.5*sin(T*1.7+h*6.283);
      float star = smoothstep(0.09,0.0,length(gv))*step(0.978,h);
      col += mix(vec3(1.0), u_c2, h*0.6)*star*tw*(1.0-s*0.22);
    }
    col += u_c2 * fbm(lp*1.6 + vec2(T*0.02, T*0.014)) * 0.07;
  }
  float hz = 0.16;
  if (u_flags.x > 0.5) {
    vec2 q = vec2(p.x, p.y/0.42); float rq = length(q); float aq = atan(q.y,q.x);
    float turb = fbm(q*3.2 + vec2(T*0.25, T*0.12));
    float rings = 0.5+0.5*sin(rq*34.0 - T*3.2 + turb*5.0 + aq*2.0);
    float dop = 0.35 + 0.65*pow(0.5+0.5*cos(aq-0.4), 1.6);
    float band = smoothstep(hz+0.01, hz+0.09, rq)*smoothstep(1.05,0.42,rq);
    float disk = band*(0.25+0.75*rings)*(0.45+turb)*dop;
    vec3 hot = mix(u_c1, vec3(1.0), 0.6);
    col += mix(u_c1*0.45, hot, smoothstep(1.0,hz,rq))*disk*2.6;
    float halo = smoothstep(0.55,0.16,abs(r-hz-0.03))*0.25;
    col += u_c1*halo;
  }
  if (u_flags.w > 0.5 || true) {
    float rr = abs(r-hz-0.012);
    col += mix(u_c1, vec3(1.0), 0.75)*smoothstep(0.013,0.0,rr)*3.4;
  }
  float mask = smoothstep(hz, hz+0.016, r);
  col *= mask;
  col += u_c1*0.05*smoothstep(0.6,0.0,r)*(1.0-mask);
  gl_FragColor = vec4(post(col, uv), 1.0);
}`,

  nebula: `
void main(){
  vec2 uv = (gl_FragCoord.xy-0.5*u_res)/u_res.y;
  vec2 p = uv*(2.2-u_scale) - mousePar();
  vec2 q = p*1.4;
  float t = T*0.08;
  vec2 warp = vec2(fbm(q+vec2(t,0.0)), fbm(q+vec2(5.2,1.3)-t));
  float f = fbm(q + warp*1.9 + vec2(0.0, t*0.6));
  float f2 = fbm(q*2.1 - warp*1.2 + 3.7);
  vec3 col = mix(u_c2*0.16, u_c1*0.85, smoothstep(0.25,0.85,f));
  col = mix(col, u_c2*0.9, pow(f2,3.0)*0.8);
  col += vec3(1.0)*pow(smoothstep(0.62,1.0,f),4.0)*0.55;
  for (int i=0;i<2;i++){
    float s=float(i); vec2 sp=p*(7.0+s*9.0)+s*31.0;
    vec2 id=floor(sp); vec2 gv=fract(sp)-0.5; float h=hash21(id+s*13.0);
    float star=smoothstep(0.075,0.0,length(gv))*step(0.972,h);
    col += vec3(1.0,0.96,1.0)*star*(0.5+0.5*sin(T*2.0+h*30.0));
  }
  col *= 0.85 + 0.4*f;
  gl_FragColor = vec4(post(col, uv),1.0);
}`,

  aurora: `
void main(){
  vec2 uv=(gl_FragCoord.xy-0.5*u_res)/u_res.y;
  vec2 p=uv*(2.0-u_scale)-mousePar();
  vec3 col = mix(vec3(0.01,0.02,0.05), u_c2*0.06, smoothstep(-0.6,0.7,p.y));
  for (int i=0;i<2;i++){
    float s=float(i); vec2 sp=p*(9.0+s*11.0)+s*17.0;
    vec2 id=floor(sp); vec2 gv=fract(sp)-0.5; float h=hash21(id);
    col += vec3(1.0)*smoothstep(0.07,0.0,length(gv))*step(0.983,h)*(0.4+0.6*sin(T*2.0+h*40.0))*step(p.y,0.05);
  }
  for (int i=0;i<5;i++){
    float fi=float(i);
    float off = fi*0.16;
    float wave = fbm(vec2(p.x*1.6 + T*0.12 + fi*3.1, T*0.05+fi))*0.55;
    float y = -0.05 + wave + off*0.5 - 0.25;
    float band = exp(-abs(p.y - y)*(9.0 - fi));
    float flick = 0.55+0.45*sin(T*0.9+fi*2.0+p.x*3.0);
    vec3 c = mix(u_c1, u_c2, fi/4.0);
    col += c*band*flick*0.55;
    col += c*exp(-abs(p.y-y)*3.0)*0.06;
  }
  float ground = smoothstep(-0.28,-0.55,p.y);
  col = mix(col, vec3(0.01,0.012,0.02), ground);
  col += u_c1*0.05*exp(-abs(p.y+0.3)*10.0);
  gl_FragColor=vec4(post(col,uv),1.0);
}`,

  matrix: `
float glyph(vec2 gv, float seed){
  vec2 q = floor(gv*vec2(4.0,6.0));
  return step(0.55, hash21(q + seed*17.0));
}
void main(){
  vec2 uv=(gl_FragCoord.xy-0.5*u_res)/u_res.y;
  vec2 p=(uv - mousePar())*(2.4-u_scale);
  float cols = 34.0;
  vec2 g = vec2(p.x*cols, p.y*cols);
  float ci = floor(g.x);
  float speed = 3.0 + hash21(vec2(ci,3.7))*9.0;
  float off = hash21(vec2(ci,9.1))*40.0;
  float head = fract((T*speed*0.06 + off));
  float y = fract(g.y/ (cols*1.4) + 0.5);
  float d = fract(head - y + 1.0);
  float trail = pow(1.0-d, 14.0);
  float cell = floor(g.y + T*speed*0.6);
  float gl = glyph(fract(vec2(g.x, g.y)), hash21(vec2(ci, cell)));
  float bright = trail*gl;
  vec3 col = u_c1*bright*1.5;
  col += mix(u_c1, vec3(1.0), 0.85)*pow(1.0-d,90.0)*gl*2.2;
  col += u_c1*0.035*noise(p*40.0);
  col += u_c2*0.02*smoothstep(0.6,0.0,length(uv));
  gl_FragColor=vec4(post(col,uv),1.0);
}`,

  warp: `
void main(){
  vec2 uv=(gl_FragCoord.xy-0.5*u_res)/u_res.y;
  vec2 p=(uv - mousePar()*2.0)*(2.0-u_scale);
  float a = atan(p.y,p.x);
  float r = length(p);
  vec3 col = vec3(0.0);
  float z = 1.0/max(r,0.03);
  for (int i=0;i<3;i++){
    float fi=float(i);
    float aa = a*(9.0+fi*7.0);
    float lane = floor(aa);
    float h = hash21(vec2(lane, fi*7.3));
    float sp = 0.4+h*1.6;
    float t = fract(z*0.32 - T*sp*0.5 + h);
    float streak = pow(t, 12.0)*smoothstep(0.0,0.35,r);
    float w = smoothstep(0.42,0.5,abs(fract(aa)-0.5));
    col += mix(u_c1,u_c2,h)*streak*(1.0-w)*(1.0-fi*0.22)*1.5;
  }
  float core = exp(-r*7.0);
  col += mix(u_c2,vec3(1.0),0.5)*core*1.2;
  col += u_c1*0.12*pow(max(0.0,1.0-r),3.0);
  float ring = smoothstep(0.02,0.0,abs(fract(z*0.32 - T*0.4)-0.5)-0.48);
  col += u_c2*ring*0.12;
  gl_FragColor=vec4(post(col,uv),1.0);
}`,

  plasma: `
void main(){
  vec2 uv=(gl_FragCoord.xy-0.5*u_res)/u_res.y;
  vec2 p=(uv - mousePar())*(3.4-u_scale*1.6);
  float t=T*0.5;
  float v = sin(p.x*3.0+t);
  v += sin((p.y*3.0+t)*1.3);
  v += sin((p.x+p.y)*2.4+t*0.7);
  float cx = p.x+0.5*sin(t*0.6), cy = p.y+0.5*cos(t*0.4);
  v += sin(sqrt(cx*cx+cy*cy)*4.0+t);
  v *= 0.5;
  vec3 col = 0.5+0.5*cos(vec3(v*2.0, v*2.0+2.1, v*2.0+4.2));
  col = mix(col, u_c1, 0.42);
  col = mix(col, u_c2, 0.32*(0.5+0.5*sin(v*3.1)));
  col *= 0.55+0.45*sin(v*6.283);
  col += pow(max(0.0,sin(v*3.14)),8.0)*0.4;
  gl_FragColor=vec4(post(col*0.7,uv),1.0);
}`,

  grid: `
void main(){
  vec2 uv=(gl_FragCoord.xy-0.5*u_res)/u_res.y;
  vec2 p=uv*(2.0-u_scale)-mousePar();
  vec3 col = mix(u_c1*0.10, vec3(0.02,0.01,0.05), smoothstep(-0.1,0.6,p.y));
  for (int i=0;i<2;i++){
    float s=float(i); vec2 sp=p*(11.0+s*13.0)+s*23.0;
    vec2 id=floor(sp); vec2 gv=fract(sp)-0.5; float h=hash21(id);
    col += vec3(1.0)*smoothstep(0.06,0.0,length(gv))*step(0.985,h)*step(0.02,p.y);
  }
  float sunR = 0.30;
  vec2 sc = vec2(0.0, 0.10);
  float sd = length(p-sc);
  float sun = smoothstep(sunR, sunR-0.004, sd);
  float stripes = step(0.5, fract((p.y-0.02)*26.0 - T*0.25));
  sun *= mix(1.0, stripes, smoothstep(0.12,-0.1,p.y));
  col = mix(col, mix(u_c1, u_c2, smoothstep(0.3,-0.2,p.y)), sun);
  col += u_c1*0.35*exp(-sd*3.2)*(1.0-sun);
  if (p.y < 0.0) {
    float persp = 0.16/(-p.y+0.001);
    float gx = abs(fract(p.x*persp*1.2 + 0.5)-0.5);
    float gz = abs(fract(persp*0.6 - T*0.35)-0.5);
    float line = smoothstep(0.03,0.0,gx)*0.9 + smoothstep(0.035,0.0,gz);
    vec3 gcol = mix(u_c2, u_c1, 0.35);
    col = mix(vec3(0.02,0.01,0.04), gcol, clamp(line,0.0,1.0)*smoothstep(0.0,-0.5,p.y));
    col += gcol*0.06*exp(p.y*4.0);
  }
  col += u_c1*0.25*exp(-abs(p.y)*60.0);
  gl_FragColor=vec4(post(col,uv),1.0);
}`,

  ocean: `
float caustic(vec2 p, float t){
  vec2 i = p; float c = 1.0; float inten = 0.005;
  for (int n=0;n<5;n++){
    float tt = t*(1.0-(3.5/float(n+1)));
    i = p + vec2(cos(tt-i.x)+sin(tt+i.y), sin(tt-i.y)+cos(tt+i.x));
    c += 1.0/length(vec2(p.x/(sin(i.x+tt)/inten), p.y/(cos(i.y+tt)/inten)));
  }
  c /= 5.0; c = 1.17-pow(c,1.4);
  return pow(abs(c), 8.0);
}
void main(){
  vec2 uv=(gl_FragCoord.xy-0.5*u_res)/u_res.y;
  vec2 p=(uv-mousePar())*(2.6-u_scale);
  float c = caustic(p*2.4, T*0.35);
  vec3 deep = mix(vec3(0.01,0.04,0.08), u_c2*0.12, 0.5+0.5*p.y);
  vec3 col = deep + mix(u_c2, u_c1, 0.35)*c*1.25;
  col += u_c1*0.06*fbm(p*2.0+T*0.05);
  float surf = smoothstep(0.45,0.5,uv.y);
  col += u_c2*surf*0.05;
  gl_FragColor=vec4(post(col,uv),1.0);
}`,

  cells: `
void main(){
  vec2 uv=(gl_FragCoord.xy-0.5*u_res)/u_res.y;
  vec2 p=(uv-mousePar())*(5.0-u_scale*2.4);
  vec2 g=floor(p), f=fract(p);
  float d1=8.0, d2=8.0; vec2 id1=vec2(0.0);
  for (int y=-1;y<=1;y++) for (int x=-1;x<=1;x++){
    vec2 n=vec2(float(x),float(y));
    vec2 o=hash22(g+n);
    o = 0.5+0.45*sin(T*0.7 + 6.283*o);
    float d=length(n+o-f);
    if (d<d1){ d2=d1; d1=d; id1=g+n; } else if (d<d2){ d2=d; }
  }
  float edge = smoothstep(0.0,0.08,d2-d1);
  float h = hash21(id1);
  vec3 col = mix(u_c1, u_c2, h)*pow(1.0-d1,2.2)*0.75;
  col *= edge*0.85+0.15;
  col += mix(u_c2,vec3(1.0),0.4)*(1.0-edge)*0.7;
  col += u_c1*0.06*smoothstep(0.6,0.0,d1);
  gl_FragColor=vec4(post(col*0.85,uv),1.0);
}`,

  fractal: `
void main(){
  vec2 uv=(gl_FragCoord.xy-0.5*u_res)/u_res.y;
  vec2 p=(uv-mousePar())*(2.6-u_scale);
  float a = atan(p.y,p.x); float r=length(p);
  float seg = 6.0;
  a = mod(a, 6.28318/seg); a = abs(a - 3.14159/seg);
  p = vec2(cos(a),sin(a))*r;
  p *= rot(T*0.05);
  vec2 c = vec2(0.7885*cos(T*0.13), 0.7885*sin(T*0.171));
  vec2 z = p*1.25;
  float it=0.0; float esc=0.0;
  for (int i=0;i<48;i++){
    z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;
    if (dot(z,z) > 16.0) { esc = float(i); break; }
    it += 1.0;
  }
  float sm = esc > 0.0 ? esc - log2(log2(max(dot(z,z),2.0))) + 4.0 : 48.0;
  float t = sm/48.0;
  vec3 col = pal(t*2.4 + T*0.03, u_c1*0.9, u_c2*0.9);
  col *= smoothstep(0.0,0.12,t)*1.5;
  col += u_c1*pow(1.0-t,6.0)*0.5;
  col *= 0.35 + 0.65*smoothstep(48.0, 20.0, it);
  gl_FragColor=vec4(post(col,uv),1.0);
}`,

  ribbons: `
void main(){
  vec2 uv=(gl_FragCoord.xy-0.5*u_res)/u_res.y;
  vec2 p=(uv-mousePar())*(2.2-u_scale);
  vec3 col=vec3(0.0);
  float t=T*0.35;
  for (int i=0;i<7;i++){
    float fi=float(i);
    float ph = fi*0.7;
    float y = sin(p.x*1.7 + t + ph)*0.28 + sin(p.x*3.1 - t*0.7 + ph*2.0)*0.12 + (fi-3.0)*0.11;
    float d = abs(p.y - y);
    float glow = 0.012/max(d,0.004);
    float core = smoothstep(0.008,0.0,d);
    vec3 c = mix(u_c1,u_c2, fi/6.0);
    col += c*glow*0.16 + mix(c,vec3(1.0),0.6)*core*0.8;
  }
  col += u_c2*0.05*fbm(p*2.0+t*0.2);
  gl_FragColor=vec4(post(col,uv),1.0);
}`,

  storm: `
void main(){
  vec2 uv=(gl_FragCoord.xy-0.5*u_res)/u_res.y;
  vec2 p=(uv-mousePar())*(2.4-u_scale);
  float t=T*0.4;
  vec2 q = p*1.8;
  float f = fbm(q + vec2(t*0.4, -t*0.2));
  float f2 = fbm(q*2.0 - vec2(t*0.3, t*0.5) + f*2.0);
  float ridge = 1.0 - abs(f2*2.0-1.0);
  float bolt = pow(ridge, 14.0);
  float flick = step(0.72, hash21(vec2(floor(T*3.0), 1.0))) * (0.5+0.5*sin(T*60.0));
  vec3 col = mix(vec3(0.015,0.02,0.045), u_c2*0.14, f);
  col += mix(u_c1,u_c2,0.4)*bolt*(1.6+flick*2.4);
  col += u_c1*pow(ridge,4.0)*0.18;
  col += vec3(0.9,0.95,1.0)*flick*0.06*smoothstep(0.9,0.0,length(uv));
  float rain = noise(vec2(p.x*90.0, p.y*8.0 - T*6.0));
  col += u_c2*step(0.965, rain)*0.25;
  gl_FragColor=vec4(post(col,uv),1.0);
}`,

  fireflies: `
void main(){
  vec2 uv=(gl_FragCoord.xy-0.5*u_res)/u_res.y;
  vec2 p=(uv-mousePar())*(2.2-u_scale);
  vec3 col = mix(vec3(0.015,0.02,0.03), u_c2*0.05, smoothstep(-0.6,0.7,p.y));
  col += u_c2*0.045*fbm(p*1.5 + T*0.03);
  for (int i=0;i<4;i++){
    float fi=float(i);
    float sc = 3.2 + fi*2.6;
    vec2 sp = p*sc + vec2(fi*13.7, fi*7.3);
    vec2 id = floor(sp);
    vec2 gv = fract(sp)-0.5;
    float h = hash21(id + fi*29.0);
    vec2 wob = vec2(sin(T*(0.35+h*0.5)+h*30.0), cos(T*(0.28+h*0.4)+h*17.0))*0.34;
    float d = length(gv - wob);
    float blink = pow(0.5+0.5*sin(T*(1.1+h*2.2)+h*40.0), 3.0);
    float core = smoothstep(0.05,0.0,d);
    float halo = 0.006/max(d*d,0.0008);
    float on = step(0.62, h);
    col += mix(u_c1, u_c2, h)*on*blink*(core*1.6 + halo*0.5)*(1.0-fi*0.16);
  }
  col *= 1.0 - 0.25*length(uv);
  gl_FragColor=vec4(post(col,uv),1.0);
}`,

  hexfield: `
vec4 hexCoords(vec2 p){
  vec2 r = vec2(1.0, 1.7320508);
  vec2 h = r*0.5;
  vec2 a = mod(p, r) - h;
  vec2 b = mod(p - h, r) - h;
  vec2 gv = dot(a,a) < dot(b,b) ? a : b;
  return vec4(gv, p - gv);
}
float hexDist(vec2 p){
  p = abs(p);
  return max(dot(p, normalize(vec2(1.0,1.7320508))), p.x);
}
void main(){
  vec2 uv=(gl_FragCoord.xy-0.5*u_res)/u_res.y;
  vec2 p=(uv-mousePar())*(7.0-u_scale*3.0);
  p *= rot(0.12*sin(T*0.06));
  vec4 hc = hexCoords(p);
  float d = hexDist(hc.xy);
  float id = hash21(hc.zw);
  float wave = sin(length(hc.zw)*0.55 - T*1.5 + id*3.0);
  float pulse = pow(0.5+0.5*wave, 4.0);
  float edge = smoothstep(0.5,0.44,d);
  float rim = smoothstep(0.44,0.5,d);
  vec3 col = vec3(0.012,0.016,0.026);
  col += mix(u_c2, u_c1, id)*edge*pulse*0.75;
  col += mix(u_c1, vec3(1.0), 0.35)*rim*0.42;
  col += u_c1*rim*pulse*0.9;
  float spark = step(0.972, hash21(hc.zw + floor(T*1.4)));
  col += vec3(1.0)*spark*edge*0.6;
  gl_FragColor=vec4(post(col,uv),1.0);
}`,

  lava: `
void main(){
  vec2 uv=(gl_FragCoord.xy-0.5*u_res)/u_res.y;
  vec2 p=(uv-mousePar())*(2.6-u_scale);
  float t = T*0.14;
  vec2 q = vec2(fbm(p*1.6 + vec2(0.0,t)), fbm(p*1.6 + vec2(4.7,2.1) - t));
  float f = fbm(p*2.1 + q*2.4);
  float crust = smoothstep(0.42,0.62,f);
  float veins = pow(1.0 - abs(f*2.0-1.0), 6.0);
  vec3 hot = mix(u_c1, vec3(1.0,0.95,0.75), 0.55);
  vec3 col = mix(vec3(0.035,0.014,0.012), u_c1*0.28, crust);
  col += hot*veins*1.5;
  col += u_c2*pow(max(0.0,f-0.62),2.0)*2.2;
  col *= 0.75 + 0.5*f;
  float bub = smoothstep(0.86,1.0, fbm(p*4.0 - vec2(0.0,t*2.4)));
  col += hot*bub*0.7;
  gl_FragColor=vec4(post(col,uv),1.0);
}`,

  snowfall: `
void main(){
  vec2 uv=(gl_FragCoord.xy-0.5*u_res)/u_res.y;
  vec2 p=(uv-mousePar()*1.4)*(2.0-u_scale);
  vec3 col = mix(vec3(0.03,0.045,0.075), u_c2*0.10, smoothstep(-0.7,0.8,p.y));
  col += u_c2*0.05*fbm(p*1.2 + vec2(T*0.02,0.0));
  for (int i=0;i<5;i++){
    float fi=float(i);
    float depth = 1.0 - fi*0.16;
    float sc = 5.0 + fi*5.5;
    vec2 sp = p*sc;
    sp.y += T*(0.35+fi*0.28);
    sp.x += sin(T*0.3 + fi)*0.6;
    vec2 id = floor(sp);
    vec2 gv = fract(sp)-0.5;
    float h = hash21(id+fi*41.0);
    vec2 off = vec2((h-0.5)*0.6, (hash21(id+7.1)-0.5)*0.6);
    float d = length(gv-off);
    float flake = smoothstep(0.09*depth, 0.0, d)*step(0.72,h);
    col += mix(vec3(1.0), u_c2, 0.35)*flake*depth*0.9;
  }
  float drift = smoothstep(-0.25,-0.6,p.y);
  col = mix(col, mix(vec3(0.85,0.9,1.0), u_c2, 0.2)*0.35, drift*0.55);
  gl_FragColor=vec4(post(col,uv),1.0);
}`,

  vortex: `
void main(){
  vec2 uv=(gl_FragCoord.xy-0.5*u_res)/u_res.y;
  vec2 p=(uv-mousePar())*(2.2-u_scale);
  float r = length(p);
  float a = atan(p.y,p.x);
  float spin = a + T*0.16 + 2.4/(r+0.28);
  vec3 col = vec3(0.008,0.01,0.02);
  float arms = 0.5+0.5*sin(spin*2.0);
  float disk = exp(-r*1.9)*smoothstep(1.3,0.15,r);
  float dust = fbm(vec2(spin*1.6, r*3.4 - T*0.1));
  col += mix(u_c2, u_c1, arms)*disk*(0.35+0.9*pow(arms,2.2))*(0.5+dust);
  col += u_c1*pow(disk,2.0)*0.7;
  for (int i=0;i<3;i++){
    float fi=float(i);
    vec2 sp = vec2(spin*3.0, r*9.0)*(1.0+fi*0.7) + fi*17.0;
    vec2 id=floor(sp); vec2 gv=fract(sp)-0.5;
    float h=hash21(id+fi*23.0);
    float star=smoothstep(0.10,0.0,length(gv))*step(0.90,h);
    col += mix(vec3(1.0), u_c2, h)*star*(0.5+0.5*sin(T*2.0+h*30.0))*disk*2.0;
  }
  float core = exp(-r*13.0);
  col += mix(vec3(1.0), u_c1, 0.35)*core*1.6;
  gl_FragColor=vec4(post(col,uv),1.0);
}`,

  circuit: `
float trace(vec2 p, float seed){
  vec2 id = floor(p);
  vec2 gv = fract(p);
  float h = hash21(id + seed);
  float dir = step(0.5, h);
  float line = dir > 0.5 ? abs(gv.y-0.5) : abs(gv.x-0.5);
  float w = smoothstep(0.075, 0.02, line);
  float node = smoothstep(0.16, 0.09, length(gv-0.5))*step(0.78, h);
  float travel = dir > 0.5 ? gv.x : gv.y;
  float pulse = pow(0.5+0.5*sin((travel + id.x*0.7 + id.y*1.3)*3.0 - T*2.2 + h*9.0), 12.0);
  return w*0.35 + node*0.7 + w*pulse*1.8;
}
void main(){
  vec2 uv=(gl_FragCoord.xy-0.5*u_res)/u_res.y;
  vec2 p=(uv-mousePar())*(9.0-u_scale*4.0);
  vec3 col = vec3(0.01,0.014,0.018);
  col += u_c2*0.05*trace(p*0.5, 3.7);
  col += u_c1*trace(p, 11.3)*0.85;
  col += mix(u_c1,u_c2,0.5)*trace(p*2.0, 27.1)*0.30;
  float scan = smoothstep(0.02,0.0,abs(fract(p.y*0.06 - T*0.09)-0.5)-0.48);
  col += u_c2*scan*0.10;
  col += u_c1*0.03*noise(p*30.0);
  gl_FragColor=vec4(post(col,uv),1.0);
}`,
};

export const shaderSource = (id: string) => HEAD + (bodies[id] || bodies.blackhole);
export const VERTEX = `
attribute vec2 a_pos;
void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }
`;
export const shaderIds = Object.keys(bodies);

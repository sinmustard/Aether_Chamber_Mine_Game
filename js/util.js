"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const norm=a=>{while(a>Math.PI)a-=TAU;while(a<-Math.PI)a+=TAU;return a;};
const angDiff=(a,b)=>Math.abs(norm(a-b));
const dist=(a,b,c,d)=>Math.hypot(a-c,b-d);

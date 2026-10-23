const fs = require('fs');
const sharp = require('sharp');
const out = 'public/campaigns/relationship';
const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
function poster(w,h,kind) {
 const portrait=h>w, scale=w/1200;
 const lines=kind==='sample'?['What could a calmer','conversation change?']:['Less guessing.','A clearer question.'];
 const top=portrait?240:150, size=portrait?94:78;
 let text=lines.map((s,i)=>`<text x="90" y="${top+i*110}" font-family="Georgia,serif" font-size="${size}" fill="#f5e8cf">${esc(s)}</text>`).join('');
 const cardsY=portrait?650:445;
 const labels=['YOU','THEM','CONNECTION','STRENGTH','TENSION','PATH'];
 let cards=labels.map((s,i)=>`<g transform="translate(${90+i*172} ${cardsY})"><rect width="150" height="${portrait?240:95}" rx="12" fill="#17112d" stroke="#9e8358"/><circle cx="75" cy="${portrait?90:32}" r="${portrait?27:12}" fill="none" stroke="#d4b982"/><text x="75" y="${portrait?200:76}" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" fill="#dfd4bf">${s}</text></g>`).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 1200 ${h/scale}"><defs><radialGradient id="bg"><stop stop-color="#34204e"/><stop offset="1" stop-color="#0b0913"/></radialGradient></defs><rect width="1200" height="${h/scale}" fill="url(#bg)"/><rect x="35" y="35" width="1130" height="${h/scale-70}" rx="18" fill="none" stroke="#846f4c"/><text x="90" y="85" font-family="Arial,sans-serif" font-size="20" letter-spacing="4" fill="#d4b982">COSMIC SPIRIT GUIDE</text>${text}<text x="90" y="${portrait?520:370}" font-family="Arial,sans-serif" font-size="28" fill="#d4b982">Six cards. One relationship question.</text>${cards}${portrait?'<text x="90" y="1090" font-family="Georgia,serif" font-size="55" fill="#f5e8cf">$4.99 · One-time payment</text><text x="90" y="1150" font-family="Arial,sans-serif" font-size="26" fill="#dfd4bf">AI-assisted tarot. No subscription.</text><text x="90" y="1270" font-family="Arial,sans-serif" font-size="25" fill="#d4b982">Read the example before you buy.</text>':''}<text x="90" y="${h/scale-65}" font-family="Arial,sans-serif" font-size="20" fill="#b9aec7">cosmicspiritguide.com · For reflection, not prediction.</text></svg>`;
}
(async()=>{for(const [name,w,h,kind] of [['offer-social',1200,630,'offer'],['offer-post',1080,1350,'offer'],['sample-pin',1000,1500,'sample']]) {
 const svg=poster(w,h,kind);fs.writeFileSync(`${out}/${name}.svg`,svg);await sharp(Buffer.from(svg)).png().toFile(`${out}/${name}.png`);
} console.log('Built three campaign PNGs and editable SVGs.');})();

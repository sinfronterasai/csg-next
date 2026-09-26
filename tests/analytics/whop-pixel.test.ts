import fs from 'node:fs';

describe('global Whop base pixel', () => {
  const layout = fs.readFileSync('src/app/layout.tsx', 'utf8');
  const suppliedSnippet = `!function(w,d,s,u,n,a,b){if(w[n])return;a=w[n]={q:[],t:+new Date,s:[],o:u,track:function(){a.q.push([+new Date].concat([].slice.call(arguments)))},setScope:function(){a.s=[].slice.call(arguments).filter(function(x){return typeof x==="string"});a.q.push([+new Date,"setScope"].concat(a.s))},scope:function(){var c=[].slice.call(arguments);return{track:function(){a.q.push([+new Date].concat([].slice.call(arguments)).concat([{__scope:c}]))}}}};b=d.createElement(s);b.async=1;b.src=u+"/s.js";d.getElementsByTagName(s)[0].parentNode.insertBefore(b,d.getElementsByTagName(s)[0])}(window,document,"script","https://t.whop.tw","whop");whop.setScope("biz_yXvRBAxPMOzd7b");whop.track("page");`;

  it('preserves the supplied base snippet exactly in a global afterInteractive Script', () => {
    expect(layout).toContain('<Script id="whop-pixel" strategy="afterInteractive">');
    const sourceMatch = layout.match(/<Script id="whop-pixel" strategy="afterInteractive">\s*\{`([\s\S]*?)`\}\s*<\/Script>/);
    expect(sourceMatch?.[1].replaceAll('\\"', '"')).toBe(suppliedSnippet);
  });

  it('contains one base pixel and no extra Whop conversion events', () => {
    expect(layout.match(/https:\/\/t\.whop\.tw/g)).toHaveLength(1);
    expect(layout.match(/biz_yXvRBAxPMOzd7b/g)).toHaveLength(1);
    expect(layout.match(/whop\.track\("page"\)/g)).toHaveLength(1);
    expect(layout).not.toMatch(/whop\.track\("(?:purchase|subscription|trial|checkout-complete|revenue)"/);
  });

  it('preserves the existing GA4 integration', () => {
    expect(layout).toContain('https://www.googletagmanager.com/gtag/js?id=G-T0J78R09VN');
    expect(layout).toContain("gtag('config', 'G-T0J78R09VN');");
  });
});
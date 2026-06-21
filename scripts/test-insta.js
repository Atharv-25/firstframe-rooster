fetch('https://www.instagram.com/ugcwithshiw/')
  .then(r=>r.text())
  .then(t=>{
    console.log("Includes og:description:", t.includes('og:description'));
    const m = t.match(/<meta property="og:description" content="([^"]+)"/);
    console.log("Match:", m ? m[1] : null);
  });

fetch('https://www.instagram.com/ugcwithshiw/')
  .then(r=>r.text())
  .then(t=>{
    const m = t.match(/<meta property="og:title" content="([^"]+)"/);
    console.log("Title Match:", m ? m[1] : null);
  });

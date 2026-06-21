fetch('https://api.allorigins.win/get?url=' + encodeURIComponent('https://www.instagram.com/ugcwithshiw/'))
  .then(r=>r.json())
  .then(j=>{
    const t=j.contents;
    const m=t.match(/<meta property="og:description" content="([^"]+)"/);
    console.log(m ? m[1] : 'No match');
  });

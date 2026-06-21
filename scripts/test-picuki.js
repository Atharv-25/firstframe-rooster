fetch('https://www.picuki.com/profile/ugcwithshiw')
  .then(r=>r.text())
  .then(t=>{
    const m=t.match(/followers_count\">([\d,]+)</i);
    console.log(m ? m[1] : 'No match');
  });

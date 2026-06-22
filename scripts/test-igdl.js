import igdl from 'instagram-url-direct';

async function test() {
  try {
    const res = await igdl('https://www.instagram.com/reel/DXzOCOyS-c/');
    console.log(res);
  } catch (e) {
    console.error(e);
  }
}
test();

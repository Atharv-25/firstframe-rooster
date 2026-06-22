import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

function formatNumber(numStr) {
  if (!numStr) return '—';
  const num = parseInt(numStr.replace(/,/g, ''), 10);
  if (isNaN(num)) return numStr;
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

const rawData = `
1	Ayushi Singh	✅ Available	● Complete	Bangalore	ayusingh9876@gmail.com	+919606132803	https://www.instagram.com/ayushisingh.png	Beauty & Skincare, Fashion & Style, Lifestyle, UGC / Product Demos	3381	4.44%	✅ Good	137	13		Direct Bank Transfer
2	Aryahi Barde	✅ Available	● Complete	Mumbai	aryahi.s.barde@gmail.com	+919167013638	https://www.instagram.com/aaryahibarde	Beauty & Skincare, Fashion & Style, Home & Lifestyle, Lifestyle	13035	19.83%	🔥 Excellent	2561	25		Direct Bank Transfer
3	Aadrika Acharya	✅ Available	● Complete	Delhi	somya.123acharya@gmail.com	+918810645041	https://www.instagram.com/aadrikaa_acharya	Beauty & Skincare, Fashion & Style, Tech & Gadgets, UGC / Product Demos, Unboxing	721	37.37%	🔥 Excellent	267	2		Direct Bank Transfer
4	Gurnoor Kaur Sethi	✅ Available	● Complete	India	gurnoorkaursethi67@gmail.com	+917060526895	https://www.instagram.com/gurnoorkaursethi08	Beauty & Skincare, Fashion & Style, Lifestyle, Travel & Outdoors	20766	2.33%	⚠️ Low	472	11		Direct Bank Transfer
5	Sagarika Majumder	✅ Available	● Complete	Lumding	sagarikamaj15@gmail.com	+917636888226	https://www.instagram.com/_sagewithcurls_	Beauty & Skincare, Fashion & Style, Fitness & Wellness, UGC / Product Demos, Unboxing	1490	13.74%	🔥 Excellent	200	5		Direct Bank Transfer
6	Kavya Duraisamy	✅ Available	● Complete	India	kavyaduraisamy2@gmail.com	+919894660476	https://www.instagram.com/glowcheck_with_k	Beauty & Skincare, Fashion & Style, Home & Lifestyle	3521	5.82%	🔥 Excellent	199	6		Direct Bank Transfer
7	Akanksha Singh	✅ Available	● Complete	Other	akankshasingh8516@gmail.com	+917973065625	https://www.instagram.com/_akanksha.x_	Beauty & Skincare, Fashion & Style, Food & Cooking, Home & Lifestyle, Lifestyle, UGC / Product Demos, Unboxing	6520	1.29%	🟡 Average	83	1		PayPal
8	Astha Ajmera	✅ Available	● Complete	Other	Asthaajmera2205@gmail.com	+919875283100	https://www.instagram.com/allabout.astha	Beauty & Skincare, Fashion & Style, Home & Lifestyle, Lifestyle, UGC / Product Demos, Unboxing	1280	4.82%	✅ Good	61	1		Direct Bank Transfer
9	Negar Mansuri	✅ Available	● Complete	Other	negarmansuri.01@gmail.com	+916359621401	https://www.instagram.com/negarmansuri_	Beauty & Skincare, Fashion & Style, Lifestyle, UGC / Product Demos	1208	7.81%	🔥 Excellent	93	1		Direct Bank Transfer
10	Ridhima Mangal	✅ Available	● Complete	Other	collab.ridhima@gmail.com	+919045239898	https://www.instagram.com/__.riddhiimaa._	Beauty & Skincare, Fashion & Style, Travel & Outdoors, UGC / Product Demos, Unboxing	5645	6.21%	🔥 Excellent	344	6		Direct Bank Transfer
11	Aditi Singh	✅ Available	● Complete	India	aditisingh100406@gmail.com	+917050702014	https://www.instagram.com/barely_aditi	Beauty & Skincare, Fashion & Style, Tech & Gadgets, UGC / Product Demos, Unboxing, Lifestyle, Comedy & Skits, Home & Lifestyle	11	136.36%	⚠️ Check Data	14	1		Direct Bank Transfer
12	Gooncha Chhibber	✅ Available	● Complete	India	goonchachhibber@gmail.com	+919810461466	https://www.instagram.com/gunchachhibber	Beauty & Skincare, Fashion & Style	1703	10.86%	🔥 Excellent	182	3		Direct Bank Transfer
13	Bhargabi Kalita	✅ Available	● Complete	India	bhargabikalita87@gmail.com	+919395208884	https://www.instagram.com/__.bhargabikalita	Beauty & Skincare, Fashion & Style, Fitness & Wellness, UGC / Product Demos	3571	6.73%	🔥 Excellent	234	6		Direct Bank Transfer
14	Kanupriya Sharma	✅ Available	● Complete	India	kanupriyasharma1206@gmail.com	+918544771452	https://www.instagram.com/kanupriya.sharmaa	Beauty & Skincare, Fashion & Style, Fitness & Wellness, UGC / Product Demos, Lifestyle	2145	6.84%	🔥 Excellent	143	4		Direct Bank Transfer
15	Aishwarya Batchu	✅ Available	● Complete	India	aishwaryabatchu1@gmail.com	+919676689991	https://www.instagram.com/batchu_aishwarya	Beauty & Skincare, Fashion & Style, Food & Cooking, Lifestyle, UGC / Product Demos	2067	9.32%	🔥 Excellent	189	4		Direct Bank Transfer
16	Fathima Noor	✅ Available	● Complete	Mumbai	fathimanoor148@gmail.com	+919766818625	https://www.instagram.com/_fathima.noor_	Beauty & Skincare, Fashion & Style, UGC / Product Demos, Lifestyle	2381	8.35%	🔥 Excellent	196	3		Direct Bank Transfer
17	Aparna Vashist	✅ Available	● Complete	India	aparnavashist17@gmail.com	+918796389489	https://www.instagram.com/_.aparnaforsure._	Fashion & Style, Beauty & Skincare, Fitness & Wellness, Travel & Outdoors, UGC / Product Demos, Unboxing, Lifestyle, Tech & Gadgets	1987	11.02%	🔥 Excellent	213	6		Direct Bank Transfer
18	Ekta Kumar	✅ Available	● Complete	India	kumar.ekta34@gmail.com	+919971888208	https://www.instagram.com/ektakumar_	Beauty & Skincare, Fashion & Style, Fitness & Wellness, Travel & Outdoors, Lifestyle, UGC / Product Demos	3891	5.53%	🔥 Excellent	210	5		Direct Bank Transfer
19	Aayushi Rawat	✅ Available	● Complete	India	aayushirawatt@gmail.com	+918532011199	https://www.instagram.com/_aayushirawat_	Beauty & Skincare, Fashion & Style, UGC / Product Demos, Unboxing	2143	7.92%	🔥 Excellent	167	3		Direct Bank Transfer
20	Megha Baisoya	✅ Available	● Complete	Delhi	baisoyamegha@gmail.com	+918810203353	https://www.instagram.com/megadrip__	Beauty & Skincare, Fashion & Style, Home & Lifestyle, Travel & Outdoors, UGC / Product Demos, Unboxing, Lifestyle	4219	4.26%	✅ Good	177	2		Direct Bank Transfer
21	Nandini Thapa	✅ Available	● Complete	Chandigarh	nandinithapa129@gmail.com	+919816855283	https://www.instagram.com/nandinii._.04	Beauty & Skincare, Fashion & Style, UGC / Product Demos, Lifestyle	2531	8.14%	🔥 Excellent	201	5		Direct Bank Transfer
22	Ridhi Chaudhary	✅ Available	● Complete	India	ridhichaudharyfc@gmail.com	+918586054481	https://www.instagram.com/ridhichaudhary20_	Beauty & Skincare, Fashion & Style, UGC / Product Demos, Lifestyle	3187	6.72%	🔥 Excellent	210	4		Direct Bank Transfer
23	Khushi Santuka	✅ Available	● Complete	India	santukakhushi530@gmail.com	+918249111247	https://www.instagram.com/khushi.santuka	Beauty & Skincare, Fashion & Style, Food & Cooking, Home & Lifestyle, Travel & Outdoors, UGC / Product Demos, Lifestyle, Unboxing	1423	12.16%	🔥 Excellent	170	3		Direct Bank Transfer
24	Rashmi Rekha Bora	✅ Available	● Complete	India	collab.runjun@gmail.com	+919085896950	https://www.instagram.com/_imrunjun_	Beauty & Skincare, Fashion & Style, Lifestyle, Unboxing	4312	5.91%	🔥 Excellent	251	3		Direct Bank Transfer
25	Rehmat Sandhu	✅ Available	● Complete	India	rehmatsandhu85@gmail.com	+917341151204	https://www.instagram.com/remsandhu	Beauty & Skincare, Fashion & Style, Home & Lifestyle, UGC / Product Demos, Lifestyle	2691	7.43%	🔥 Excellent	196	4		Direct Bank Transfer
26	Kashish Jhaveri	✅ Available	● Complete	India	jhaverikashish06@gmail.com	+919328838354	https://www.instagram.com/___kashish	Beauty & Skincare	1893	9.72%	🔥 Excellent	182	2		Direct Bank Transfer
27	Muskan Gupta	✅ Available	● Complete	Delhi	muskangupta4april@gmail.com	+919870125803	https://www.instagram.com/muskangupta13	Fashion & Style, Beauty & Skincare, Lifestyle	3214	5.28%	🔥 Excellent	167	2		Direct Bank Transfer
28	Rhythm Gupta	✅ Available	● Complete	Chandigarh	rhythmxgupta@gmail.com	+916280659570	https://www.instagram.com/rhhytthhmm	Lifestyle, UGC / Product Demos, Unboxing, Fashion & Style, Beauty & Skincare	2187	8.47%	🔥 Excellent	183	4		Direct Bank Transfer
29	Neha Sadhwani	✅ Available	● Complete	Bareilly	nehasadhwani3@gmail.com	+919105167167	https://www.instagram.com/nehasadhwani_	Beauty & Skincare, UGC / Product Demos, Lifestyle	2341	9.14%	🔥 Excellent	212	5		Direct Bank Transfer
30	Pearl Nijhara	✅ Available	● Complete	India	pearlnijhara2210@gmail.com	+917973759961	https://www.instagram.com/simpllypearll	Beauty & Skincare, Fashion & Style	1892	10.23%	🔥 Excellent	191	2		Direct Bank Transfer
31	Khushi Jha	✅ Available	● Complete	India	trigerredaspitant14@gmail.com	+919911760940	https://www.instagram.com/hasikhushie	Beauty & Skincare, Fashion & Style, UGC / Product Demos, Lifestyle	2834	7.61%	🔥 Excellent	213	3		Direct Bank Transfer
32	Rutuja Dhotre (Tara)	✅ Available	● Complete	Mumbai	d.rutuja99@gmail.com	+919619800799	https://www.instagram.com/__taraaaaaa_	Lifestyle, UGC / Product Demos, Fashion & Style, Beauty & Skincare	3129	6.43%	🔥 Excellent	198	3		PayPal
33	Shashanki Rawat	✅ Available	● Complete	India	shashankirawat0108@gmail.com	+917863077481	https://www.instagram.com/shashanki_rawat	Beauty & Skincare	2491	8.62%	🔥 Excellent	213	2		Direct Bank Transfer
34	Nishita Chaubey	✅ Available	● Complete	India	nishitachaubey2301@gmail.com	+919820735965	https://www.instagram.com/nishitachaubey	Beauty & Skincare, Fashion & Style, Fitness & Wellness	3721	5.82%	🔥 Excellent	213	4		Direct Bank Transfer
35	Yashika Verma	✅ Available	● Complete	Moradabad	yashikavermax@gmail.com	+918630240147	https://www.instagram.com/yashika_vermaaa	Beauty & Skincare, Fashion & Style, Fitness & Wellness, Food & Cooking, Home & Lifestyle, UGC / Product Demos, Unboxing, Lifestyle, Comedy & Skits, Travel & Outdoors	4213	4.72%	✅ Good	196	3		Direct Bank Transfer
36	Sneha Saha	✅ Available	● Complete	India	sneha322saha@gmail.com	+919907186996	https://www.instagram.com/affec.tion__	Lifestyle, UGC / Product Demos, Home & Lifestyle, Fashion & Style, Beauty & Skincare	2831	7.21%	🔥 Excellent	201	4		Direct Bank Transfer
37	Rishika Jain	✅ Available	● Complete	India	rishika.jain@gmail.com	+919812345678	https://www.instagram.com/rishikajain	Beauty & Skincare, Fashion & Style, Lifestyle	2543	8.91%	🔥 Excellent	224	3		Direct Bank Transfer
38	Shreya Singh	✅ Available	● Complete	India	shreya.singh.desk@gmail.com	+919373779843	https://www.instagram.com/shreyay_singh	Beauty & Skincare, Fashion & Style, Lifestyle	3187	6.43%	🔥 Excellent	201	4		Direct Bank Transfer
39	Vaishnavi Khurana	✅ Available	● Complete	India	vaishnavikhurana@gmail.com	+919812345679	https://www.instagram.com/vaishnavikhurana	Beauty & Skincare, Fashion & Style, Lifestyle	2891	7.82%	🔥 Excellent	223	3		Direct Bank Transfer
40	Sumedha Goel	✅ Available	● Complete	India	sumedhagoel28@gmail.com	+919971754389	https://www.instagram.com/sumeedhhaa	Beauty & Skincare, Fashion & Style, Lifestyle	2413	9.12%	🔥 Excellent	218	4		Direct Bank Transfer
41	Maanika Dhawan	✅ Available	● Complete	India	maanika.dhawan@gmail.com	+919812345680	https://www.instagram.com/maanikakhawan	Beauty & Skincare, Fashion & Style, Lifestyle	3124	6.87%	🔥 Excellent	212	3		Direct Bank Transfer
42	Srijana Chetry	✅ Available	● Complete	India	chetrisrijana1@gmail.com	+918761821303	https://www.instagram.com/thatobstinatemess	Beauty & Skincare, Fashion & Style, UGC / Product Demos, Unboxing, Lifestyle	2784	8.14%	🔥 Excellent	224	4		Direct Bank Transfer
43	Arpita Mahajan	✅ Available	◑ Partial	Other	arpita.mahajan1983@gmail.com	+916283272325	https://www.instagram.com/arpitaaa.mahajan	Beauty & Skincare, Fashion & Style, Lifestyle, UGC / Product Demos							Direct Bank Transfer
44	Iknoor Kaur	✅ Available	◑ Partial	India	collabwithiknoorrr@gmail.com	+917973402110		Beauty & Skincare, Fashion & Style, UGC / Product Demos	3626	4.90%	✅ Good	176	1		Direct Bank Transfer
45	Aayushi Khandeka	✅ Available	◑ Partial	India	yushiikha@gmail.com	+919986789092	https://www.instagram.com/yushii_ka	Beauty & Skincare, Fashion & Style, UGC / Product Demos	1964						Direct Bank Transfer
46	Kanchan Yadav	✅ Available	◑ Partial	New Delhi	raokanchan2610@gmail.com	+917703829254	https://www.instagram.com/kanchanthiside	Beauty & Skincare, Fashion & Style, UGC / Product Demos, Lifestyle	443						Direct Bank Transfer
47	Jewel Lopes	✅ Available	◑ Partial	Mumbai	jewellopes1206@gmail.com	+918446544951	https://www.instagram.com/jewel_lopes	Beauty & Skincare, Fashion & Style, Lifestyle	2139						Direct Bank Transfer
48	Suryaja Mowade	✅ Available	◑ Partial	Pune	Suryaja.mowade02@gmail.com	+918830641894	https://www.instagram.com/thisissuryaja	Beauty & Skincare, Fashion & Style, Fitness & Wellness, Food & Cooking, Home & Lifestyle, Lifestyle, Travel & Outdoors, UGC / Product Demos, Unboxing	8495						Direct Bank Transfer
49	Ayushi Singh (Desh)	✅ Available	◑ Partial	India	ayushisingh100406@gmail.com	+917050702014		Beauty & Skincare, Fashion & Style							Direct Bank Transfer
`;

async function run() {
  console.log('Downloading latest creators.json...');
  const { data: blob, error } = await supabase.storage.from('creator-data').download(`creators.json?t=${Date.now()}`);
  if (error) { console.error('Error fetching', error); return; }
  
  let creators = JSON.parse(await blob.text());

  const lines = rawData.trim().split('\n').filter(l => l.trim().length > 0);
  
  let updatedCount = 0;

  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length < 9) continue;
    
    const rawName = parts[1].trim();
    
    // Find niche column index
    let nicheCol = -1;
    for (let i = 0; i < parts.length; i++) {
       if (parts[i].includes('Beauty') || parts[i].includes('Lifestyle') || parts[i].includes('Fashion')) {
           nicheCol = i;
           break;
       }
    }
    
    if (nicheCol === -1) continue;

    const parsedNiches = parts[nicheCol].split(',').map(n => n.trim()).filter(n => n && !n.toLowerCase().includes('ugc'));
    const rawFollowers = parts[nicheCol + 1];
    const rawEng = parts[nicheCol + 2];

    const match = creators.find(c => 
       c.name.toLowerCase().includes(rawName.toLowerCase()) ||
       (rawName.toLowerCase().includes(c.name.toLowerCase()))
    );

    if (match) {
        match.niches = parsedNiches;
        
        if (rawFollowers && rawFollowers.match(/\d/)) {
           match.followers = formatNumber(rawFollowers);
        }
        
        if (rawEng && rawEng.includes('%')) {
           match.engagementRate = rawEng;
        }

        updatedCount++;
        console.log(`✅ Updated ${match.name} -> ${match.followers} followers, ${match.engagementRate} eng`);
    }
  }

  // Ensure UGC stripped from ALL
  for (const c of creators) {
     if (c.niches) {
        c.niches = c.niches.filter(n => !n.toLowerCase().includes('ugc'));
     }
  }

  if (updatedCount > 0) {
    console.log(`\nSaving to Supabase... updated data for ${updatedCount} profiles.`);
    await supabase.storage.from('creator-data').upload('creators.json', JSON.stringify(creators, null, 2), { upsert: true, contentType: 'application/json' });
    console.log('✅ Hard sync complete!');
  } else {
    console.log('✅ Nothing changed.');
  }
}

run().catch(console.error);

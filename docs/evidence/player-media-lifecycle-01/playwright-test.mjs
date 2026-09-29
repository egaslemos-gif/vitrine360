import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000');
  
  // Wait for the demo player to be visible
  await page.waitForSelector('.ui-demo-app-shell');
  
  // Expose a function to get active media elements
  const getMediaStats = async () => {
    return await page.evaluate(() => {
      const audios = Array.from(document.querySelectorAll('audio'));
      const videos = Array.from(document.querySelectorAll('video'));
      return {
        audioCount: audios.length,
        videoCount: videos.length,
        details: [...audios, ...videos].map(el => ({
          tag: el.tagName,
          src: el.currentSrc || el.src,
          paused: el.paused,
          ended: el.ended,
          readyState: el.readyState,
          muted: el.muted,
          duration: el.duration
        }))
      };
    });
  };

  console.log("Initial state:", await getMediaStats());

  // Click the items
  const items = await page.$$('button[role="option"]');
  console.log("Found playlist items:", items.length);

  for (let i = 0; i < items.length; i++) {
    console.log(`\nClicking item ${i}...`);
    await items[i].click();
    await page.waitForTimeout(2000); // let it load and play
    console.log(await getMediaStats());
  }

  await browser.close();
})();

import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000/player/lab');
  
  // Wait for the lab player to be visible
  await page.waitForTimeout(5000);
  
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

  const buttons = await page.$$('button');
  for (let btn of buttons) {
    const text = await btn.textContent();
    if (text.includes('NEXT')) {
      await btn.click();
      await page.waitForTimeout(2000);
      console.log("After NEXT:", await getMediaStats());
    }
  }

  await browser.close();
})();

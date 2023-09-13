const http = require('http')
const path = require('path')
const puppeteer = require('puppeteer');


// Streams the first webcam in the system to the specified Jitsi Meet room. Audio is currently
// not sent, but it can be easily enabled by disabling the corresponding setting in `meetArgs`.
//
// TODO
//   - Detect if we are kicked from the room
//   - Support authenticated deployments
//
// NOTE: only tested on GNU/Linux.

async function main(room, baseUrl='https://meet.jit.si') {
    const chromeArgs = [
      // Disable sandboxing, gives an error on Linux and supposedly breaks fake audio capture
      '--no-sandbox',
      '--disable-setuid-sandbox',
      // Automatically give permission to use media devices
      '--use-fake-ui-for-media-stream',
      // feeds a test pattern to getUserMedia() instead of live camera input
      '--use-fake-device-for-media-stream',
      // To make your own video see https://testrtc.com/y4m-video-chrome/ or download one from https://media.xiph.org/video/derf/
      `--use-file-for-fake-video-capture=${path.resolve(
        __dirname,
        'bus_cif_15fps.y4m',
      )}`,
      // To make your own just use a recorded and convert to wav, e.g. `ffmpeg -i in.mp3 out.wav`
      `--use-file-for-fake-audio-capture=${path.resolve(__dirname, 'fakeAudioStream.wav')}`,
      // Silence all output, just in case
      // '--alsa-output-device=plug:null',
      // Performance from https://stackoverflow.com/a/58589026/684353
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
    ];

    const meetArgs = [
        // Disable receiving of video
        'config.channelLastN=0',
        // Mute our audio
        'config.startWithAudioMuted=false',
        // Don't use simulcast to save resources on the sender (our) side
        'config.disableSimulcast=true',
        // No need to process audio levels
        'config.disableAudioLevels=false',
        // Disable P2P mode due to a bug in Jitsi Meet
        'config.p2p.enabled=false',
        'config.prejoinPageEnabled=false'
    ];
    const url = `${baseUrl}/${room}#${meetArgs.join('&')}`;
    console.log(`Loading ${url}`);

    const browser = await puppeteer.launch({ args: chromeArgs, handleSIGINT: false, headless: false });
    const page = await browser.newPage();

    // Manual handling on SIGINT to gracefully hangup and exit
    process.on('SIGINT', async () => {
        console.log('Exiting...');
        await page.evaluate('APP.conference.hangup();');
        await page.close();
        browser.close();
        console.log('Done!');
        process.exit();
    });

    await page.goto(url);

    // Set some friendly display name
    // await page.evaluate('APP.conference._room.setDisplayName("Streamer");');

    console.log('Running...');
}

main(process.argv[2] || 'jitsi-meeting-lybl-1');
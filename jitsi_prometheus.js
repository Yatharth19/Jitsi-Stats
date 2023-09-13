
const puppeteer = require('puppeteer');

const prometheus = require('prom-client');
const config = require('./config.js');
const fs = require('fs');
const http = require('http')
const path = require('path')

// Function to flatten JSON into CSV
function appendToObject(data, jsonObject) {
  const csvRows = [];
  // console.log("inside append object");
    const key = jsonObject.participantID;
      const participantId = key;
      const videoData = data.resolution[key][Object.keys(data.resolution[key])[0]];
      const framerate = data.framerate[key][Object.keys(data.framerate[key])[0]];
      jsonObject.videoHeight = videoData.height;
      jsonObject.videoWidth = videoData.width;
      jsonObject.frameRate = framerate;
}

let first = true;
// Function to flatten JSON into CSV
function flattenToCsv(data, data1, meetingUrl) {
  const csvRows = [];
  console.log("inside flatten to csv");
    if(first === true) {
      csvRows.push(`TimeStamp,MeetingURL,Number Of Participants,ParticipantID,ParticipantName,Connection Quality, Connection Status, jvbRTT,VideoHeight,VideoWidth,FrameRate,Upload Bitrate,Download Bitrate,Upload Packet Loss,Download Packet Loss,Total Packet Loss`);
      csvRows.push(`\n`);
      first = false;
    }
    const participantID = data.participantID;
    const participantName = data.participantName;
    const connectionQuality = data1.connectionQuality;
    let connectionStatus = "Undefined";
    if(connectionQuality > 10 && connectionQuality <= 30)  connectionStatus = "Non-Optimal";
    else if(connectionQuality > 30) connectionStatus = "Good";
    else  connectionStatus = "Poor";
    const numberOfParticipants = data.numberOfParticipants;
    
    const uploadBitrate = data1.bitrate.upload;
    const downloadBitrate = data1.bitrate.download;

    const uploadPacketLoss = data1.packetLoss.upload;
    const downloadPacketLoss = data1.packetLoss.download;
    const totalPacketLoss = data1.packetLoss.total;

    // console.log("p4");
    const videoHeight = data.videoHeight;
    const videoWidth = data.videoWidth;
    const frameRate = data.frameRate;

    const jvbRTT = data1.jvbRTT;
        
    var today = new Date();
    var date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
    var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    var dateTime = date+' '+time;
    csvRows.push(`${dateTime},${meetingUrl.split("#")[0]},${numberOfParticipants},${participantID},${participantName},${connectionQuality},${connectionStatus},${jvbRTT},${videoHeight},${videoWidth},${frameRate},${uploadBitrate},${downloadBitrate},${uploadPacketLoss},${downloadPacketLoss},${totalPacketLoss}`);
    csvRows.push(`\n`);
  return csvRows;
}

async function collectAndExportJitsiStats(meetingUrl) {
  const chromeArgs = [
    // Disable sandboxing, gives an error on Linux and supposedly breaks fake audio capture
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--headless',
    // Automatically give permission to use media devices
    '--use-fake-ui-for-media-stream',
    // feeds a test pattern to getUserMedia() instead of live camera input
    '--use-fake-device-for-media-stream',
    // To make your own video see https://testrtc.com/y4m-video-chrome/ or download one from https://media.xiph.org/video/derf/
    `--use-file-for-fake-video-capture=${path.resolve(
      __dirname,
      'bus_cif_15fps.y4m',
    )}`,
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
      'config.testing.testMode=true',
      'config.disableNS=true',
      'config.testing.noAutoPlayVideo=false',
      'config.disableAEC=true',
      'config.analytics.disabled=true',
      'interfaceConfig.SHOW_CHROME_EXTENSION_BANNER=false',
      'config.disable1On1Mode=false',
      'config.alwaysVisibleToolbar=true',
      'config.p2p.useStunTurn=true',
      'config.prejoinConfig.enabled=false',
      'config.p2p.enabled=true',
      'userInfo.displayName="LYBL-BOT"',
      'config.gatherStats=true',
      'config.pcStatsInterval=10000',
      'config.debug=true',
      'config.enableTalkWhileMuted=false',
      'config.callStatsID=false',
      'interfaceConfig.DISABLE_FOCUS_INDICATOR=true'

  ];
  
  const url = `${meetingUrl}#${meetArgs.join('&')}`;

  const browser = await puppeteer.launch({ args: chromeArgs, handleSIGINT: false, headless: false });
  const page = await browser.newPage();

  await page.goto(url);
  await page.waitForTimeout(20000); // 30000 milliseconds (30 seconds)

  setInterval(async () => {
    try {

      let otherParticipantStats;
      let part;
      let connectionQuality;
      let videoStats;
      let currentID;

      let participants = await page.evaluate(() => {
        part = APP.conference.listMembersIds();
        videoStats = APP.conference.getStats();
        otherParticipantStats = JSON.stringify(APP.conference._room.connectionQuality._remoteStats); //give stats about other than the one querying participant.
        currentID = APP.conference.getMyUserId();
        return {
          part,
          videoStats,
          otherParticipantStats,
          currentID
        }
      })

      let numberOfParticipants = participants.part.length;

      let allParticipantStats = null;
      for (let i = 0; i <= numberOfParticipants; i++) {
        let participantID;
        let participantName;
        let stats;
        
        if(i < numberOfParticipants) {
          allParticipantStats = await page.evaluate((i) => {
            // Use i in your page.evaluate function
            participantID = (APP.conference.listMembers()[i]._id);
            participantName = (APP.conference.listMembers()[i]._displayName);
            stats = JSON.stringify(Array.from(APP.conference.listMembers()[i]._conference.statistics.rtpStatsMap.entries())[0][1].conferenceStats);
            return {
              participantID,
              participantName,
              stats
            }
          }, i);

          
          localStats = await page.evaluate((i) => {
            return JSON.stringify(APP.conference.listMembers()[i]._conference.connectionQuality._localStats);
          }, i)
          localStats = JSON.parse(localStats);
          connectionQuality = localStats.connectionQuality;
        } //if
        else {
          connectionQuality = participants.videoStats.connectionQuality;
          allParticipantStats = {
            stats : JSON.stringify(participants.videoStats), 
            participantID : participants.currentID,
            "participantName": "LYBL-BOT"
          };
        }

        
        jsonStats = JSON.parse(allParticipantStats.stats);
        otherParticipantStats = JSON.parse(participants.otherParticipantStats);
        jsonStats.participantID = allParticipantStats.participantID;
        jsonStats.participantName = allParticipantStats.participantName;
        jsonStats.connectionQuality = connectionQuality;
        jsonStats.numberOfParticipants = numberOfParticipants+1;
        appendToObject(participants.videoStats, jsonStats);  //for current participant
        let csvData;
        if(i < numberOfParticipants)  csvData = flattenToCsv(jsonStats, otherParticipantStats[participants.part[i]], meetingUrl).join('\n');
        else csvData = flattenToCsv(jsonStats, jsonStats, meetingUrl).join('\n');
        fs.appendFileSync('data.csv', csvData, 'utf-8');
        console.log('Data converted and saved to data.csv for url = ', meetingUrl.split("#")[0]);
      } //for loop ends
  } catch(e) {
    console.log("some error occured, possibly no video is on " + e);
  }
  }, config.scrapeInterval); // Collect stats every 10 seconds

}
module.exports = collectAndExportJitsiStats;

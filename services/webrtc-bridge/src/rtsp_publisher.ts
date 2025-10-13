import { RTCPeerConnection, nonstandard } from '@roamhq/wrtc';
import ffmpeg from 'fluent-ffmpeg';
import { Readable } from 'stream';

const { RTCVideoSource: VideoSource } = nonstandard;

export class RTSPPublisher {
  private peerConnection: RTCPeerConnection;
  private videoSource: any;
  private ffmpegProcess: any;

  constructor(
    rtspUrl: string,
    iceServers: any[]
  ) {
    this.peerConnection = new RTCPeerConnection({ iceServers });
    this.videoSource = new VideoSource();

    const track = this.videoSource.createTrack();
    this.peerConnection.addTrack(track);

    this.startRTSPStream(rtspUrl);
  }

  private startRTSPStream(rtspUrl: string): void {
    this.ffmpegProcess = ffmpeg(rtspUrl)
      .inputOptions([
        '-rtsp_transport', 'tcp',
        '-analyzeduration', '1000000',
        '-probesize', '5000000'
      ])
      .outputOptions([
        '-f', 'rawvideo',
        '-pix_fmt', 'yuv420p',
        '-vf', 'scale=1280:720',
        '-r', '15'
      ])
      .videoCodec('rawvideo')
      .noAudio()
      .format('rawvideo')
      .on('start', (cmd) => {
        console.log('FFmpeg started:', cmd);
      })
      .on('error', (err) => {
        console.error('FFmpeg error:', err);
      })
      .on('stderr', (stderrLine) => {
        console.log('FFmpeg stderr:', stderrLine);
      });

    const stream = this.ffmpegProcess.pipe() as Readable;

    const width = 1280;
    const height = 720;
    const frameSize = width * height * 1.5; // YUV420p
    let buffer = Buffer.alloc(0);

    stream.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);

      while (buffer.length >= frameSize) {
        const frameData = buffer.slice(0, frameSize);
        buffer = buffer.slice(frameSize);

        const i420Frame = {
          width,
          height,
          data: new Uint8ClampedArray(frameData)
        };

        this.videoSource.onFrame(i420Frame);
      }
    });
  }

  async createOffer(): Promise<any> {
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  async handleAnswer(answer: any): Promise<void> {
    await this.peerConnection.setRemoteDescription(answer);
  }

  getPeerConnection(): RTCPeerConnection {
    return this.peerConnection;
  }

  close(): void {
    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill('SIGKILL');
    }
    this.peerConnection.close();
  }
}
